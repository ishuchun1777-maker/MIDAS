// MIDAS API — Admin Routes
// packages/api/src/routes/admin.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'
import { requireRole } from '../middlewares/auth.middleware'
import { resolveDispute } from '../services/deal.service'
import { queueNotification } from '../jobs/queue'
import { runWeeklyFraudScan } from '../ai/matching.engine'

const auth = { preHandler: [requireRole('ADMIN')] }

export async function adminRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════

  app.get('/dashboard', auth, async (req, reply) => {
    const now = new Date()
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart    = new Date(now.getTime() - 7 * 86400_000)
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalUsers, newUsersToday, newUsersWeek,
      totalDeals, activeDeals, completedDeals,
      totalAdvertisers, pendingVerification,
      openDisputes,
      todayRevenue, monthRevenue, escrowHeld,
      fraudAlerts,
      topAdvertisers,
      recentDeals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),

      prisma.deal.count(),
      prisma.deal.count({ where: { status: { in: ['PENDING','ACCEPTED','ESCROW_HELD','CONTENT_SUBMITTED'] } } }),
      prisma.deal.count({ where: { status: 'COMPLETED' } }),

      prisma.advertiserProfile.count(),
      prisma.advertiserProfile.count({ where: { verificationStatus: 'PENDING' } }),

      prisma.dispute.count({ where: { status: 'OPEN' } }),

      prisma.payment.aggregate({
        where: { status: 'RELEASED', releasedAt: { gte: todayStart } },
        _sum: { fee: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'RELEASED', releasedAt: { gte: monthStart } },
        _sum: { fee: true, amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'HELD' },
        _sum: { amount: true },
        _count: { id: true },
      }),

      prisma.advertiserProfile.count({ where: { fraudScore: { lt: 60 } } }),

      prisma.advertiserProfile.findMany({
        where: { verificationStatus: 'APPROVED' },
        orderBy: { dealsCount: 'desc' },
        take: 5,
        include: { user: { select: { fullName: true, telegramUsername: true } } },
        select: {
          id: true, platformHandle: true, advertiserType: true,
          rating: true, dealsCount: true, followerCount: true,
          fraudScore: true, user: true,
        },
      }),

      prisma.deal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          campaign: { include: { business: { select: { businessName: true } } } },
          advertiser: { select: { platformHandle: true } },
        },
        select: {
          id: true, status: true, price: true, createdAt: true,
          campaign: true, advertiser: true,
        },
      }),
    ])

    return reply.send({
      users:       { total: totalUsers, today: newUsersToday, week: newUsersWeek },
      deals:       { total: totalDeals, active: activeDeals, completed: completedDeals },
      advertisers: { total: totalAdvertisers, pendingVerification },
      disputes:    { open: openDisputes },
      revenue: {
        todayFees:    Number(todayRevenue._sum.fee  || 0),
        monthFees:    Number(monthRevenue._sum.fee  || 0),
        monthVolume:  Number(monthRevenue._sum.amount || 0),
        escrowHeld:   Number(escrowHeld._sum.amount || 0),
        escrowCount:  escrowHeld._count.id,
      },
      fraudAlerts,
      topAdvertisers,
      recentDeals,
    })
  })

  // ══════════════════════════════════════════
  // VERIFIKATSIYA
  // ══════════════════════════════════════════

  // Pending ro'yxat
  app.get('/verification/pending', auth, async (req, reply) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [items, total] = await Promise.all([
      prisma.advertiserProfile.findMany({
        where: { verificationStatus: 'PENDING' },
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { fullName: true, telegramUsername: true, phone: true, createdAt: true } },
        },
      }),
      prisma.advertiserProfile.count({ where: { verificationStatus: 'PENDING' } }),
    ])

    return reply.send({ items, total, page: parseInt(page) })
  })

  // Tasdiqlash / Rad etish
  app.patch('/verification/:profileId', auth, async (req, reply) => {
    const { profileId } = req.params as { profileId: string }
    const schema = z.object({
      approved: z.boolean(),
      reason:   z.string().max(500).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

    const profile = await prisma.advertiserProfile.update({
      where: { id: profileId },
      data: {
        verificationStatus: body.data.approved ? 'APPROVED' : 'REJECTED',
        verifiedAt:         body.data.approved ? new Date() : null,
        rejectionReason:    !body.data.approved ? body.data.reason : null,
      },
    })

    // Foydalanuvchiga bildirishnoma
    await queueNotification(
      profile.userId,
      body.data.approved ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      { reason: body.data.reason }
    )

    return reply.send(profile)
  })

  // ══════════════════════════════════════════
  // NIZOLAR
  // ══════════════════════════════════════════

  // Nizolar ro'yxati
  app.get('/disputes', auth, async (req, reply) => {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (status) where.status = status
    else where.status = { in: ['OPEN', 'UNDER_REVIEW'] }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'asc' },
        include: {
          deal: {
            include: {
              campaign: { include: { business: { include: { user: { select: { fullName: true, telegramUsername: true } } } } } },
              advertiser: { include: { user: { select: { fullName: true, telegramUsername: true } } } },
              payment: { select: { amount: true, status: true } },
            },
          },
        },
      }),
      prisma.dispute.count({ where }),
    ])

    return reply.send({ disputes, total, page: parseInt(page) })
  })

  // Bitta nizo tafsiloti
  app.get('/disputes/:disputeId', auth, async (req, reply) => {
    const { disputeId } = req.params as { disputeId: string }
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        deal: {
          include: {
            campaign: { include: { business: { include: { user: true } } } },
            advertiser: { include: { user: true } },
            payment: true,
            review: true,
          },
        },
      },
    })
    if (!dispute) return reply.status(404).send({ error: 'NOT_FOUND' })
    return reply.send(dispute)
  })

  // Nizoni ko'rib chiqmoqda
  app.patch('/disputes/:disputeId/review', auth, async (req, reply) => {
    const { disputeId } = req.params as { disputeId: string }
    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'UNDER_REVIEW', adminId: (req as any).user.userId },
    })
    return reply.send(updated)
  })

  // Nizo hal qilish
  app.post('/disputes/:disputeId/resolve', auth, async (req, reply) => {
    const { disputeId } = req.params as { disputeId: string }
    const schema = z.object({
      resolution:    z.enum(['RESOLVED_REFUND', 'RESOLVED_PARTIAL', 'RESOLVED_PAID_ADVERTISER']),
      adminNote:     z.string().min(5).max(1000),
      refundPercent: z.number().int().min(0).max(100).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT', details: body.error.flatten() })

    try {
      const result = await resolveDispute(
        disputeId,
        (req as any).user.userId,
        body.data.resolution,
        body.data.adminNote,
        body.data.refundPercent
      )
      return reply.send(result)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // ══════════════════════════════════════════
  // CRM — FOYDALANUVCHILAR
  // ══════════════════════════════════════════

  // Qidirish
  app.get('/users', auth, async (req, reply) => {
    const { search, role, isBanned, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (role)     where.role = role
    if (isBanned !== undefined) where.isBanned = isBanned === 'true'
    if (search) {
      where.OR = [
        { fullName:        { contains: search, mode: 'insensitive' } },
        { telegramUsername:{ contains: search, mode: 'insensitive' } },
        { phone:           { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, role: true, lang: true, fullName: true,
          telegramUsername: true, phone: true,
          isBanned: true, banReason: true,
          createdAt: true,
          _count: { select: { notifications: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ users, total, page: parseInt(page) })
  })

  // Foydalanuvchi profili (to'liq)
  app.get('/users/:userId', auth, async (req, reply) => {
    const { userId } = req.params as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businessProfile:   true,
        advertiserProfile: true,
        agencyProfile:     true,
      },
    })
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' })

    // Bitim statistikasi
    const dealStats = await prisma.deal.groupBy({
      by: ['status'],
      where: {
        OR: [
          { campaign: { business: { userId } } },
          { advertiser: { userId } },
        ],
      },
      _count: { status: true },
    })

    return reply.send({ ...user, dealStats })
  })

  // Ban/Unban
  app.patch('/users/:userId/ban', auth, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const schema = z.object({
      banned: z.boolean(),
      reason: z.string().max(300).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned:  body.data.banned,
        banReason: body.data.banned ? body.data.reason : null,
      },
      select: { id: true, isBanned: true, banReason: true },
    })
    return reply.send(user)
  })

  // Manual rol o'zgartirish
  app.patch('/users/:userId/role', auth, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const schema = z.object({ role: z.enum(['BUSINESS', 'ADVERTISER', 'AGENCY', 'ADMIN']) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: body.data.role as any },
      select: { id: true, role: true },
    })
    return reply.send(user)
  })

  // ══════════════════════════════════════════
  // FRAUD MANAGEMENT
  // ══════════════════════════════════════════

  // Fraud xavf ostidagi reklamachilar
  app.get('/fraud/alerts', auth, async (req, reply) => {
    const { threshold = '60' } = req.query as Record<string, string>

    const alerts = await prisma.advertiserProfile.findMany({
      where: { fraudScore: { lt: parseInt(threshold) }, verificationStatus: 'APPROVED' },
      orderBy: { fraudScore: 'asc' },
      include: { user: { select: { fullName: true, telegramUsername: true } } },
      select: {
        id: true, platformHandle: true, advertiserType: true,
        fraudScore: true, followerCount: true, engagementRate: true,
        dealsCount: true, user: true,
      },
    })

    return reply.send(alerts)
  })

  // Manual fraud score yangilash
  app.patch('/fraud/:profileId/score', auth, async (req, reply) => {
    const { profileId } = req.params as { profileId: string }
    const schema = z.object({
      fraudScore: z.number().int().min(0).max(100),
      note:       z.string().max(300).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

    const profile = await prisma.advertiserProfile.update({
      where: { id: profileId },
      data: { fraudScore: body.data.fraudScore },
    })
    return reply.send(profile)
  })

  // Fraud scan ishga tushirish
  app.post('/fraud/scan', auth, async (req, reply) => {
    const count = await runWeeklyFraudScan()
    return reply.send({ scanned: count, message: `${count} ta reklamachi tekshirildi` })
  })

  // ══════════════════════════════════════════
  // PREMIUM BOSHQARUV
  // ══════════════════════════════════════════

  // Premium berish / olish
  app.patch('/premium/:userId', auth, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const schema = z.object({
      isPremium: z.boolean(),
      months:    z.number().int().min(1).max(12).optional().default(1),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

    const premiumUntil = body.data.isPremium
      ? new Date(Date.now() + body.data.months * 30 * 86400_000)
      : null

    // Advertiser yoki Business profilini yangilaymiz
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (user?.role === 'ADVERTISER') {
      await prisma.advertiserProfile.update({
        where: { userId },
        data: { isPremium: body.data.isPremium, premiumUntil },
      })
    } else if (user?.role === 'BUSINESS') {
      await prisma.businessProfile.update({
        where: { userId },
        data: { isPremium: body.data.isPremium, premiumUntil },
      })
    }

    return reply.send({ success: true, premiumUntil })
  })

  // ══════════════════════════════════════════
  // PLATFORMA SOZLAMALARI
  // ══════════════════════════════════════════

  // Sozlamalarni olish
  app.get('/settings', auth, async (req, reply) => {
    const settings = await prisma.platformSetting.findMany()
    const map: Record<string, string> = {}
    settings.forEach(s => { map[s.key] = s.value })
    return reply.send(map)
  })

  // Sozlamani yangilash
  app.patch('/settings/:key', auth, async (req, reply) => {
    const { key } = req.params as { key: string }
    const { value } = req.body as { value: string }

    if (!value) return reply.status(400).send({ error: 'VALUE_REQUIRED' })

    // Ruxsat etilgan kalitlar
    const ALLOWED_KEYS = [
      'commission_rate', 'free_deals_per_month',
      'premium_price_advertiser', 'premium_price_business',
      'fraud_suspend_threshold', 'content_deadline_hours',
      'dispute_auto_resolve_hours', 'admin_resolve_hours',
      'maintenance_mode',
    ]
    if (!ALLOWED_KEYS.includes(key)) {
      return reply.status(400).send({ error: 'INVALID_KEY' })
    }

    const setting = await prisma.platformSetting.upsert({
      where: { key },
      update: { value, updatedBy: (req as any).user.userId },
      create: { key, value, updatedBy: (req as any).user.userId },
    })
    return reply.send(setting)
  })

  // ══════════════════════════════════════════
  // ANALITIKA
  // ══════════════════════════════════════════

  // Moliyaviy hisobot (kunlik)
  app.get('/reports/financial', auth, async (req, reply) => {
    const { from, to } = req.query as Record<string, string>
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000)
    const toDate   = to   ? new Date(to)   : new Date()

    const payments = await prisma.payment.findMany({
      where: {
        status: 'RELEASED',
        releasedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { releasedAt: 'asc' },
      select: {
        id: true, amount: true, fee: true, provider: true,
        releasedAt: true,
        deal: {
          select: {
            campaign: { select: { business: { select: { industryCode: true } } } },
          },
        },
      },
    })

    // Kunlik agregatsiya
    const dailyMap: Record<string, { date: string; volume: number; fees: number; count: number }> = {}
    for (const p of payments) {
      const date = p.releasedAt!.toISOString().split('T')[0]
      if (!dailyMap[date]) dailyMap[date] = { date, volume: 0, fees: 0, count: 0 }
      dailyMap[date].volume += Number(p.amount)
      dailyMap[date].fees   += Number(p.fee)
      dailyMap[date].count  += 1
    }

    // Provider bo'yicha breakdown
    const byProvider: Record<string, number> = {}
    payments.forEach(p => {
      byProvider[p.provider] = (byProvider[p.provider] || 0) + Number(p.fee)
    })

    // Soha bo'yicha breakdown
    const byIndustry: Record<string, number> = {}
    payments.forEach(p => {
      const industry = p.deal.campaign.business.industryCode || 'other'
      byIndustry[industry] = (byIndustry[industry] || 0) + Number(p.amount)
    })

    return reply.send({
      daily:      Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
      totals: {
        volume: payments.reduce((s, p) => s + Number(p.amount), 0),
        fees:   payments.reduce((s, p) => s + Number(p.fee), 0),
        count:  payments.length,
      },
      byProvider,
      byIndustry,
    })
  })

  // Top reklamachilar hisoboti
  app.get('/reports/top-advertisers', auth, async (req, reply) => {
    const { limit = '10' } = req.query as Record<string, string>

    const advertisers = await prisma.advertiserProfile.findMany({
      where: { verificationStatus: 'APPROVED' },
      orderBy: [{ dealsCount: 'desc' }, { rating: 'desc' }],
      take: parseInt(limit),
      include: { user: { select: { fullName: true, telegramUsername: true } } },
      select: {
        id: true, platformHandle: true, advertiserType: true,
        followerCount: true, rating: true, reviewsCount: true,
        dealsCount: true, successRate: true, fraudScore: true,
        isPremium: true, user: true,
      },
    })

    return reply.send(advertisers)
  })

  // Foydalanuvchi o'sish grafigi
  app.get('/reports/growth', auth, async (req, reply) => {
    const days = 30
    const result = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const [newUsers, newDeals, newAdv] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: date, lt: nextDate } } }),
        prisma.deal.count({ where: { createdAt: { gte: date, lt: nextDate } } }),
        prisma.advertiserProfile.count({ where: { createdAt: { gte: date, lt: nextDate } } }),
      ])

      result.push({
        date: date.toISOString().split('T')[0],
        newUsers, newDeals, newAdvertisers: newAdv,
      })
    }

    return reply.send(result)
  })

  // ══════════════════════════════════════════
  // DEALS BOSHQARUVI (Admin)
  // ══════════════════════════════════════════

  app.get('/deals', auth, async (req, reply) => {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = {}
    if (status) where.status = status

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: { include: { business: { select: { businessName: true } } } },
          advertiser: { include: { user: { select: { fullName: true, telegramUsername: true } } } },
          payment: { select: { status: true, provider: true, amount: true } },
          dispute: { select: { status: true, reason: true } },
        },
      }),
      prisma.deal.count({ where }),
    ])

    return reply.send({ deals, total, page: parseInt(page) })
  })

  // Manual deal status o'zgartirish (admin)
  app.patch('/deals/:dealId/status', auth, async (req, reply) => {
    const { dealId } = req.params as { dealId: string }
    const { status, note } = req.body as { status: string; note?: string }

    const validStatuses = ['PENDING','ACCEPTED','ESCROW_HELD','CONTENT_SUBMITTED','COMPLETED','CANCELLED','RESOLVED']
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: 'INVALID_STATUS' })
    }

    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: { status: status as any, note },
    })
    return reply.send(deal)
  })
}

// MIDAS API — User Routes
// packages/api/src/routes/user.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'
import { requireRole } from '../middlewares/auth.middleware'

const patchLangSchema = z.object({ lang: z.enum(['uz', 'ru', 'en']) })
const patchRoleSchema = z.object({ role: z.enum(['BUSINESS', 'ADVERTISER', 'AGENCY']) })
const patchPhoneSchema = z.object({ phone: z.string().min(9).max(15) })

export async function userRoutes(app: FastifyInstance) {

  // GET /users/telegram/:telegramId — Bot auth uchun
  app.get('/telegram/:telegramId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { telegramId } = req.params as { telegramId: string }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        id: true, role: true, lang: true, fullName: true,
        telegramUsername: true, isBanned: true, banReason: true,
        businessProfile:   { select: { id: true, businessName: true } },
        advertiserProfile: { select: { id: true, verificationStatus: true } },
        agencyProfile:     { select: { id: true, companyName: true, isVerified: true } },
      },
    })

    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' })

    const isOnboarded =
      (user.role === 'BUSINESS' && !!user.businessProfile) ||
      (user.role === 'ADVERTISER' && !!user.advertiserProfile) ||
      (user.role === 'AGENCY' && !!user.agencyProfile) ||
      user.role === 'ADMIN'

    return reply.send({ ...user, isOnboarded })
  })

  // PATCH /users/:userId/role
  app.patch(
    '/:userId/role',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const body = patchRoleSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role: body.data.role as any },
        select: { id: true, role: true },
      })
      return reply.send(user)
    }
  )

  // PATCH /users/:userId/lang
  app.patch(
    '/:userId/lang',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const body = patchLangSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

      const user = await prisma.user.update({
        where: { id: userId },
        data: { lang: body.data.lang as any },
        select: { id: true, lang: true },
      })
      return reply.send(user)
    }
  )

  // GET /users/:userId/wallet — Reklamachi wallet ma'lumotlari
  app.get(
    '/:userId/wallet',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }

      // Tugallangan bitimlardan daromad hisoblaymiz
      const deals = await prisma.deal.findMany({
        where: {
          advertiser: { userId },
          status: 'COMPLETED',
        },
        select: { advertiserPayout: true, completedAt: true },
      })

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const totalIncome = deals.reduce(
        (sum, d) => sum + Number(d.advertiserPayout), 0
      )
      const monthlyIncome = deals
        .filter(d => d.completedAt && d.completedAt >= startOfMonth)
        .reduce((sum, d) => sum + Number(d.advertiserPayout), 0)

      // Escrow'da turgan (chiqarib olinmagan) summa
      const pendingPayments = await prisma.payment.aggregate({
        where: {
          deal: { advertiser: { userId } },
          status: 'HELD',
        },
        _sum: { amount: true },
      })

      const balance = Number(pendingPayments._sum.amount || 0)

      return reply.send({ balance, totalIncome, monthlyIncome })
    }
  )

  // Admin: GET /users — Barcha foydalanuvchilar
  app.get(
    '/',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { page = '1', limit = '20', role, search } = req.query as Record<string, string>
      const skip = (parseInt(page) - 1) * parseInt(limit)

      const where: any = {}
      if (role) where.role = role
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { telegramUsername: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ]
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, role: true, lang: true, fullName: true,
            telegramUsername: true, phone: true, isBanned: true, createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ])

      return reply.send({ users, total, page: parseInt(page), limit: parseInt(limit) })
    }
  )

  // Admin: PATCH /users/:userId/ban
  app.patch(
    '/:userId/ban',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const { banned, reason } = req.body as { banned: boolean; reason?: string }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { isBanned: banned, banReason: banned ? reason : null },
        select: { id: true, isBanned: true, banReason: true },
      })
      return reply.send(user)
    }
  )
}

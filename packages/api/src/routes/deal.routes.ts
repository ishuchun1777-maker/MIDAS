// MIDAS API — Deal Routes
// packages/api/src/routes/deal.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'
import {
  createDeal, acceptDeal, rejectDeal,
  submitContent, confirmAndCompleteDeal,
  openDispute, DealError,
} from '../services/deal.service'
import { requireRole } from '../middlewares/auth.middleware'

// ─── Validation schemas ───────────────────
const createDealSchema = z.object({
  campaignId:   z.string().uuid(),
  advertiserId: z.string().uuid(),
  price:        z.number().positive().max(100_000_000),
  note:         z.string().max(500).optional(),
})

const submitContentSchema = z.object({
  contentUrl:  z.string().url(),
  contentNote: z.string().max(500).optional(),
})

const disputeSchema = z.object({
  reason:       z.string().min(10).max(1000),
  evidenceUrls: z.array(z.string().url()).max(5).optional(),
})

const rejectSchema = z.object({
  reason: z.string().max(300).optional(),
})

const reviewSchema = z.object({
  score:   z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

export async function dealRoutes(app: FastifyInstance) {

  // ─── POST /deals — Yangi taklif ──────────
  app.post(
    '/',
    { preHandler: [requireRole('BUSINESS', 'AGENCY')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createDealSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT', details: body.error.flatten() })

      try {
        const deal = await createDeal(body.data)
        return reply.status(201).send(deal)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── GET /deals/user/:userId — Foydalanuvchi bitimlar ─
  app.get(
    '/user/:userId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const { status, page = '1', limit = '20' } = req.query as Record<string, string>
      const skip = (parseInt(page) - 1) * parseInt(limit)

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, businessProfile: true, advertiserProfile: true },
      })
      if (!user) return reply.status(404).send({ error: 'NOT_FOUND' })

      let where: any = {}
      if (status) where.status = status

      if (user.role === 'BUSINESS' && user.businessProfile) {
        const campaigns = await prisma.campaign.findMany({
          where: { businessId: user.businessProfile.id },
          select: { id: true },
        })
        where.campaignId = { in: campaigns.map(c => c.id) }
      } else if (user.role === 'ADVERTISER' && user.advertiserProfile) {
        where.advertiserId = user.advertiserProfile.id
      }

      const [deals, total] = await Promise.all([
        prisma.deal.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            campaign: {
              include: { business: { select: { businessName: true } } },
            },
            advertiser: {
              include: { user: { select: { fullName: true, telegramUsername: true } } },
            },
            payment: { select: { status: true, provider: true } },
          },
        }),
        prisma.deal.count({ where }),
      ])

      return reply.send({ deals, total, page: parseInt(page), limit: parseInt(limit) })
    }
  )

  // ─── GET /deals/:dealId — Bitim tafsiloti ─
  app.get(
    '/:dealId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }

      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          campaign: { include: { business: { include: { user: { select: { id: true, fullName: true } } } } } },
          advertiser: { include: { user: { select: { id: true, fullName: true, telegramUsername: true } } } },
          payment: true,
          dispute: true,
          review: true,
        },
      })
      if (!deal) return reply.status(404).send({ error: 'NOT_FOUND' })
      return reply.send(deal)
    }
  )

  // ─── PATCH /deals/:dealId/accept ──────────
  app.patch(
    '/:dealId/accept',
    { preHandler: [requireRole('ADVERTISER')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user

      // Advertiser profile ID topish
      const advProfile = await prisma.advertiserProfile.findUnique({
        where: { userId: reqUser.userId },
        select: { id: true },
      })
      if (!advProfile) return reply.status(403).send({ error: 'NO_ADVERTISER_PROFILE' })

      try {
        const deal = await acceptDeal(dealId, advProfile.id)
        return reply.send(deal)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── PATCH /deals/:dealId/reject ──────────
  app.patch(
    '/:dealId/reject',
    { preHandler: [requireRole('ADVERTISER')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user
      const body = rejectSchema.safeParse(req.body)

      const advProfile = await prisma.advertiserProfile.findUnique({
        where: { userId: reqUser.userId },
        select: { id: true },
      })
      if (!advProfile) return reply.status(403).send({ error: 'NO_ADVERTISER_PROFILE' })

      try {
        const deal = await rejectDeal(dealId, advProfile.id, body.data?.reason)
        return reply.send(deal)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── PATCH /deals/:dealId/submit-content ──
  app.patch(
    '/:dealId/submit-content',
    { preHandler: [requireRole('ADVERTISER')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user
      const body = submitContentSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

      const advProfile = await prisma.advertiserProfile.findUnique({
        where: { userId: reqUser.userId },
        select: { id: true },
      })
      if (!advProfile) return reply.status(403).send({ error: 'NO_ADVERTISER_PROFILE' })

      try {
        const deal = await submitContent(dealId, advProfile.id, body.data.contentUrl, body.data.contentNote)
        return reply.send(deal)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── PATCH /deals/:dealId/confirm ─────────
  app.patch(
    '/:dealId/confirm',
    { preHandler: [requireRole('BUSINESS', 'AGENCY')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user

      try {
        const deal = await confirmAndCompleteDeal(dealId, reqUser.userId)
        return reply.send(deal)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── POST /deals/:dealId/dispute ──────────
  app.post(
    '/:dealId/dispute',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user
      const body = disputeSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

      try {
        const result = await openDispute(dealId, reqUser.userId, body.data.reason, body.data.evidenceUrls)
        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof DealError) return reply.status(400).send({ error: err.code, message: err.message })
        throw err
      }
    }
  )

  // ─── POST /deals/:dealId/review ───────────
  app.post(
    '/:dealId/review',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const reqUser = (req as any).user
      const body = reviewSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT' })

      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { advertiser: true, campaign: { include: { business: true } } },
      })
      if (!deal || deal.status !== 'COMPLETED') {
        return reply.status(400).send({ error: 'DEAL_NOT_COMPLETED' })
      }

      // Existing review tekshirish
      const existing = await prisma.review.findUnique({ where: { dealId } })
      if (existing) return reply.status(409).send({ error: 'REVIEW_EXISTS' })

      // Target: tadbirkor reklachini baholaydi, yoki reklamachi tadbirkorni
      const targetId = deal.campaign.business.userId === reqUser.userId
        ? deal.advertiser.userId
        : deal.campaign.business.userId

      const review = await prisma.review.create({
        data: {
          dealId,
          reviewerId: reqUser.userId,
          targetId,
          score: body.data.score,
          comment: body.data.comment,
        },
      })

      // Reklamachi reyting yangilash
      if (deal.campaign.business.userId === reqUser.userId) {
        await updateAdvertiserRating(deal.advertiserId)
      }

      return reply.status(201).send(review)
    }
  )

  // ─── GET /deals/:dealId/payment-url ───────
  // To'lov havolasi yaratish
  app.get(
    '/:dealId/payment-url',
    { preHandler: [requireRole('BUSINESS', 'AGENCY')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }
      const { provider = 'payme', returnUrl } = req.query as { provider?: string; returnUrl?: string }

      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { campaign: { include: { business: true } } },
      })
      if (!deal) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (deal.status !== 'ACCEPTED') return reply.status(400).send({ error: 'DEAL_NOT_ACCEPTED' })

      const description = `MIDAS: ${deal.campaign.business.businessName} reklama to'lovi`
      const callbackUrl = returnUrl || `${process.env.MINIAPP_URL}/deals/${dealId}`

      let paymentUrl: string

      if (provider === 'click') {
        const { createClickCheckoutUrl } = await import('../payments/click.provider')
        paymentUrl = createClickCheckoutUrl({
          dealId,
          amount: Number(deal.price),
          description,
          returnUrl: callbackUrl,
        })
      } else {
        const { createPaymeCheckoutUrl } = await import('../payments/payme.provider')
        paymentUrl = createPaymeCheckoutUrl({
          dealId,
          amount: Number(deal.price),
          description,
          returnUrl: callbackUrl,
        })
      }

      return reply.send({ paymentUrl, provider, amount: Number(deal.price) })
    }
  )
}

// ─── Reyting yangilash ────────────────────
async function updateAdvertiserRating(advertiserId: string) {
  const reviews = await prisma.review.findMany({
    where: { deal: { advertiserId } },
    select: { score: true },
  })
  if (!reviews.length) return

  const avg = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length

  await prisma.advertiserProfile.update({
    where: { id: advertiserId },
    data: {
      rating: parseFloat(avg.toFixed(2)),
      reviewsCount: reviews.length,
    },
  })
}

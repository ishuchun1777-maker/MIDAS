// MIDAS API — Advertiser Profile Routes
// packages/api/src/routes/advertiser.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'
import { requireRole } from '../middlewares/auth.middleware'

const createSchema = z.object({
  userId: z.string().uuid(),
  advertiserType: z.enum(['TELEGRAM_CHANNEL', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'BILLBOARD', 'LED_SCREEN']),
  platformHandle: z.string().optional(),
  platformUrl: z.string().url().optional(),
  followerCount: z.number().int().min(0).default(0),
  pricePost: z.number().min(0).optional(),
  priceStory: z.number().min(0).optional(),
  priceIntegration: z.number().min(0).optional(),
  audienceData: z.object({
    age_min: z.number().default(18),
    age_max: z.number().default(45),
    gender_split: z.object({ male: z.number(), female: z.number() }).default({ male: 50, female: 50 }),
    top_regions: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    income_level: z.string().default('medium'),
  }).default({}),
  // Billboard/LED qo'shimcha
  address: z.string().optional(),
  dimensions: z.string().optional(),
  dailyTraffic: z.number().optional(),
})

export async function advertiserRoutes(app: FastifyInstance) {

  // POST /advertisers/profile
  app.post(
    '/profile',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT', details: body.error.flatten() })

      const existing = await prisma.advertiserProfile.findUnique({ where: { userId: body.data.userId } })
      if (existing) return reply.status(409).send({ error: 'PROFILE_EXISTS' })

      const profile = await prisma.advertiserProfile.create({
        data: {
          userId: body.data.userId,
          advertiserType: body.data.advertiserType as any,
          platformHandle: body.data.platformHandle,
          platformUrl: body.data.platformUrl,
          followerCount: body.data.followerCount,
          pricePost: body.data.pricePost,
          priceStory: body.data.priceStory,
          priceIntegration: body.data.priceIntegration,
          audienceData: body.data.audienceData as any,
          address: body.data.address,
          dimensions: body.data.dimensions,
          dailyTraffic: body.data.dailyTraffic,
          verificationStatus: 'PENDING',
          fraudScore: 50, // Tekshirilguncha neutral
        },
      })

      // Admin ga bildirishnoma (background job)
      await notifyAdminNewVerification(profile.id)

      return reply.status(201).send(profile)
    }
  )

  // GET /advertisers/profile/:userId
  app.get(
    '/profile/:userId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const profile = await prisma.advertiserProfile.findUnique({
        where: { userId },
        include: { user: { select: { fullName: true, telegramUsername: true } } },
      })
      if (!profile) return reply.status(404).send({ error: 'NOT_FOUND' })
      return reply.send(profile)
    }
  )

  // GET /advertisers — Katalog (filtrli)
  app.get(
    '/',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const {
        type, region, minFollowers, maxPrice,
        page = '1', limit = '20'
      } = req.query as Record<string, string>

      const skip = (parseInt(page) - 1) * parseInt(limit)
      const where: any = { verificationStatus: 'APPROVED', isActive: true }

      if (type) where.advertiserType = type
      if (minFollowers) where.followerCount = { gte: parseInt(minFollowers) }
      if (maxPrice) where.pricePost = { lte: parseFloat(maxPrice) }

      const [advertisers, total] = await Promise.all([
        prisma.advertiserProfile.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: [{ isPremium: 'desc' }, { rating: 'desc' }, { followerCount: 'desc' }],
          include: {
            user: { select: { fullName: true, telegramUsername: true } },
          },
        }),
        prisma.advertiserProfile.count({ where }),
      ])

      return reply.send({ advertisers, total, page: parseInt(page), limit: parseInt(limit) })
    }
  )

  // Admin: PATCH /advertisers/:id/verify
  app.patch(
    '/:id/verify',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const { approved, reason } = req.body as { approved: boolean; reason?: string }

      const profile = await prisma.advertiserProfile.update({
        where: { id },
        data: {
          verificationStatus: approved ? 'APPROVED' : 'REJECTED',
          verifiedAt: approved ? new Date() : null,
          rejectionReason: !approved ? reason : null,
        },
      })

      // Foydalanuvchiga bot orqali xabar yuborish (queue)
      await notifyUserVerificationResult(profile.userId, approved, reason)

      return reply.send(profile)
    }
  )

  // Admin: GET /advertisers/pending — Verifikatsiya navbati
  app.get(
    '/pending',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const pending = await prisma.advertiserProfile.findMany({
        where: { verificationStatus: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { fullName: true, telegramUsername: true, phone: true } },
        },
      })
      return reply.send(pending)
    }
  )
}

// ─── Helpers (queue'ga yuborish) ──────────
async function notifyAdminNewVerification(profileId: string) {
  // BullMQ job yaratiladi (keyingi sprintda)
  console.log('[QUEUE] Admin notification for new verification:', profileId)
}

async function notifyUserVerificationResult(userId: string, approved: boolean, reason?: string) {
  // Bot orqali xabar yuborish (keyingi sprintda)
  console.log('[QUEUE] Notify user verification result:', userId, approved)
}

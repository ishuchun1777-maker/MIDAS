// MIDAS API — Business Profile Routes
// packages/api/src/routes/business.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'

const createSchema = z.object({
  userId: z.string().uuid(),
  businessName: z.string().min(2).max(100),
  industryCode: z.string().min(2),
  industryName: z.string().min(2),
  region: z.string().default('tashkent'),
  monthlyBudget: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).default('MEDIUM'),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional(),
})

export async function businessRoutes(app: FastifyInstance) {

  // POST /businesses/profile
  app.post(
    '/profile',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'INVALID_INPUT', details: body.error.flatten() })

      const existing = await prisma.businessProfile.findUnique({ where: { userId: body.data.userId } })
      if (existing) return reply.status(409).send({ error: 'PROFILE_EXISTS' })

      const profile = await prisma.businessProfile.create({
        data: {
          userId: body.data.userId,
          businessName: body.data.businessName,
          industryCode: body.data.industryCode,
          industryName: body.data.industryName,
          region: body.data.region,
          monthlyBudget: body.data.monthlyBudget as any,
          description: body.data.description,
          websiteUrl: body.data.websiteUrl,
        },
      })

      return reply.status(201).send(profile)
    }
  )

  // GET /businesses/profile/:userId
  app.get(
    '/profile/:userId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const profile = await prisma.businessProfile.findUnique({ where: { userId } })
      if (!profile) return reply.status(404).send({ error: 'NOT_FOUND' })
      return reply.send(profile)
    }
  )

  // POST /businesses/campaigns/auto — Bot onboarding uchun avtomatik kampaniya
  app.post(
    '/campaigns/auto',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { businessId, title, industryCode, region, budget } = req.body as any

      const campaign = await prisma.campaign.create({
        data: {
          businessId,
          title: title || 'AI Kampaniya',
          status: 'ACTIVE',
          totalBudget: 0,
          aiBrief: { industryCode, region, budget, generatedAt: new Date().toISOString() },
        },
      })

      return reply.status(201).send(campaign)
    }
  )
}

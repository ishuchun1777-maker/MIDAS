// MIDAS API — Match Routes
// packages/api/src/routes/match.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../plugins/prisma'
import { runMatchingEngine } from '../ai/matching.engine'
import { requireRole } from '../middlewares/auth.middleware'

export async function matchRoutes(app: FastifyInstance) {

  /**
   * POST /matches/generate/:campaignId
   * AI matching ishga tushirish
   */
  app.post(
    '/generate/:campaignId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { campaignId } = req.params as { campaignId: string }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { business: true },
      })
      if (!campaign) return reply.status(404).send({ error: 'CAMPAIGN_NOT_FOUND' })

      // Background da ishlatish mumkin, lekin MVP da sync
      const result = await runMatchingEngine({
        campaignId: campaign.id,
        businessId: campaign.businessId,
        industryCode: campaign.business.industryCode,
        businessName: campaign.business.businessName,
        region: campaign.business.region,
        budgetRange: campaign.business.monthlyBudget as any,
        topN: 10,
      })

      return reply.send(result)
    }
  )

  /**
   * GET /matches/campaign/:campaignId
   * Kampaniya uchun saqlangan matchlarni olish
   */
  app.get(
    '/campaign/:campaignId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { campaignId } = req.params as { campaignId: string }
      const { forceRefresh } = req.query as { forceRefresh?: string }

      const matches = await prisma.aiMatch.findMany({
        where: { campaignId, isDismissed: false },
        orderBy: { matchScore: 'desc' },
        include: {
          advertiser: {
            include: {
              user: { select: { fullName: true, telegramUsername: true } },
            },
          },
        },
      })

      if (!matches.length || forceRefresh === 'true') {
        // Qayta generate
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { business: true },
        })
        if (!campaign) return reply.status(404).send({ error: 'NOT_FOUND' })

        const result = await runMatchingEngine({
          campaignId,
          businessId: campaign.businessId,
          industryCode: campaign.business.industryCode,
          businessName: campaign.business.businessName,
          region: campaign.business.region,
          budgetRange: campaign.business.monthlyBudget as any,
        })
        return reply.send(result.matches)
      }

      // Formatlangan response
      const formatted = matches.map(m => ({
        advertiserId: m.advertiserId,
        advertiserName: m.advertiser.user.fullName || m.advertiser.platformHandle,
        platformHandle: m.advertiser.platformHandle,
        advertiserType: m.advertiser.advertiserType,
        followerCount: m.advertiser.followerCount,
        finalScore: Math.round(m.matchScore),
        audienceOverlapScore: Math.round(m.audienceOverlap),
        pricePost: m.advertiser.pricePost ? Number(m.advertiser.pricePost) : null,
        rating: m.advertiser.rating,
        fraudScore: m.advertiser.fraudScore,
        explanation: m.explanation,
        highlights: [],
        isViewed: m.isViewed,
      }))

      return reply.send(formatted)
    }
  )

  /**
   * PATCH /matches/:matchId/dismiss
   * Matchni yopish (foydalanuvchi "qiziqmaydi" dedi)
   */
  app.patch(
    '/:matchId/dismiss',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { matchId } = req.params as { matchId: string }

      await prisma.aiMatch.update({
        where: { id: matchId },
        data: { isDismissed: true },
      })

      return reply.send({ success: true })
    }
  )

  /**
   * PATCH /matches/:matchId/view
   * Ko'rilgan deb belgilash
   */
  app.patch(
    '/:matchId/view',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { matchId } = req.params as { matchId: string }

      await prisma.aiMatch.update({
        where: { id: matchId },
        data: { isViewed: true },
      })

      return reply.send({ success: true })
    }
  )

  /**
   * GET /matches/advertiser/:advertiserId/stats
   * Reklamachi uchun matching statistikasi
   */
  app.get(
    '/advertiser/:advertiserId/stats',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { advertiserId } = req.params as { advertiserId: string }

      const stats = await prisma.aiMatch.aggregate({
        where: { advertiserId },
        _count: { id: true },
        _avg: { matchScore: true },
      })

      const viewed = await prisma.aiMatch.count({
        where: { advertiserId, isViewed: true },
      })

      return reply.send({
        totalMatches: stats._count.id,
        avgScore: Math.round(stats._avg.matchScore || 0),
        viewedCount: viewed,
        viewRate: stats._count.id > 0
          ? Math.round((viewed / stats._count.id) * 100)
          : 0,
      })
    }
  )
}

// MIDAS AI — Matching Orchestrator
// packages/api/src/ai/matching.engine.ts

import { prisma } from '../plugins/prisma'
import { redis, cacheGet, cacheSet, AI_MATCH_CACHE_TTL } from '../plugins/redis'
import { analyzeIndustry } from './layers/layer1.industry'
import { rankAdvertisersByOverlap, AdvertiserAudienceData } from './layers/layer2.overlap'
import { scoreAndRankAdvertisers, AdvertiserForScoring } from './layers/layer3.scoring'
import { calculateFraudScore } from './fraud/fraud.detector'
import { MIDAS } from './shared'

export interface MatchingInput {
  campaignId: string
  businessId: string
  industryCode: string
  businessName: string
  description?: string
  region: string
  budgetRange: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE'
  topN?: number
}

export interface MatchingResult {
  campaignId: string
  matches: MatchedAdvertiser[]
  audienceProfile: object
  totalCandidates: number
  generatedAt: string
}

export interface MatchedAdvertiser {
  advertiserId: string
  advertiserName: string
  platformHandle: string | null
  advertiserType: string
  followerCount: number
  finalScore: number
  audienceOverlapScore: number
  pricePost: number | null
  rating: number
  fraudScore: number
  explanation: { uz: string; ru: string; en: string }
  highlights: string[]
  matchedInterests: string[]
  matchedRegions: string[]
}

/**
 * Asosiy matching funktsiya — 3 qatlamni koordinatsiya qiladi
 */
export async function runMatchingEngine(input: MatchingInput): Promise<MatchingResult> {
  const cacheKey = `ai:match:${input.campaignId}`

  // Cache tekshiruv
  const cached = await cacheGet<MatchingResult>(cacheKey)
  if (cached) return cached

  const topN = input.topN || 10
  const startTime = Date.now()

  // ── Layer 1: Soha tahlili ─────────────────
  const industryAnalysis = await analyzeIndustry({
    industryCode: input.industryCode,
    businessName: input.businessName,
    description: input.description,
    region: input.region,
    budgetRange: input.budgetRange,
  })

  // ── Reklamachilarni DB dan olamiz ─────────
  const rawAdvertisers = await prisma.advertiserProfile.findMany({
    where: {
      verificationStatus: 'APPROVED',
      fraudScore: { gte: MIDAS.FRAUD_SUSPEND_THRESHOLD },
    },
    include: {
      user: { select: { fullName: true, telegramUsername: true } },
    },
  })

  if (!rawAdvertisers.length) {
    return {
      campaignId: input.campaignId,
      matches: [],
      audienceProfile: industryAnalysis.audienceProfile,
      totalCandidates: 0,
      generatedAt: new Date().toISOString(),
    }
  }

  // ── Layer 2: Auditoriya overlap ───────────
  const audienceData: AdvertiserAudienceData[] = rawAdvertisers.map(adv => {
    const aud = adv.audienceData as any
    return {
      id: adv.id,
      age_min: aud?.age_min || 18,
      age_max: aud?.age_max || 45,
      gender_split: aud?.gender_split || { male: 50, female: 50 },
      top_regions: aud?.top_regions || ['tashkent'],
      interests: aud?.interests || [],
      income_level: aud?.income_level || 'medium',
      followerCount: adv.followerCount,
      advertiserType: adv.advertiserType,
    }
  })

  const overlapResults = rankAdvertisersByOverlap(
    industryAnalysis.audienceProfile,
    audienceData
  )

  // ── Layer 3: Yakuniy skoring ──────────────
  const scoringData: AdvertiserForScoring[] = rawAdvertisers.map(adv => ({
    id: adv.id,
    rating: adv.rating,
    reviewsCount: adv.reviewsCount,
    fraudScore: adv.fraudScore,
    pricePost: adv.pricePost ? Number(adv.pricePost) : null,
    priceStory: adv.priceStory ? Number(adv.priceStory) : null,
    followerCount: adv.followerCount,
    dealsCount: adv.dealsCount,
    successRate: adv.successRate,
    advertiserType: adv.advertiserType,
    platformHandle: adv.platformHandle,
    user: adv.user,
  }))

  const scoredResults = scoreAndRankAdvertisers(
    scoringData,
    overlapResults,
    { budgetRange: input.budgetRange },
    industryAnalysis,
    topN
  )

  // ── Natijalarni formatlash ────────────────
  const advertiserMap = new Map(rawAdvertisers.map(a => [a.id, a]))

  const matches: MatchedAdvertiser[] = scoredResults.map(scored => {
    const adv = advertiserMap.get(scored.advertiserId)!
    return {
      advertiserId: adv.id,
      advertiserName: adv.user.fullName || adv.user.telegramUsername || 'Reklamachi',
      platformHandle: adv.platformHandle,
      advertiserType: adv.advertiserType,
      followerCount: adv.followerCount,
      finalScore: scored.finalScore,
      audienceOverlapScore: scored.audienceOverlapScore,
      pricePost: adv.pricePost ? Number(adv.pricePost) : null,
      rating: adv.rating,
      fraudScore: adv.fraudScore,
      explanation: scored.explanation,
      highlights: scored.highlights,
      matchedInterests: scored.overlapDetails.matchedInterests,
      matchedRegions: scored.overlapDetails.matchedRegions,
    }
  })

  // ── DB ga saqlash ─────────────────────────
  await saveMatchesToDB(input.campaignId, scoredResults)

  const result: MatchingResult = {
    campaignId: input.campaignId,
    matches,
    audienceProfile: industryAnalysis.audienceProfile,
    totalCandidates: rawAdvertisers.length,
    generatedAt: new Date().toISOString(),
  }

  // Cache (30 daqiqa)
  await cacheSet(cacheKey, result, AI_MATCH_CACHE_TTL)

  console.log(
    `[AI] Matching done: campaign=${input.campaignId}, ` +
    `candidates=${rawAdvertisers.length}, matches=${matches.length}, ` +
    `time=${Date.now() - startTime}ms`
  )

  return result
}

// ─── DB ga saqlash ────────────────────────
async function saveMatchesToDB(
  campaignId: string,
  scored: Awaited<ReturnType<typeof scoreAndRankAdvertisers>>
) {
  // Avvalgi matchlarni o'chiramiz
  await prisma.aiMatch.deleteMany({ where: { campaignId } })

  // Yangilarini batch insert
  await prisma.aiMatch.createMany({
    data: scored.map(s => ({
      campaignId,
      advertiserId: s.advertiserId,
      matchScore: s.finalScore,
      audienceOverlap: s.audienceOverlapScore,
      ratingScore: s.ratingScore,
      priceFitScore: s.priceFitScore,
      fraudPenalty: s.fraudPenalty,
      explanation: s.explanation as any,
    })),
  })
}

/**
 * Haftalik fraud scan — BullMQ job tomonidan chaqiriladi
 */
export async function runWeeklyFraudScan() {
  const advertisers = await prisma.advertiserProfile.findMany({
    where: { verificationStatus: 'APPROVED' },
    select: {
      id: true, followerCount: true, engagementRate: true,
      advertiserType: true, pricePost: true, dealsCount: true,
    },
  })

  const updates: Array<{ id: string; fraudScore: number }> = []

  for (const adv of advertisers) {
    const result = calculateFraudScore({
      followerCount: adv.followerCount,
      engagementRate: adv.engagementRate,
      advertiserType: adv.advertiserType,
      pricePost: adv.pricePost ? Number(adv.pricePost) : null,
      dealsCount: adv.dealsCount,
    })
    updates.push({ id: adv.id, fraudScore: result.score })
  }

  // Batch update
  for (const update of updates) {
    await prisma.advertiserProfile.update({
      where: { id: update.id },
      data: {
        fraudScore: update.fraudScore,
        // Fraud juda past bo'lsa — suspend
        verificationStatus: update.fraudScore < MIDAS.FRAUD_SUSPEND_THRESHOLD
          ? 'PENDING'  // Admin tekshirsin
          : undefined,
      },
    })
  }

  console.log(`[FRAUD SCAN] Updated ${updates.length} advertiser fraud scores`)
  return updates.length
}

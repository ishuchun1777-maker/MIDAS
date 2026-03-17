// MIDAS AI — Layer 3: Yakuniy Skoring + Tushuntirish
// packages/api/src/ai/layers/layer3.scoring.ts

import { OverlapResult } from './layer2.overlap'
import { IndustryAnalysisOutput } from './layer1.industry'
import { calcPlatformFee } from '../../shared'

// Og'irliklar (skill fayldan: 40/25/20/15)
const SCORE_WEIGHTS = {
  audienceOverlap: 0.40,
  rating:          0.25,
  priceFit:        0.20,
  fraudInverse:    0.15,  // Fraud past = yaxshi, shuning uchun teskari
}

export interface AdvertiserForScoring {
  id: string
  rating: number           // 0–5
  reviewsCount: number
  fraudScore: number       // 0–100 (yuqori = yaxshi)
  pricePost: number | null
  priceStory: number | null
  followerCount: number
  dealsCount: number
  successRate: number      // 0–100
  advertiserType: string
  platformHandle: string | null
  user: { fullName: string | null; telegramUsername: string | null }
}

export interface BudgetContext {
  budgetRange: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE'
}

const BUDGET_MAX: Record<string, number> = {
  SMALL: 500_000,
  MEDIUM: 2_000_000,
  LARGE: 10_000_000,
  ENTERPRISE: 50_000_000,
}

export interface ScoredAdvertiser {
  advertiserId: string
  finalScore: number       // 0–100
  audienceOverlapScore: number
  ratingScore: number
  priceFitScore: number
  fraudPenalty: number
  explanation: {
    uz: string
    ru: string
    en: string
  }
  highlights: string[]     // UI uchun kalit jihatlar
  overlapDetails: OverlapResult
}

export function scoreAdvertiser(
  advertiser: AdvertiserForScoring,
  overlapResult: OverlapResult,
  budget: BudgetContext,
  industryAnalysis: IndustryAnalysisOutput
): ScoredAdvertiser {

  // 1. Auditoriya overlap (Layer 2 natijasi)
  const audienceScore = overlapResult.overlapScore // 0–100

  // 2. Reyting bali (0–100 ga normalize)
  const ratingScore = calcRatingScore(advertiser)

  // 3. Narx/byudjet mosligi (0–100)
  const priceFitScore = calcPriceFitScore(advertiser, budget)

  // 4. Fraud penaltisi (teskari: yuqori fraud score = past penalti)
  const fraudPenalty = Math.max(0, 100 - advertiser.fraudScore)
  const fraudScore = advertiser.fraudScore // Yuqori = yaxshi

  // Yakuniy weighted ball
  const finalScore = Math.round(
    audienceScore     * SCORE_WEIGHTS.audienceOverlap +
    ratingScore       * SCORE_WEIGHTS.rating +
    priceFitScore     * SCORE_WEIGHTS.priceFit +
    fraudScore        * SCORE_WEIGHTS.fraudInverse
  )

  // Tushuntirish generatsiya
  const explanation = generateExplanation(
    advertiser, overlapResult, ratingScore, priceFitScore, industryAnalysis
  )

  const highlights = generateHighlights(
    advertiser, overlapResult, ratingScore, priceFitScore
  )

  return {
    advertiserId: advertiser.id,
    finalScore: Math.min(100, Math.max(0, finalScore)),
    audienceOverlapScore: audienceScore,
    ratingScore,
    priceFitScore,
    fraudPenalty,
    explanation,
    highlights,
    overlapDetails: overlapResult,
  }
}

// ─── Sub-calculations ─────────────────────

function calcRatingScore(adv: AdvertiserForScoring): number {
  if (adv.reviewsCount === 0) return 50 // Yangi — neutral ball

  // 0–5 reytingni 0–100 ga normalize
  const ratingNorm = (adv.rating / 5) * 100

  // Ko'p sharh = ishonchlilik
  const reviewBonus = Math.min(20, adv.reviewsCount * 2)

  // Success rate bonus
  const successBonus = (adv.successRate / 100) * 10

  return Math.min(100, ratingNorm + reviewBonus + successBonus - 20) // -20 base
}

function calcPriceFitScore(
  adv: AdvertiserForScoring,
  budget: BudgetContext
): number {
  const maxBudget = BUDGET_MAX[budget.budgetRange] || BUDGET_MAX.MEDIUM
  const price = adv.pricePost || 0

  if (price === 0) return 50 // Narx ko'rsatilmagan — neutral

  // Byudjetning 20–60% oralig'idagi narx ideal
  const idealMin = maxBudget * 0.10
  const idealMax = maxBudget * 0.60

  if (price >= idealMin && price <= idealMax) {
    // Ideal oraliqda — yuqori ball
    return 90 - ((price - idealMin) / (idealMax - idealMin)) * 20
  }

  if (price < idealMin) {
    // Juda arzon — ishonchlilik kamroq
    return 60 + (price / idealMin) * 30
  }

  // Juda qimmat — byudjetga sig'masligi mumkin
  if (price > maxBudget) return 0
  return Math.max(0, 100 - ((price - idealMax) / (maxBudget - idealMax)) * 100)
}

// ─── Tushuntirish generatsiya ─────────────

function generateExplanation(
  adv: AdvertiserForScoring,
  overlap: OverlapResult,
  ratingScore: number,
  priceFitScore: number,
  industry: IndustryAnalysisOutput
): { uz: string; ru: string; en: string } {
  const name = adv.user.fullName || adv.user.telegramUsername || 'Reklamachi'
  const handle = adv.platformHandle ? `@${adv.platformHandle}` : ''
  const overlapPct = overlap.overlapScore
  const regions = overlap.matchedRegions.slice(0, 2).join(', ') || '—'
  const interests = overlap.matchedInterests.slice(0, 3).join(', ') || '—'

  return {
    uz: `${name} ${handle} — auditoriyasi "${industry.industryName.uz}" sohasiga ${overlapPct}% mos. ` +
        `Mos hududlar: ${regions}. Umumiy qiziqishlar: ${interests}. ` +
        (adv.reviewsCount > 0 ? `Reyting: ${adv.rating.toFixed(1)}/5 (${adv.reviewsCount} sharh). ` : 'Yangi reklamachi. ') +
        (priceFitScore > 70 ? 'Narxi byudjetingizga mos.' : 'Narxini muzokaraga kiritish mumkin.'),

    ru: `${name} ${handle} — аудитория подходит сфере "${industry.industryName.ru}" на ${overlapPct}%. ` +
        `Совпадающие регионы: ${regions}. Общие интересы: ${interests}. ` +
        (adv.reviewsCount > 0 ? `Рейтинг: ${adv.rating.toFixed(1)}/5 (${adv.reviewsCount} отзывов). ` : 'Новый рекламщик. ') +
        (priceFitScore > 70 ? 'Цена подходит под ваш бюджет.' : 'Цену можно обсудить.'),

    en: `${name} ${handle} — audience matches "${industry.industryName.en}" industry by ${overlapPct}%. ` +
        `Matching regions: ${regions}. Shared interests: ${interests}. ` +
        (adv.reviewsCount > 0 ? `Rating: ${adv.rating.toFixed(1)}/5 (${adv.reviewsCount} reviews). ` : 'New advertiser. ') +
        (priceFitScore > 70 ? 'Price fits your budget.' : 'Price is negotiable.'),
  }
}

function generateHighlights(
  adv: AdvertiserForScoring,
  overlap: OverlapResult,
  ratingScore: number,
  priceFitScore: number
): string[] {
  const highlights: string[] = []

  if (overlap.overlapScore >= 80) highlights.push('top_match')
  if (overlap.regionOverlap >= 80) highlights.push('same_region')
  if (overlap.interestOverlap >= 70) highlights.push('strong_interests')
  if (adv.rating >= 4.5 && adv.reviewsCount >= 5) highlights.push('top_rated')
  if (adv.fraudScore >= 85) highlights.push('trusted')
  if (priceFitScore >= 80) highlights.push('budget_fit')
  if (adv.dealsCount >= 10) highlights.push('experienced')
  if (adv.reviewsCount === 0) highlights.push('new_advertiser')
  if (adv.followerCount >= 100_000) highlights.push('large_audience')

  return highlights
}

// ─── Batch scoring ─────────────────────────

export function scoreAndRankAdvertisers(
  advertisers: AdvertiserForScoring[],
  overlapResults: OverlapResult[],
  budget: BudgetContext,
  industryAnalysis: IndustryAnalysisOutput,
  topN: number = 10
): ScoredAdvertiser[] {
  const overlapMap = new Map(overlapResults.map(r => [r.advertiserId, r]))

  return advertisers
    .map(adv => {
      const overlap = overlapMap.get(adv.id)
      if (!overlap) return null
      return scoreAdvertiser(adv, overlap, budget, industryAnalysis)
    })
    .filter(Boolean)
    .sort((a, b) => b!.finalScore - a!.finalScore)
    .slice(0, topN) as ScoredAdvertiser[]
}


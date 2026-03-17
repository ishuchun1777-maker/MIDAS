// MIDAS AI — Layer 2: Auditoriya Overlap
// packages/api/src/ai/layers/layer2.overlap.ts

import { AudienceTemplate } from '../industry.ontology'

export interface AdvertiserAudienceData {
  id: string
  age_min: number
  age_max: number
  gender_split: { male: number; female: number }
  top_regions: string[]
  interests: string[]
  income_level: string
  followerCount: number
  advertiserType: string
}

export interface OverlapResult {
  advertiserId: string
  overlapScore: number        // 0–100
  ageOverlap: number          // 0–100
  genderOverlap: number       // 0–100
  regionOverlap: number       // 0–100
  interestOverlap: number     // 0–100
  platformBonus: number       // 0–20 (platforma mos kelsa bonus)
  matchedInterests: string[]
  matchedRegions: string[]
}

// Og'irliklar (jami = 1.0)
const WEIGHTS = {
  age:      0.25,
  gender:   0.20,
  region:   0.30,
  interest: 0.25,
}

/**
 * Layer 2: Biznes auditoriyasi vs Reklamachi auditoriyasi overlap hisoblash
 * Weighted cosine similarity yondashuvi
 */
export function calculateAudienceOverlap(
  targetAudience: AudienceTemplate,
  advertiserAudience: AdvertiserAudienceData
): OverlapResult {

  // 1. Yosh overlap
  const ageOverlap = calcAgeOverlap(
    { min: targetAudience.age_min, max: targetAudience.age_max },
    { min: advertiserAudience.age_min, max: advertiserAudience.age_max }
  )

  // 2. Jins overlap
  const genderOverlap = calcGenderOverlap(
    targetAudience.gender,
    targetAudience.gender === 'male'
      ? { male: 70, female: 30 }
      : targetAudience.gender === 'female'
      ? { male: 25, female: 75 }
      : { male: 50, female: 50 },
    advertiserAudience.gender_split
  )

  // 3. Hudud overlap
  const { score: regionOverlap, matched: matchedRegions } = calcRegionOverlap(
    targetAudience.top_regions,
    advertiserAudience.top_regions
  )

  // 4. Qiziqishlar overlap
  const { score: interestOverlap, matched: matchedInterests } = calcInterestOverlap(
    targetAudience.interests,
    advertiserAudience.interests
  )

  // 5. Platforma bonus
  const platformBonus = calcPlatformBonus(
    targetAudience,
    advertiserAudience.advertiserType
  )

  // Yakuniy weighted score
  const rawScore =
    ageOverlap      * WEIGHTS.age +
    genderOverlap   * WEIGHTS.gender +
    regionOverlap   * WEIGHTS.region +
    interestOverlap * WEIGHTS.interest

  const overlapScore = Math.min(100, Math.round(rawScore + platformBonus))

  return {
    advertiserId: advertiserAudience.id,
    overlapScore,
    ageOverlap: Math.round(ageOverlap),
    genderOverlap: Math.round(genderOverlap),
    regionOverlap: Math.round(regionOverlap),
    interestOverlap: Math.round(interestOverlap),
    platformBonus: Math.round(platformBonus),
    matchedInterests,
    matchedRegions,
  }
}

// ─── Sub-calculations ─────────────────────

function calcAgeOverlap(
  target: { min: number; max: number },
  advertiser: { min: number; max: number }
): number {
  // Intersection / Union
  const intersectMin = Math.max(target.min, advertiser.min)
  const intersectMax = Math.min(target.max, advertiser.max)

  if (intersectMin > intersectMax) return 0

  const intersection = intersectMax - intersectMin
  const unionMin = Math.min(target.min, advertiser.min)
  const unionMax = Math.max(target.max, advertiser.max)
  const union = unionMax - unionMin

  if (union === 0) return 100
  return (intersection / union) * 100
}

function calcGenderOverlap(
  targetGender: string,
  targetSplit: { male: number; female: number },
  advertiserSplit: { male: number; female: number }
): number {
  if (targetGender === 'mixed') {
    // Aralash auditoriya uchun — farq qancha kichik bo'lsa, shuncha yaxshi
    const diff = Math.abs(targetSplit.male - advertiserSplit.male)
    return Math.max(0, 100 - diff * 1.5)
  }

  if (targetGender === 'male') {
    return advertiserSplit.male  // Reklama erkaklar ga — reklamachilar erkaklar nechta %
  }

  return advertiserSplit.female   // Reklama ayollar ga
}

function calcRegionOverlap(
  targetRegions: string[],
  advertiserRegions: string[]
): { score: number; matched: string[] } {
  if (!targetRegions.length || !advertiserRegions.length) {
    return { score: 50, matched: [] } // Ma'lumot yo'q — neutral
  }

  const matched = targetRegions.filter(r => advertiserRegions.includes(r))
  if (!matched.length) return { score: 0, matched: [] }

  // Birinchi region (asosiy) mos kelsa — bonus
  const primaryBonus = advertiserRegions[0] === targetRegions[0] ? 20 : 0
  const baseScore = (matched.length / targetRegions.length) * 80

  return { score: Math.min(100, baseScore + primaryBonus), matched }
}

function calcInterestOverlap(
  targetInterests: string[],
  advertiserInterests: string[]
): { score: number; matched: string[] } {
  if (!targetInterests.length || !advertiserInterests.length) {
    return { score: 40, matched: [] } // Neutral
  }

  // Exact match + partial match
  const exactMatched = targetInterests.filter(i =>
    advertiserInterests.some(ai => ai === i)
  )
  const partialMatched = targetInterests.filter(i =>
    !exactMatched.includes(i) &&
    advertiserInterests.some(ai => ai.includes(i) || i.includes(ai))
  )

  const exactScore  = (exactMatched.length / targetInterests.length) * 100
  const partialScore = (partialMatched.length / targetInterests.length) * 50

  const score = Math.min(100, exactScore + partialScore)
  return { score, matched: [...exactMatched, ...partialMatched] }
}

function calcPlatformBonus(
  audience: AudienceTemplate,
  advertiserType: string
): number {
  // Biznes sohasining eng mos platformasi reklamachi platformasiga mos kelsa bonus
  if (!audience.best_platforms) return 0
  const idx = audience.best_platforms.indexOf(advertiserType)
  if (idx === 0) return 15  // Birinchi tanlov — eng yuqori bonus
  if (idx === 1) return 8   // Ikkinchi tanlov
  if (idx === 2) return 4   // Uchinchi tanlov
  return 0
}

// ─── Batch processing ─────────────────────

export function rankAdvertisersByOverlap(
  targetAudience: AudienceTemplate,
  advertisers: AdvertiserAudienceData[]
): OverlapResult[] {
  return advertisers
    .map(adv => calculateAudienceOverlap(targetAudience, adv))
    .sort((a, b) => b.overlapScore - a.overlapScore)
}

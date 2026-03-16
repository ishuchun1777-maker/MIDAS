// MIDAS — AI Matching Tests
// packages/api/src/ai/__tests__/matching.test.ts

import { calculateAudienceOverlap } from '../layers/layer2.overlap'
import { scoreAdvertiser } from '../layers/layer3.scoring'
import { calculateFraudScore } from '../fraud/fraud.detector'
import { getIndustryByCode, findIndustryByKeyword } from '../industry.ontology'

// ─── Layer 1 Tests ────────────────────────

describe('Industry Ontology', () => {
  test('restoran kodi topiladi', () => {
    const industry = getIndustryByCode('restaurant')
    expect(industry).toBeDefined()
    expect(industry!.code).toBe('restaurant')
    expect(industry!.audience.age_min).toBe(18)
  })

  test("kalit so'z bilan topiladi", () => {
    const industry = findIndustryByKeyword('restoran')
    expect(industry).toBeDefined()
    expect(industry!.code).toBe('restaurant')
  })

  test("mavjud bo'lmagan soha undefined qaytaradi", () => {
    const industry = getIndustryByCode('nonexistent_code')
    expect(industry).toBeUndefined()
  })
})

// ─── Layer 2 Tests ────────────────────────

describe('Audience Overlap Calculation', () => {
  const targetAudience = {
    age_min: 18, age_max: 45,
    gender: 'female' as const,
    gender_split: { male: 20, female: 80 },
    top_regions: ['tashkent', 'samarkand'],
    interests: ['beauty', 'fashion', 'lifestyle', 'shopping'],
    income_level: 'medium' as const,
    engagement_pattern: 'daily' as const,
    best_platforms: ['INSTAGRAM', 'TIKTOK'],
    peak_hours: ['20:00-23:00'],
  }

  test('to\'liq mos reklamachi yuqori ball oladi', () => {
    const advertiser = {
      id: 'adv1',
      age_min: 18, age_max: 40,
      gender_split: { male: 15, female: 85 },
      top_regions: ['tashkent', 'samarkand'],
      interests: ['beauty', 'makeup', 'fashion', 'skincare'],
      income_level: 'medium',
      followerCount: 50000,
      advertiserType: 'INSTAGRAM',
    }

    const result = calculateAudienceOverlap(targetAudience, advertiser)
    expect(result.overlapScore).toBeGreaterThan(75)
    expect(result.matchedRegions).toContain('tashkent')
    expect(result.matchedInterests).toContain('beauty')
  })

  test("mos bo'lmagan reklamachi past ball oladi", () => {
    const advertiser = {
      id: 'adv2',
      age_min: 40, age_max: 65,
      gender_split: { male: 80, female: 20 },
      top_regions: ['kashkadarya', 'surkhandarya'],
      interests: ['cars', 'tech', 'gaming', 'mechanics'],
      income_level: 'high',
      followerCount: 20000,
      advertiserType: 'YOUTUBE',
    }

    const result = calculateAudienceOverlap(targetAudience, advertiser)
    expect(result.overlapScore).toBeLessThan(40)
  })

  test('yosh overlap to\'g\'ri hisoblanadi', () => {
    const advPerfect = {
      id: 'adv3',
      age_min: 18, age_max: 45,
      gender_split: { male: 50, female: 50 },
      top_regions: ['tashkent'],
      interests: [],
      income_level: 'medium',
      followerCount: 10000,
      advertiserType: 'TELEGRAM_CHANNEL',
    }
    const result = calculateAudienceOverlap(targetAudience, advPerfect)
    expect(result.ageOverlap).toBe(100) // To'liq mos
  })
})

// ─── Fraud Detection Tests ─────────────────

describe('Fraud Detection', () => {
  test('normal reklamachi yaxshi ball oladi', () => {
    const result = calculateFraudScore({
      followerCount: 48000,
      engagementRate: 8.5,  // Instagram uchun normal
      advertiserType: 'INSTAGRAM',
      pricePost: 1500000,
      dealsCount: 5,
    })
    expect(result.score).toBeGreaterThan(70)
    expect(result.level).toBe('normal')
  })

  test("juda past engagement fraud belgisi", () => {
    const result = calculateFraudScore({
      followerCount: 100000,
      engagementRate: 0.1,  // Juda past
      advertiserType: 'INSTAGRAM',
      pricePost: 500000,
      dealsCount: 0,
    })
    expect(result.level).toBeOneOf(['suspicious', 'high_risk'])
    expect(result.flags.some(f => f.code === 'GHOST_FOLLOWERS' || f.code === 'LOW_ENGAGEMENT')).toBe(true)
  })

  test('billboard uchun yuqori ishonch bali', () => {
    const result = calculateFraudScore({
      followerCount: 0,
      engagementRate: 0,
      advertiserType: 'BILLBOARD',
      pricePost: 5000000,
      dealsCount: 0,
    })
    expect(result.score).toBe(85)
    expect(result.level).toBe('trusted')
  })

  test('tajribali reklamachi bonus oladi', () => {
    const newbie = calculateFraudScore({
      followerCount: 20000, engagementRate: 5,
      advertiserType: 'TELEGRAM_CHANNEL',
      pricePost: 500000, dealsCount: 0,
    })
    const experienced = calculateFraudScore({
      followerCount: 20000, engagementRate: 5,
      advertiserType: 'TELEGRAM_CHANNEL',
      pricePost: 500000, dealsCount: 10,
    })
    expect(experienced.score).toBeGreaterThan(newbie.score)
  })
})

// ─── Layer 3 Tests ────────────────────────

describe('Final Scoring', () => {
  const mockIndustryAnalysis = {
    industryCode: 'beauty',
    industryName: { uz: "Go'zallik", ru: 'Красота', en: 'Beauty' },
    audienceProfile: {
      age_min: 16, age_max: 45, gender: 'female' as const,
      gender_split: { male: 8, female: 92 },
      top_regions: ['tashkent'],
      interests: ['beauty', 'makeup', 'skincare'],
      income_level: 'medium' as const,
      engagement_pattern: 'daily' as const,
      best_platforms: ['INSTAGRAM'],
      peak_hours: [],
    },
    matchingKeywords: ['beauty'],
    reasoning: 'test',
    confidence: 0.9,
  }

  test('yaxshi reklamachi 70+ ball oladi', () => {
    const adv = {
      id: 'test1',
      rating: 4.8, reviewsCount: 20,
      fraudScore: 90, pricePost: 800000, priceStory: 400000,
      followerCount: 45000, dealsCount: 15, successRate: 95,
      advertiserType: 'INSTAGRAM', platformHandle: 'test_beauty',
      user: { fullName: 'Test User', telegramUsername: 'testuser' },
    }
    const overlap = {
      advertiserId: 'test1',
      overlapScore: 85, ageOverlap: 90, genderOverlap: 95,
      regionOverlap: 100, interestOverlap: 80, platformBonus: 15,
      matchedInterests: ['beauty', 'makeup'],
      matchedRegions: ['tashkent'],
    }

    const result = scoreAdvertiser(adv, overlap, { budgetRange: 'MEDIUM' }, mockIndustryAnalysis)
    expect(result.finalScore).toBeGreaterThan(70)
    expect(result.explanation.uz).toContain('beauty')
  })

  test("fraud score past bo'lsa final score pasayadi", () => {
    const goodAdv = { id: 'g1', rating: 4.5, reviewsCount: 10, fraudScore: 90, pricePost: 800000, priceStory: null, followerCount: 30000, dealsCount: 5, successRate: 90, advertiserType: 'INSTAGRAM', platformHandle: null, user: { fullName: null, telegramUsername: 'test' } }
    const badAdv  = { id: 'b1', rating: 4.5, reviewsCount: 10, fraudScore: 20, pricePost: 800000, priceStory: null, followerCount: 30000, dealsCount: 5, successRate: 90, advertiserType: 'INSTAGRAM', platformHandle: null, user: { fullName: null, telegramUsername: 'test' } }
    const overlap = { advertiserId: 'x', overlapScore: 80, ageOverlap: 80, genderOverlap: 80, regionOverlap: 80, interestOverlap: 80, platformBonus: 10, matchedInterests: [], matchedRegions: [] }

    const goodResult = scoreAdvertiser(goodAdv, { ...overlap, advertiserId: 'g1' }, { budgetRange: 'MEDIUM' }, mockIndustryAnalysis)
    const badResult  = scoreAdvertiser(badAdv,  { ...overlap, advertiserId: 'b1' }, { budgetRange: 'MEDIUM' }, mockIndustryAnalysis)

    expect(goodResult.finalScore).toBeGreaterThan(badResult.finalScore)
  })
})

// MIDAS AI — Fraud Detection Service
// packages/api/src/ai/fraud/fraud.detector.ts

export interface FraudInput {
  followerCount: number
  engagementRate: number        // % (0–100)
  advertiserType: string
  pricePost: number | null
  dealsCount: number
  accountAgeDays?: number       // Akkount necha kunlik
  followingCount?: number       // Nechta odamni kuzatadi
}

export interface FraudResult {
  score: number                 // 0–100 (100 = to'liq ishonchli)
  level: 'trusted' | 'normal' | 'suspicious' | 'high_risk'
  flags: FraudFlag[]
  details: string
}

export interface FraudFlag {
  code: string
  description: string
  penalty: number               // Ball ayiriladi
}

// Engagement rate normallar (platforma bo'yicha)
const EXPECTED_ENGAGEMENT: Record<string, { min: number; max: number; ideal: number }> = {
  TELEGRAM_CHANNEL: { min: 5, max: 80, ideal: 20 },
  INSTAGRAM:        { min: 1, max: 15, ideal: 4 },
  YOUTUBE:          { min: 2, max: 20, ideal: 6 },
  TIKTOK:           { min: 3, max: 30, ideal: 8 },
  BILLBOARD:        { min: 0, max: 100, ideal: 50 }, // Billboard uchun fraud kam
  LED_SCREEN:       { min: 0, max: 100, ideal: 50 },
}

export function calculateFraudScore(input: FraudInput): FraudResult {
  const flags: FraudFlag[] = []
  let baseScore = 100

  const expected = EXPECTED_ENGAGEMENT[input.advertiserType] || { min: 1, max: 20, ideal: 5 }

  // ─── 1. Engagement rate tekshiruvi ───────
  if (input.engagementRate > 0) {
    if (input.engagementRate < expected.min * 0.5) {
      flags.push({
        code: 'LOW_ENGAGEMENT',
        description: `Engagement rate juda past (${input.engagementRate.toFixed(1)}%)`,
        penalty: 30,
      })
    } else if (input.engagementRate > expected.max * 2) {
      flags.push({
        code: 'ABNORMAL_HIGH_ENGAGEMENT',
        description: `Engagement rate g'ayritabiiy yuqori (${input.engagementRate.toFixed(1)}%)`,
        penalty: 20,
      })
    }
  }

  // ─── 2. Followers/Following nisbati ──────
  if (input.followingCount && input.followerCount > 0) {
    const ratio = input.followerCount / (input.followingCount + 1)
    if (ratio < 0.1) {
      flags.push({
        code: 'FOLLOW_UNFOLLOW',
        description: 'Followers/Following nisbati shubhali (follow-unfollow taktika)',
        penalty: 25,
      })
    }
  }

  // ─── 3. Narx/follower nisbati ─────────────
  if (input.pricePost && input.followerCount > 0) {
    const cpm = (input.pricePost / input.followerCount) * 1000 // 1000 follower uchun

    // O'zbekiston uchun normal CPM: 3000 – 15000 so'm
    if (cpm < 500) {
      flags.push({
        code: 'SUSPICIOUSLY_LOW_PRICE',
        description: `CPM juda past (${cpm.toFixed(0)} so'm), soxta followerlar bo'lishi mumkin`,
        penalty: 20,
      })
    } else if (cpm > 50_000) {
      flags.push({
        code: 'SUSPICIOUSLY_HIGH_PRICE',
        description: `CPM juda yuqori (${cpm.toFixed(0)} so'm)`,
        penalty: 5, // Kam penalti — shunchaki qimmat bo'lishi mumkin
      })
    }
  }

  // ─── 4. Juda yangi akkount ────────────────
  if (input.accountAgeDays !== undefined && input.accountAgeDays < 30) {
    flags.push({
      code: 'NEW_ACCOUNT',
      description: `Akkount ${input.accountAgeDays} kunlik — ishonch past`,
      penalty: 15,
    })
  }

  // ─── 5. Follower soni va engagement birga ─
  if (input.followerCount > 100_000 && input.engagementRate < 0.5) {
    flags.push({
      code: 'GHOST_FOLLOWERS',
      description: 'Ko\'p follower, juda past engagement — soxta follower belgilari',
      penalty: 35,
    })
  }

  // Billboard/LED uchun fraud kam tekshiruv kerak
  if (['BILLBOARD', 'LED_SCREEN'].includes(input.advertiserType)) {
    // Fizik reklama — fraud risk past
    return {
      score: 85,
      level: 'trusted',
      flags: [],
      details: 'Fizik reklama uchun standart ishonch bali',
    }
  }

  // Jami penaltini chegiramiz
  const totalPenalty = flags.reduce((sum, f) => sum + f.penalty, 0)
  const finalScore = Math.max(0, Math.min(100, baseScore - totalPenalty))

  // Tajriba bonusi: ko'p muvaffaqiyatli bitim = ishonch oshadi
  const experienceBonus = Math.min(15, input.dealsCount * 1.5)
  const scoreWithBonus = Math.min(100, finalScore + experienceBonus)

  const level =
    scoreWithBonus >= 80 ? 'trusted' :
    scoreWithBonus >= 60 ? 'normal' :
    scoreWithBonus >= 40 ? 'suspicious' : 'high_risk'

  return {
    score: Math.round(scoreWithBonus),
    level,
    flags,
    details: flags.length === 0
      ? 'Shubhali belgilar aniqlanmadi'
      : `${flags.length} ta shubhali belgi topildi`,
  }
}

// ─── Haftalik batch fraud scan ─────────────
export async function batchFraudScan(
  advertisers: Array<FraudInput & { id: string }>
): Promise<Map<string, FraudResult>> {
  const results = new Map<string, FraudResult>()

  for (const adv of advertisers) {
    results.set(adv.id, calculateFraudScore(adv))
  }

  return results
}

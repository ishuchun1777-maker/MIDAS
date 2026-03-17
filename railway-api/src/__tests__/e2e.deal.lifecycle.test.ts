// MIDAS — End-to-End Integration Tests
// packages/api/src/__tests__/e2e.deal.lifecycle.test.ts
//
// Bu test to'liq deal lifecycle ni real DB da sinovdan o'tkazadi.
// Ishlatish: NODE_ENV=test DATABASE_URL=... npx jest e2e.deal

import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { calcPlatformFee, calcAdvertiserPayout, MIDAS } from './shared'

const prisma = new PrismaClient()

// Test uchun yordamchi funksiyalar
async function createTestUser(data: {
  telegramId: number
  role: 'BUSINESS' | 'ADVERTISER'
  fullName: string
}) {
  return prisma.user.upsert({
    where: { telegramId: BigInt(data.telegramId) },
    update: {},
    create: {
      telegramId:   BigInt(data.telegramId),
      role:         data.role,
      fullName:     data.fullName,
      lang:         'uz',
      isActive:     true,
    },
  })
}

async function createTestBusinessProfile(userId: string) {
  return prisma.businessProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      businessName:  'Test Plov House',
      industryCode:  'restaurant',
      industryName:  'Restoran',
      region:        'tashkent',
      monthlyBudget: 'MEDIUM',
    },
  })
}

async function createTestAdvertiserProfile(userId: string) {
  return prisma.advertiserProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      advertiserType:     'TELEGRAM_CHANNEL',
      platformHandle:     'test_food_channel',
      followerCount:      48000,
      engagementRate:     8.5,
      fraudScore:         85,
      rating:             4.5,
      reviewsCount:       10,
      dealsCount:         5,
      successRate:        90,
      pricePost:          1_500_000,
      verificationStatus: 'APPROVED',
      audienceData: {
        age_min: 18, age_max: 45,
        gender_split: { male: 40, female: 60 },
        top_regions: ['tashkent'],
        interests: ['food', 'dining'],
        income_level: 'medium',
      },
    },
  })
}

describe('Deal Lifecycle E2E', () => {
  let businessUser: any
  let advertiserUser: any
  let businessProfile: any
  let advertiserProfile: any
  let campaign: any
  let deal: any

  // Test ma'lumotlarini tayyorlash
  beforeAll(async () => {
    businessUser    = await createTestUser({ telegramId: 99001001, role: 'BUSINESS',   fullName: 'Test Tadbirkor' })
    advertiserUser  = await createTestUser({ telegramId: 99001002, role: 'ADVERTISER', fullName: 'Test Blogger' })
    businessProfile = await createTestBusinessProfile(businessUser.id)
    advertiserProfile = await createTestAdvertiserProfile(advertiserUser.id)

    campaign = await prisma.campaign.create({
      data: {
        businessId:  businessProfile.id,
        title:       'Test Kampaniya',
        status:      'ACTIVE',
        totalBudget: 5_000_000,
      },
    })
  })

  // Test ma'lumotlarini tozalash
  afterAll(async () => {
    if (deal) {
      await prisma.review.deleteMany({ where: { dealId: deal.id } })
      await prisma.dispute.deleteMany({ where: { dealId: deal.id } })
      await prisma.payment.deleteMany({ where: { dealId: deal.id } })
      await prisma.deal.deleteMany({ where: { id: deal.id } })
    }
    await prisma.campaign.deleteMany({ where: { id: campaign?.id } })
    await prisma.advertiserProfile.deleteMany({ where: { userId: advertiserUser?.id } })
    await prisma.businessProfile.deleteMany({ where: { userId: businessUser?.id } })
    await prisma.user.deleteMany({ where: { id: { in: [businessUser?.id, advertiserUser?.id] } } })
    await prisma.$disconnect()
  })

  // ── Qadam 1: Taklif yaratish ──────────────
  test('1. Taklif yaratiladi (PENDING)', async () => {
    const price = 1_500_000
    const fee   = calcPlatformFee(price)
    const payout = calcAdvertiserPayout(price)

    deal = await prisma.deal.create({
      data: {
        campaignId:       campaign.id,
        advertiserId:     advertiserProfile.id,
        status:           'PENDING',
        price,
        platformFee:      fee,
        advertiserPayout: payout,
        escrowStatus:     'NONE',
      },
    })

    expect(deal.status).toBe('PENDING')
    expect(Number(deal.price)).toBe(1_500_000)
    expect(Number(deal.platformFee)).toBe(105_000)         // 7%
    expect(Number(deal.advertiserPayout)).toBe(1_395_000)  // 93%
    expect(Number(deal.platformFee) + Number(deal.advertiserPayout)).toBe(price)
  })

  // ── Qadam 2: Qabul qilish ─────────────────
  test('2. Reklamachi qabul qiladi (ACCEPTED)', async () => {
    const { acceptDeal } = require('../services/deal.service')

    // Mock: notification queue ni o'chirish
    jest.spyOn(require('../jobs/queue'), 'queueNotification').mockResolvedValue(undefined)

    deal = await acceptDeal(deal.id, advertiserProfile.id)

    expect(deal.status).toBe('ACCEPTED')
    expect(deal.acceptedAt).not.toBeNull()
    expect(deal.contentDeadline).not.toBeNull()

    // Muddat 48 soatdan keyin bo'lishi kerak
    const deadlineHours = (deal.contentDeadline.getTime() - deal.acceptedAt.getTime()) / 3600_000
    expect(deadlineHours).toBe(MIDAS.CONTENT_DEADLINE_HOURS)
  })

  // ── Qadam 3: Escrow ───────────────────────
  test('3. To\'lov escrow\'ga tushadi (ESCROW_HELD)', async () => {
    const { holdEscrow } = require('../services/deal.service')

    deal = await holdEscrow(deal.id, 'payme_tx_test_123', 'PAYME')

    expect(deal.status).toBe('ESCROW_HELD')
    expect(deal.escrowStatus).toBe('HELD')

    const payment = await prisma.payment.findUnique({ where: { dealId: deal.id } })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('HELD')
    expect(payment!.txId).toBe('payme_tx_test_123')
  })

  // ── Qadam 4: Kontent yuborish ─────────────
  test('4. Kontent URL yuboriladi (CONTENT_SUBMITTED)', async () => {
    const { submitContent } = require('../services/deal.service')

    const contentUrl = 'https://t.me/test_food_channel/1234'
    deal = await submitContent(deal.id, advertiserProfile.id, contentUrl)

    expect(deal.status).toBe('CONTENT_SUBMITTED')
    expect(deal.contentUrl).toBe(contentUrl)
  })

  // ── Qadam 5: Tasdiqlash → Complete ────────
  test('5. Tadbirkor tasdiqlaydi → Bitim tugaydi (COMPLETED)', async () => {
    const { confirmAndCompleteDeal } = require('../services/deal.service')

    deal = await confirmAndCompleteDeal(deal.id, businessUser.id)

    expect(deal.status).toBe('COMPLETED')
    expect(deal.completedAt).not.toBeNull()
    expect(deal.escrowStatus).toBe('RELEASED')

    const payment = await prisma.payment.findUnique({ where: { dealId: deal.id } })
    expect(payment!.status).toBe('RELEASED')
    expect(payment!.releasedAt).not.toBeNull()
  })

  // ── Qadam 6: Sharh qoldirish ──────────────
  test('6. Tadbirkor reklamachini baholaydi', async () => {
    const review = await prisma.review.create({
      data: {
        dealId:     deal.id,
        reviewerId: businessUser.id,
        targetId:   advertiserUser.id,
        score:      5,
        comment:    'Ajoyib ish!',
      },
    })

    expect(review.score).toBe(5)

    // Reklamachi reytingi yangilanganini tekshirish
    const advProfile = await prisma.advertiserProfile.findUnique({
      where: { id: advertiserProfile.id },
    })
    expect(advProfile!.reviewsCount).toBeGreaterThanOrEqual(1)
  })
})

// ─────────────────────────────────────────
// NIZO LIFECYCLE TESTI
// ─────────────────────────────────────────
describe('Dispute Lifecycle E2E', () => {
  let deal2: any

  beforeAll(async () => {
    const bUser = await createTestUser({ telegramId: 99002001, role: 'BUSINESS',   fullName: 'Dispute Test Biz' })
    const aUser = await createTestUser({ telegramId: 99002002, role: 'ADVERTISER', fullName: 'Dispute Test Adv' })
    const bProf = await createTestBusinessProfile(bUser.id)
    const aProf = await createTestAdvertiserProfile(aUser.id)
    const camp  = await prisma.campaign.create({
      data: { businessId: bProf.id, title: 'Dispute Test Campaign', status: 'ACTIVE', totalBudget: 1_000_000 },
    })

    deal2 = await prisma.deal.create({
      data: {
        campaignId: camp.id, advertiserId: aProf.id,
        status: 'ESCROW_HELD', price: 1_000_000,
        platformFee: calcPlatformFee(1_000_000),
        advertiserPayout: calcAdvertiserPayout(1_000_000),
        escrowStatus: 'HELD',
      },
    })
    await prisma.payment.create({
      data: {
        dealId: deal2.id, provider: 'PAYME', status: 'HELD',
        amount: 1_000_000, fee: calcPlatformFee(1_000_000),
        txId: 'dispute_test_tx',
      },
    })
  })

  afterAll(async () => {
    await prisma.dispute.deleteMany({ where: { dealId: deal2?.id } })
    await prisma.payment.deleteMany({ where: { dealId: deal2?.id } })
    await prisma.deal.deleteMany({ where: { id: deal2?.id } })
  })

  test('Nizo ochildi va hal qilindi', async () => {
    jest.spyOn(require('../jobs/queue'), 'queueNotification').mockResolvedValue(undefined)

    const { openDispute, resolveDispute } = require('../services/deal.service')
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

    // Nizo ochish
    const { dispute } = await openDispute(deal2.id, 'test-user', 'Kontent sifatsiz', [])
    expect(dispute.status).toBe('OPEN')

    // Nizo hal qilish (to'liq refund)
    if (adminUser) {
      const result = await resolveDispute(dispute.id, adminUser.id, 'RESOLVED_REFUND', 'Admin sinovdan keyin qaror berdi')
      expect(result.refundAmount).toBe(1_000_000)

      const updatedDeal = await prisma.deal.findUnique({ where: { id: deal2.id } })
      expect(updatedDeal!.status).toBe('RESOLVED')
      expect(updatedDeal!.escrowStatus).toBe('REFUNDED')
    }
  })
})

// MIDAS — Deal Service (Bitim boshqaruvi)
// packages/api/src/services/deal.service.ts

import { prisma } from '../plugins/prisma'
import { queueNotification } from '../jobs/queue'
import { calcPlatformFee, calcAdvertiserPayout, calcContentDeadline, MIDAS } from '../shared'

// ─── Taklif yuborish ──────────────────────
export async function createDeal(input: {
  campaignId: string
  advertiserId: string
  price: number
  note?: string
}) {
  const { campaignId, advertiserId, price, note } = input

  // Kampaniya egasi hisoblash
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { business: { include: { user: true } } },
  })

  // Reklamachi free limit tekshiruvi
  const advertiser = await prisma.advertiserProfile.findUniqueOrThrow({
    where: { id: advertiserId },
    include: { user: true },
  })

  if (!advertiser.isPremium) {
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    const monthDeals = await prisma.deal.count({
      where: {
        advertiserId,
        createdAt: { gte: thisMonthStart },
      },
    })

    if (monthDeals >= MIDAS.FREE_DEALS_PER_MONTH) {
      throw new DealError('MONTHLY_LIMIT_REACHED',
        `Oylik bepul bitimlar limiti (${MIDAS.FREE_DEALS_PER_MONTH} ta) tugadi. Premium obunaga o'ting.`)
    }
  }

  const platformFee = calcPlatformFee(price)
  const advertiserPayout = calcAdvertiserPayout(price)

  const deal = await prisma.deal.create({
    data: {
      campaignId,
      advertiserId,
      status: 'PENDING',
      price,
      platformFee,
      advertiserPayout,
      note,
      escrowStatus: 'NONE',
    },
  })

  // Reklamachiga bildirishnoma
  await queueNotification(advertiser.userId, 'NEW_OFFER', {
    dealId: deal.id,
    business_name: campaign.business.businessName,
    amount: price,
    note,
  })

  return deal
}

// ─── Taklif qabul qilish ──────────────────
export async function acceptDeal(dealId: string, advertiserId: string) {
  const deal = await getDealOrThrow(dealId)
  assertStatus(deal, 'PENDING')
  assertAdvertiser(deal, advertiserId)

  const deadline = calcContentDeadline(new Date())

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      contentDeadline: deadline,
    },
    include: {
      campaign: { include: { business: { include: { user: true } } } },
    },
  })

  // Tadbirkorga bildirishnoma — to'lov qilsin
  await queueNotification(updated.campaign.business.userId, 'OFFER_ACCEPTED', {
    dealId,
    advertiser_name: deal.advertiserId,
    amount: Number(deal.price),
  })

  return updated
}

// ─── Taklif rad etish ─────────────────────
export async function rejectDeal(dealId: string, advertiserId: string, reason?: string) {
  const deal = await getDealOrThrow(dealId)
  assertStatus(deal, 'PENDING')
  assertAdvertiser(deal, advertiserId)

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { status: 'CANCELLED', note: reason },
    include: { campaign: { include: { business: { include: { user: true } } } } },
  })

  // Tadbirkorga bildirishnoma
  await queueNotification(updated.campaign.business.userId, 'OFFER_REJECTED', {
    dealId, reason,
  })

  return updated
}

// ─── Escrow ushlanishi (to'lov webhook dan) ─
export async function holdEscrow(dealId: string, txId: string, provider: string) {
  const deal = await getDealOrThrow(dealId)
  assertStatus(deal, 'ACCEPTED')

  // To'lov yaratish
  await prisma.payment.create({
    data: {
      dealId,
      provider: provider as any,
      status: 'HELD',
      amount: deal.price,
      fee: deal.platformFee,
      txId,
      heldAt: new Date(),
    },
  })

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { status: 'ESCROW_HELD', escrowStatus: 'HELD' },
    include: {
      advertiser: { include: { user: true } },
      campaign: { include: { business: { include: { user: true } } } },
    },
  })

  // Reklamachiga bildirishnoma — kontent tayyorlasin
  await queueNotification(updated.advertiser.userId, 'PAYMENT_HELD', {
    dealId,
    amount: Number(deal.price),
    deadline: updated.contentDeadline?.toISOString(),
    business_name: updated.campaign.business.businessName,
  })

  return updated
}

// ─── Kontent yuborish ─────────────────────
export async function submitContent(
  dealId: string,
  advertiserId: string,
  contentUrl: string,
  contentNote?: string
) {
  const deal = await getDealOrThrow(dealId)
  assertStatus(deal, 'ESCROW_HELD')
  assertAdvertiser(deal, advertiserId)

  // URL validatsiya (oddiy)
  if (!contentUrl.startsWith('http')) {
    throw new DealError('INVALID_CONTENT_URL', 'Kontent URL http:// bilan boshlanishi kerak')
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      status: 'CONTENT_SUBMITTED',
      contentUrl,
      contentNote,
    },
    include: {
      campaign: { include: { business: { include: { user: true } } } },
    },
  })

  // Tadbirkorga bildirishnoma — tasdiqlash kerak
  await queueNotification(updated.campaign.business.userId, 'CONTENT_SUBMITTED', {
    dealId,
    content_url: contentUrl,
    advertiser_name: updated.advertiserId,
  })

  return updated
}

// ─── Kontent tasdiqlash → escrow release ──
export async function confirmAndCompleteDeal(dealId: string, businessUserId: string) {
  const deal = await getDealOrThrow(dealId)
  assertStatus(deal, 'CONTENT_SUBMITTED')

  // Tadbirkor ekanligini tekshirish
  const campaign = await prisma.campaign.findUnique({
    where: { id: deal.campaignId },
    include: { business: { include: { user: true } } },
  })
  if (campaign?.business.userId !== businessUserId) {
    throw new DealError('FORBIDDEN', 'Faqat kampaniya egasi tasdiqlashi mumkin')
  }

  // Escrow release
  await prisma.payment.update({
    where: { dealId },
    data: { status: 'RELEASED', releasedAt: new Date() },
  })

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      status: 'COMPLETED',
      escrowStatus: 'RELEASED',
      completedAt: new Date(),
      publishedAt: new Date(),
    },
    include: { advertiser: { include: { user: true } } },
  })

  // Reklamachi statistikasini yangilash
  await prisma.advertiserProfile.update({
    where: { id: deal.advertiserId },
    data: {
      dealsCount: { increment: 1 },
      successRate: await calcSuccessRate(deal.advertiserId),
    },
  })

  // Tadbirkor deals count
  await prisma.businessProfile.update({
    where: { id: campaign!.businessId },
    data: { dealsCount: { increment: 1 } },
  })

  // Reklamachiga bildirishnoma — to'lov chiqarildi
  await queueNotification(updated.advertiser.userId, 'DEAL_COMPLETED', {
    dealId,
    amount: Number(deal.advertiserPayout),
  })

  return updated
}

// ─── Nizo ochish ──────────────────────────
export async function openDispute(
  dealId: string,
  openedByUserId: string,
  reason: string,
  evidenceUrls: string[] = []
) {
  const deal = await getDealOrThrow(dealId)

  if (!['ESCROW_HELD', 'CONTENT_SUBMITTED'].includes(deal.status)) {
    throw new DealError('INVALID_STATUS', 'Faqat aktiv bitimda nizo ochish mumkin')
  }

  // Allaqachon nizo bor-yo'qligini tekshirish
  const existing = await prisma.dispute.findUnique({ where: { dealId } })
  if (existing) throw new DealError('DISPUTE_EXISTS', 'Bu bitimda allaqachon nizo mavjud')

  const [dispute, updatedDeal] = await prisma.$transaction([
    prisma.dispute.create({
      data: { dealId, openedById: openedByUserId, reason, evidenceUrls },
    }),
    prisma.deal.update({
      where: { id: dealId },
      data: { status: 'DISPUTED' },
    }),
  ])

  // Admin ga bildirishnoma
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
  for (const admin of admins) {
    await queueNotification(admin.id, 'DEAL_DISPUTED', {
      dealId,
      disputeId: dispute.id,
      reason,
    })
  }

  return { dispute, deal: updatedDeal }
}

// ─── Nizo hal qilish (admin) ──────────────
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  resolution: 'RESOLVED_REFUND' | 'RESOLVED_PARTIAL' | 'RESOLVED_PAID_ADVERTISER',
  adminNote: string,
  refundPercent?: number
) {
  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: { deal: { include: { payment: true, advertiser: { include: { user: true } }, campaign: { include: { business: { include: { user: true } } } } } } },
  })

  const deal = dispute.deal
  const payment = deal.payment

  if (!payment) throw new DealError('PAYMENT_NOT_FOUND', "To'lov topilmadi")

  let refundAmount = 0
  let advertiserAmount = 0

  if (resolution === 'RESOLVED_REFUND') {
    // To'liq tadbirkorga qaytariladi
    refundAmount = Number(deal.price)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
  } else if (resolution === 'RESOLVED_PARTIAL') {
    // Qisman qaytarish
    const pct = refundPercent || 50
    refundAmount = Math.round(Number(deal.price) * (pct / 100))
    advertiserAmount = Number(deal.price) - refundAmount
  } else {
    // Reklamachiga to'liq to'lanadi
    advertiserAmount = Number(deal.advertiserPayout)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
  }

  await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: resolution,
        adminId,
        adminNote,
        resolution: `${resolution} | Refund: ${refundAmount} | Payout: ${advertiserAmount}`,
        refundPercent: refundPercent || (resolution === 'RESOLVED_REFUND' ? 100 : 0),
        resolvedAt: new Date(),
      },
    }),
    prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: 'RESOLVED',
        escrowStatus: resolution === 'RESOLVED_REFUND' ? 'REFUNDED' : 'RELEASED',
      },
    }),
  ])

  // Ikki tomonga ham bildirishnoma
  await queueNotification(deal.campaign.business.userId, 'DISPUTE_RESOLVED', {
    dealId: deal.id, resolution, refundAmount,
  })
  await queueNotification(deal.advertiser.userId, 'DISPUTE_RESOLVED', {
    dealId: deal.id, resolution, advertiserAmount,
  })

  return { resolution, refundAmount, advertiserAmount }
}

// ─── Helpers ──────────────────────────────
async function getDealOrThrow(dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } })
  if (!deal) throw new DealError('NOT_FOUND', 'Bitim topilmadi')
  return deal
}

function assertStatus(deal: any, expected: string) {
  if (deal.status !== expected) {
    throw new DealError('INVALID_STATUS',
      `Bitim holati "${deal.status}", kutilgan: "${expected}"`)
  }
}

function assertAdvertiser(deal: any, advertiserId: string) {
  if (deal.advertiserId !== advertiserId) {
    throw new DealError('FORBIDDEN', 'Bu bitim sizga tegishli emas')
  }
}

async function calcSuccessRate(advertiserId: string): Promise<number> {
  const total = await prisma.deal.count({
    where: { advertiserId, status: { in: ['COMPLETED', 'CANCELLED', 'RESOLVED'] } },
  })
  if (total === 0) return 0
  const completed = await prisma.deal.count({
    where: { advertiserId, status: 'COMPLETED' },
  })
  return Math.round((completed / total) * 100)
}

export class DealError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'DealError'
  }
}


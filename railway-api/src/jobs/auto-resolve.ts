// MIDAS — Dispute Auto-Resolution + Premium Expiry Jobs
// packages/api/src/jobs/auto-resolve.ts

import { prisma } from '../plugins/prisma'
import { queueNotification } from './queue'
import { MIDAS } from '../shared'

/**
 * Nizo avtomatik yopish:
 * - Kontent topshirilgan + 48 soat o'tgan + shikoyat yo'q → avtomatik complete
 * - Nizo ochildi + 48 soat o'tgan → admin tekshiruvi boshladi
 */
export async function runDisputeAutoResolve() {
  const now = new Date()
  const autoResolveDeadline = new Date(now.getTime() - MIDAS.DISPUTE_AUTO_RESOLVE_HOURS * 3600_000)
  const adminDeadline = new Date(now.getTime() - MIDAS.ADMIN_RESOLVE_HOURS * 3600_000)

  // 1. CONTENT_SUBMITTED holati + 48 soat o'tgan + shikoyat yo'q → COMPLETED
  const readyToComplete = await prisma.deal.findMany({
    where: {
      status: 'CONTENT_SUBMITTED',
      updatedAt: { lt: autoResolveDeadline },
      dispute: null,
    },
    include: {
      payment: true,
      advertiser: { include: { user: true } },
      campaign: { include: { business: { include: { user: true } } } },
    },
  })

  for (const deal of readyToComplete) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { dealId: deal.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      }),
      prisma.deal.update({
        where: { id: deal.id },
        data: { status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date() },
      }),
    ])

    await queueNotification(deal.advertiser.userId, 'DEAL_COMPLETED', {
      dealId: deal.id,
      amount: Number(deal.advertiserPayout),
    })

    await queueNotification(deal.campaign.business.userId, 'DEAL_COMPLETED', {
      dealId: deal.id,
    })

    console.log(`[AUTO-RESOLVE] Deal ${deal.id} auto-completed`)
  }

  // 2. OPEN nizo + 72 soat o'tgan → admin uchun eslatma
  const staleDisputes = await prisma.dispute.findMany({
    where: {
      status: 'OPEN',
      createdAt: { lt: adminDeadline },
    },
  })

  for (const dispute of staleDisputes) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of admins) {
      await queueNotification(admin.id, 'DEAL_DISPUTED', {
        dealId: dispute.dealId,
        disputeId: dispute.id,
        reason: `ESLATMA: Bu nizo ${MIDAS.ADMIN_RESOLVE_HOURS} soatdan ortiq hal qilinmagan!`,
      })
    }
    // UNDER_REVIEW ga o'tkazamiz
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: 'UNDER_REVIEW' },
    })
  }

  console.log(`[AUTO-RESOLVE] Completed: ${readyToComplete.length}, Escalated: ${staleDisputes.length}`)
}

/**
 * Premium obuna muddati tugaganlar
 */
export async function checkPremiumExpiry() {
  const now = new Date()

  const expiredAdvertisers = await prisma.advertiserProfile.findMany({
    where: {
      isPremium: true,
      premiumUntil: { lt: now },
    },
    include: { user: { select: { id: true } } },
  })

  for (const adv of expiredAdvertisers) {
    await prisma.advertiserProfile.update({
      where: { id: adv.id },
      data: { isPremium: false, monthlyDealLimit: 5 },
    })
    await queueNotification(adv.userId, 'VERIFICATION_REJECTED', {
      reason: 'Premium obuna muddati tugadi. Yangilash uchun /premium bosing.',
    })
  }

  const expiredBusinesses = await prisma.businessProfile.findMany({
    where: { isPremium: true, premiumUntil: { lt: now } },
  })

  for (const biz of expiredBusinesses) {
    await prisma.businessProfile.update({
      where: { id: biz.id },
      data: { isPremium: false },
    })
  }

  console.log(`[PREMIUM] Expired: advertisers=${expiredAdvertisers.length}, businesses=${expiredBusinesses.length}`)
}


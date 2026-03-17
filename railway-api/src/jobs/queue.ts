// MIDAS — Background Jobs (BullMQ)
// packages/api/src/jobs/queue.ts

import { Queue, Worker, QueueEvents } from 'bullmq'
import { redis } from '../plugins/redis'
import { prisma } from '../plugins/prisma'
import { runMatchingEngine } from '../ai/matching.engine'
import { runWeeklyFraudScan } from '../ai/matching.engine'
import { MIDAS, hoursUntilDeadline } from './shared'

const connection = { connection: redis }

// ─── Queues ───────────────────────────────

export const notificationQueue = new Queue('notifications', connection)
export const aiMatchQueue      = new Queue('ai-match', connection)
export const fraudScanQueue    = new Queue('fraud-scan', connection)
export const dealExpiryQueue   = new Queue('deal-expiry', connection)

// ─── Notification Worker ─────────────────
new Worker('notifications', async (job) => {
  const { type, userId, payload } = job.data

  // Foydalanuvchining Telegram ID sini olamiz
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, lang: true },
  })
  if (!user) return

  // Bot ga HTTP request yuboramiz
  const botApiUrl = process.env.API_URL?.replace('/api/v1', '') + '/bot/send'
  await fetch(botApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramId: user.telegramId.toString(),
      lang: user.lang,
      type,
      payload,
    }),
  }).catch(err => console.error('Bot notify error:', err))

  // DB ga ham saqlaymiz
  await prisma.notification.create({
    data: { userId, type, payload, sentToBot: true },
  })

}, connection)

// ─── AI Match Worker ──────────────────────
new Worker('ai-match', async (job) => {
  const { campaignId } = job.data

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: true },
  })
  if (!campaign) return

  await runMatchingEngine({
    campaignId: campaign.id,
    businessId: campaign.businessId,
    industryCode: campaign.business.industryCode,
    businessName: campaign.business.businessName,
    region: campaign.business.region,
    budgetRange: campaign.business.monthlyBudget as any,
  })

}, connection)

// ─── Fraud Scan Worker ────────────────────
new Worker('fraud-scan', async (job) => {
  console.log('[JOB] Weekly fraud scan started...')
  const count = await runWeeklyFraudScan()
  console.log(`[JOB] Fraud scan completed: ${count} advertisers updated`)
}, connection)

// ─── Deal Expiry Worker ───────────────────
new Worker('deal-expiry', async (job) => {
  const now = new Date()

  // Muddati o'tgan deals — avtomatik refund
  const expiredDeals = await prisma.deal.findMany({
    where: {
      status: 'ESCROW_HELD',
      contentDeadline: { lt: now },
    },
    include: {
      campaign: { include: { business: { include: { user: true } } } },
      advertiser: { include: { user: true } },
      payment: true,
    },
  })

  for (const deal of expiredDeals) {
    // Refund jarayoni
    await prisma.deal.update({
      where: { id: deal.id },
      data: { status: 'CANCELLED' },
    })
    if (deal.payment) {
      await prisma.payment.update({
        where: { id: deal.payment.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      })
    }

    // Tadbirkorga xabar
    await notificationQueue.add('notify', {
      type: 'DEAL_DISPUTED',
      userId: deal.campaign.business.userId,
      payload: {
        dealId: deal.id,
        reason: 'content_deadline_expired',
      },
    })
  }

  // Muddatga 6 soat qolganda eslatma
  const approaching = await prisma.deal.findMany({
    where: {
      status: 'ESCROW_HELD',
      contentDeadline: {
        gt: now,
        lt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      },
    },
    include: {
      advertiser: { include: { user: true } },
    },
  })

  for (const deal of approaching) {
    const hours = hoursUntilDeadline(deal.contentDeadline!)
    await notificationQueue.add('notify', {
      type: 'DEADLINE_REMINDER',
      userId: deal.advertiser.userId,
      payload: { dealId: deal.id, hours },
    })
  }

}, connection)

// ─── Recurring Jobs ───────────────────────

export async function scheduleRecurringJobs() {
  // Haftalik fraud scan (Dushanba kechasi 02:00)
  await fraudScanQueue.add(
    'weekly-scan',
    {},
    { repeat: { pattern: '0 2 * * 1' } }
  )

  // Deal expiry check (har 30 daqiqada)
  await dealExpiryQueue.add(
    'check-expiry',
    {},
    { repeat: { every: 30 * 60 * 1000 } }
  )

  console.log('[JOBS] Recurring jobs scheduled')
}

// ─── Helper funksiyalar ───────────────────

export async function queueNotification(
  userId: string,
  type: string,
  payload: object
) {
  await notificationQueue.add('notify', { userId, type, payload }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

export async function queueAiMatch(campaignId: string) {
  await aiMatchQueue.add('generate', { campaignId }, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
  })
}

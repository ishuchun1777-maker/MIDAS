// MIDAS API — Payment Webhook Routes
// packages/api/src/routes/payment.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { handlePaymeWebhook } from '../payments/payme.provider'
import { handleClickWebhook } from '../payments/click.provider'
import { prisma } from '../plugins/prisma'
import { requireRole } from '../middlewares/auth.middleware'

export async function paymentRoutes(app: FastifyInstance) {

  // ─── POST /payments/payme — Payme webhook ─
  app.post(
    '/payme',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const authorization = req.headers['authorization'] as string || ''
      const body = req.body as any

      const response = await handlePaymeWebhook(body, authorization)

      // Payme doim 200 kutadi
      return reply.status(200).send(response)
    }
  )

  // ─── POST /payments/click/prepare — Click prepare ─
  app.post(
    '/click/prepare',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as any
      const response = await handleClickWebhook({ ...body, action: 0 })
      return reply.send(response)
    }
  )

  // ─── POST /payments/click/complete — Click complete ─
  app.post(
    '/click/complete',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as any
      const response = await handleClickWebhook({ ...body, action: 1 })
      return reply.send(response)
    }
  )

  // ─── GET /payments/deal/:dealId — To'lov holati ─
  app.get(
    '/deal/:dealId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { dealId } = req.params as { dealId: string }

      const payment = await prisma.payment.findUnique({
        where: { dealId },
        select: {
          id: true, provider: true, status: true,
          amount: true, fee: true, heldAt: true,
          releasedAt: true, refundedAt: true, createdAt: true,
        },
      })

      if (!payment) return reply.status(404).send({ error: 'NOT_FOUND' })
      return reply.send(payment)
    }
  )

  // ─── GET /payments/history/:userId — To'lov tarixi ─
  app.get(
    '/history/:userId',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      const { page = '1', limit = '20' } = req.query as Record<string, string>
      const skip = (parseInt(page) - 1) * parseInt(limit)

      // Foydalanuvchi advertiser ekanligini tekshirish
      const advProfile = await prisma.advertiserProfile.findUnique({
        where: { userId },
        select: { id: true },
      })

      const where = advProfile
        ? { deal: { advertiserId: advProfile.id } }
        : { deal: { campaign: { business: { userId } } } }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            deal: {
              select: {
                id: true, status: true,
                campaign: { select: { title: true, business: { select: { businessName: true } } } },
                advertiser: { select: { platformHandle: true, user: { select: { fullName: true } } } },
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ])

      return reply.send({ payments, total, page: parseInt(page), limit: parseInt(limit) })
    }
  )

  // ─── Admin: POST /payments/:paymentId/release — Manual chiqarish ─
  app.post(
    '/:paymentId/release',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { paymentId } = req.params as { paymentId: string }
      const { reason } = req.body as { reason?: string }

      const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
      if (!payment) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (payment.status !== 'HELD') return reply.status(400).send({ error: 'NOT_HELD' })

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'RELEASED', releasedAt: new Date() },
        }),
        prisma.deal.update({
          where: { id: payment.dealId },
          data: { status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date() },
        }),
      ])

      return reply.send({ success: true, reason })
    }
  )

  // ─── Admin: POST /payments/:paymentId/refund — Manual refund ─
  app.post(
    '/:paymentId/refund',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { paymentId } = req.params as { paymentId: string }
      const { reason } = req.body as { reason?: string }

      const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
      if (!payment) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (!['HELD', 'PENDING'].includes(payment.status)) {
        return reply.status(400).send({ error: 'CANNOT_REFUND' })
      }

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        }),
        prisma.deal.update({
          where: { id: payment.dealId },
          data: { status: 'CANCELLED', escrowStatus: 'REFUNDED' },
        }),
      ])

      return reply.send({ success: true, reason })
    }
  )

  // ─── Admin: GET /payments/stats — Moliyaviy statistika ─
  app.get(
    '/stats',
    { preHandler: [requireRole('ADMIN')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [todayStats, monthStats, heldStats, totalStats] = await Promise.all([
        prisma.payment.aggregate({
          where: { status: 'RELEASED', releasedAt: { gte: todayStart } },
          _sum: { amount: true, fee: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'RELEASED', releasedAt: { gte: monthStart } },
          _sum: { amount: true, fee: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'HELD' },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'RELEASED' },
          _sum: { fee: true },
          _count: { id: true },
        }),
      ])

      return reply.send({
        today: {
          transactions: todayStats._count.id,
          volume: Number(todayStats._sum.amount || 0),
          platformFees: Number(todayStats._sum.fee || 0),
        },
        thisMonth: {
          transactions: monthStats._count.id,
          volume: Number(monthStats._sum.amount || 0),
          platformFees: Number(monthStats._sum.fee || 0),
        },
        escrowHeld: {
          transactions: heldStats._count.id,
          volume: Number(heldStats._sum.amount || 0),
        },
        allTime: {
          transactions: totalStats._count.id,
          totalFees: Number(totalStats._sum.fee || 0),
        },
      })
    }
  )
}

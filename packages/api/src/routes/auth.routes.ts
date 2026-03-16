// MIDAS Auth Routes
// packages/api/src/routes/auth.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  verifyTelegramWebAppData,
  upsertTelegramUser,
  createTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
} from '../services/auth.service'
import { prisma } from '../plugins/prisma'

// ─── Validation schemas ───────────────────

const miniAppAuthSchema = z.object({
  initData: z.string().min(10),
  lang: z.enum(['uz', 'ru', 'en']).optional().default('uz'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
})

const logoutSchema = z.object({
  refreshToken: z.string().min(10),
})

// ─── Routes ───────────────────────────────

export async function authRoutes(app: FastifyInstance) {

  /**
   * POST /auth/miniapp
   * Mini App dan kelgan initData tekshiriladi va token qaytariladi
   */
  app.post('/miniapp', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = miniAppAuthSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT', details: body.error.flatten() })
    }

    const tgUser = verifyTelegramWebAppData(body.data.initData)
    if (!tgUser) {
      return reply.status(401).send({ error: 'INVALID_TELEGRAM_DATA' })
    }

    const user = await upsertTelegramUser(tgUser, body.data.lang)

    if (user.isBanned) {
      return reply.status(403).send({ error: 'USER_BANNED', reason: user.banReason })
    }

    const tokens = await createTokenPair(user.id)

    // Profilni ham qaytaramiz — frontend onboarding statusini bilishi uchun
    const profile = await getFullProfile(user.id, user.role)

    return reply.send({
      ...tokens,
      user: {
        id: user.id,
        role: user.role,
        lang: user.lang,
        fullName: user.fullName,
        telegramUsername: user.telegramUsername,
        isOnboarded: !!profile,
        profile,
      },
    })
  })

  /**
   * POST /auth/refresh
   * Refresh token bilan yangi access token olish
   */
  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT' })
    }

    try {
      const tokens = await refreshAccessToken(body.data.refreshToken)
      return reply.send(tokens)
    } catch (err: any) {
      return reply.status(401).send({ error: err.message })
    }
  })

  /**
   * POST /auth/logout
   * Refresh token bekor qilinadi
   */
  app.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = logoutSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT' })
    }

    await revokeRefreshToken(body.data.refreshToken)
    return reply.send({ success: true })
  })

  /**
   * GET /auth/me
   * Joriy foydalanuvchi ma'lumotlari (token bilan)
   */
  app.get('/me', { preHandler: [app.authenticate] }, async (req: any, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, role: true, lang: true, fullName: true,
        telegramUsername: true, isActive: true, isBanned: true,
        createdAt: true,
      },
    })

    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' })

    const profile = await getFullProfile(user.id, user.role)
    return reply.send({ ...user, profile })
  })
}

// ─── Helper ───────────────────────────────

async function getFullProfile(userId: string, role: string) {
  if (role === 'BUSINESS') {
    return prisma.businessProfile.findUnique({ where: { userId } })
  }
  if (role === 'ADVERTISER') {
    return prisma.advertiserProfile.findUnique({ where: { userId } })
  }
  if (role === 'AGENCY') {
    return prisma.agencyProfile.findUnique({ where: { userId } })
  }
  return null
}

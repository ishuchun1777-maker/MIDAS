// MIDAS Auth Service
// packages/api/src/services/auth.service.ts

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../plugins/prisma'
import { MIDAS, JwtPayload, TelegramUser } from '../shared'

const JWT_SECRET = process.env.JWT_SECRET!
const BOT_TOKEN = process.env.BOT_TOKEN!

// ─────────────────────────────────────────
// TELEGRAM WebApp Auth
// ─────────────────────────────────────────

/**
 * Telegram WebApp.initData ni HMAC bilan tekshiradi
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    // Hash ni olib, qolganlarni saralab string yasaymiz
    params.delete('hash')
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    // Secret key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest()

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (expectedHash !== hash) return null

    // user maydonini parse qilamiz
    const userStr = params.get('user')
    if (!userStr) return null

    return JSON.parse(userStr) as TelegramUser
  } catch {
    return null
  }
}

/**
 * Telegram Bot'dan kelgan update ni tekshiradi (webhook signature)
 */
export function verifyTelegramWebhook(body: string, secretToken: string): boolean {
  const expectedToken = process.env.WEBHOOK_SECRET_TOKEN
  return secretToken === expectedToken
}

// ─────────────────────────────────────────
// JWT
// ─────────────────────────────────────────

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: MIDAS.JWT_ACCESS_EXPIRES,
  })
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: MIDAS.JWT_REFRESH_EXPIRES,
  })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

// ─────────────────────────────────────────
// USER UPSERT (Telegram orqali login)
// ─────────────────────────────────────────

export async function upsertTelegramUser(
  tgUser: TelegramUser,
  lang: 'uz' | 'ru' | 'en' = 'uz'
) {
  const existing = await prisma.user.findUnique({
    where: { telegramId: BigInt(tgUser.id) },
  })

  if (existing) {
    // Telegram username o'zgargan bo'lsa yangilaymiz
    if (existing.telegramUsername !== tgUser.username) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { telegramUsername: tgUser.username ?? null },
      })
    }
    return existing
  }

  // Yangi foydalanuvchi — rol keyinroq onboarding da belgilanadi
  return prisma.user.create({
    data: {
      telegramId: BigInt(tgUser.id),
      telegramUsername: tgUser.username ?? null,
      fullName: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || null,
      lang: lang as any,
      role: 'BUSINESS', // Default, onboarding da o'zgaradi
    },
  })
}

// ─────────────────────────────────────────
// TOKEN PAIR (access + refresh)
// ─────────────────────────────────────────

export async function createTokenPair(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, telegramId: true, role: true },
  })

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    telegramId: user.telegramId.toString(),
    role: user.role,
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  // Refresh token ni DB ga saqlaymiz
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt,
    },
  })

  return { accessToken, refreshToken }
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyToken(refreshToken)
  if (!payload) throw new Error('INVALID_TOKEN')

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  })
  if (!stored || stored.expiresAt < new Date()) {
    throw new Error('TOKEN_EXPIRED')
  }

  // Eski refresh token o'chiriladi (rotation)
  await prisma.refreshToken.delete({ where: { token: refreshToken } })

  return createTokenPair(payload.userId)
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
}


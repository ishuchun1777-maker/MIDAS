// MIDAS Bot — Auth Middleware
// apps/bot/src/middlewares/auth.middleware.ts

import { NextFunction } from 'grammy'
import { MyContext } from '../types'
import { getBotUserByTelegramId } from '../utils/api.client'

/**
 * Har xabar kelganda foydalanuvchini DB dan tekshiramiz
 * Session ga userId va role yozamiz
 */
export async function authMiddleware(ctx: MyContext, next: NextFunction) {
  const tgId = ctx.from?.id
  if (!tgId) return next()

  // Session da allaqachon userId bor va fresh bo'lsa — skip
  if (ctx.session.userId) return next()

  try {
    const user = await getBotUserByTelegramId(tgId)
    if (user) {
      ctx.session.userId = user.id
      ctx.session.role = user.role
      ctx.session.lang = user.lang || 'uz'
      await ctx.i18n.setLocale(ctx.session.lang)
    }
  } catch {
    // Yangi foydalanuvchi — session bo'sh qoladi
  }

  return next()
}

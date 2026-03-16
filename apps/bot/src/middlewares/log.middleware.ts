// MIDAS Bot — Log Middleware
import { NextFunction } from 'grammy'
import { MyContext } from '../types'

export async function logMiddleware(ctx: MyContext, next: NextFunction) {
  const start = Date.now()
  const type = ctx.updateType
  const from = ctx.from?.id
  const text = ctx.message?.text || ctx.callbackQuery?.data || ''

  await next()

  const ms = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log(`[BOT] ${type} | user:${from} | "${text.slice(0, 40)}" | ${ms}ms`)
  }
}

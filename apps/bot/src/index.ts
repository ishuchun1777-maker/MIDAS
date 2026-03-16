// MIDAS Telegram Bot — Entry Point
// apps/bot/src/index.ts

import { Bot, session, GrammyError, HttpError } from 'grammy'
import { I18n } from '@grammyjs/i18n'
import { conversations, createConversation } from '@grammyjs/conversations'
import { hydrateFiles } from '@grammyjs/files'
import { limit } from '@grammyjs/ratelimiter'
import { MyContext } from './types'
import { startCommand } from './commands/start'
import { menuCommand } from './commands/menu'
import { dealsCommand } from './commands/deals'
import { walletCommand } from './commands/wallet'
import { helpCommand } from './commands/help'
import { settingsCommand } from './commands/settings'
import { businessOnboarding } from './scenes/business.onboarding'
import { advertiserOnboarding } from './scenes/advertiser.onboarding'
import { agencyOnboarding } from './scenes/agency.onboarding'
import { dealCallbacks } from './callbacks/deal.callbacks'
import { authMiddleware } from './middlewares/auth.middleware'
import { logMiddleware } from './middlewares/log.middleware'

const BOT_TOKEN = process.env.BOT_TOKEN!
if (!BOT_TOKEN) throw new Error('BOT_TOKEN env var required')

export const bot = new Bot<MyContext>(BOT_TOKEN)

// ─── i18n ─────────────────────────────────
const i18n = new I18n<MyContext>({
  defaultLocale: 'uz',
  useSession: true,
  directory: 'src/locales',
})

// ─── Session ──────────────────────────────
bot.use(session({
  initial: () => ({
    lang: 'uz' as 'uz' | 'ru' | 'en',
    userId: null as string | null,
    role: null as string | null,
    onboardingStep: 0,
    __language_code: 'uz',
  }),
}))

// ─── Plugins ──────────────────────────────
bot.use(i18n)
bot.use(conversations())
bot.use(hydrateFiles(BOT_TOKEN))

// Rate limiting: 1 soniyada 3 ta so'rov
bot.use(limit({
  timeFrame: 1000,
  limit: 3,
  onLimitExceeded: async (ctx) => {
    await ctx.reply(ctx.t('error.rate_limit'))
  },
}))

// ─── Middlewares ──────────────────────────
bot.use(logMiddleware)
bot.use(authMiddleware)

// ─── Conversations (onboarding) ───────────
bot.use(createConversation(businessOnboarding,  'businessOnboarding'))
bot.use(createConversation(advertiserOnboarding, 'advertiserOnboarding'))
bot.use(createConversation(agencyOnboarding,    'agencyOnboarding'))

// ─── Commands ─────────────────────────────
bot.command('start',    startCommand)
bot.command('menu',     menuCommand)
bot.command('deals',    dealsCommand)
bot.command('wallet',   walletCommand)
bot.command('help',     helpCommand)
bot.command('settings', settingsCommand)

// ─── Callback queries ─────────────────────
bot.use(dealCallbacks)

// ─── Error handler ────────────────────────
bot.catch((err) => {
  const { ctx, error } = err
  if (error instanceof GrammyError) {
    console.error('Grammy error:', error.description, '| Chat:', ctx.chat?.id)
  } else if (error instanceof HttpError) {
    console.error('HTTP error:', error)
  } else {
    console.error('Unknown error:', error)
  }
})

// ─── Start (webhook yoki polling) ─────────
async function start() {
  if (process.env.WEBHOOK_DOMAIN && process.env.NODE_ENV === 'production') {
    const webhookUrl = `${process.env.WEBHOOK_DOMAIN}/bot${BOT_TOKEN}`
    await bot.api.setWebhook(webhookUrl, {
      secret_token: process.env.WEBHOOK_SECRET_TOKEN,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
    })
    console.log(`Bot webhook set: ${webhookUrl}`)
  } else {
    // Development: long polling
    await bot.api.deleteWebhook()
    bot.start({
      onStart: (info) => console.log(`MIDAS Bot @${info.username} started (polling)`),
    })
  }
}

start().catch(console.error)

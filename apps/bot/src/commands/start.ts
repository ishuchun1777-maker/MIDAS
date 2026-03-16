// MIDAS Bot — /start command
// apps/bot/src/commands/start.ts

import { CommandContext } from 'grammy'
import { MyContext } from '../types'
import { InlineKeyboard } from 'grammy'
import { apiClient } from '../utils/api.client'

export async function startCommand(ctx: CommandContext<MyContext>) {
  const tgUser = ctx.from
  if (!tgUser) return

  // Avval foydalanuvchi DB da bormi tekshiramiz
  try {
    const user = await apiClient.get(`/users/telegram/${tgUser.id}`)

    if (user && user.isOnboarded) {
      // Onboarding tugallangan — menyu ko'rsatamiz
      ctx.session.userId = user.id
      ctx.session.role = user.role
      ctx.session.lang = user.lang
      await ctx.i18n.setLocale(user.lang)
      return showMainMenu(ctx)
    }
  } catch {
    // Yangi foydalanuvchi
  }

  // Til tanlash
  await showLanguageSelection(ctx)
}

async function showLanguageSelection(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .text("🇺🇿 O'zbek tili", 'lang:uz').row()
    .text('🇷🇺 Русский язык', 'lang:ru').row()
    .text('🇬🇧 English', 'lang:en')

  await ctx.reply(
    '🌟 <b>MIDAS</b> — reklama birjasiga xush kelibsiz!\n\n' +
    '🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык / 🇬🇧 Choose language:',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  )
}

export async function showMainMenu(ctx: MyContext) {
  const role = ctx.session.role

  if (role === 'BUSINESS') {
    return showBusinessMenu(ctx)
  } else if (role === 'ADVERTISER') {
    return showAdvertiserMenu(ctx)
  } else if (role === 'AGENCY') {
    return showAgencyMenu(ctx)
  } else if (role === 'ADMIN') {
    return showAdminMenu(ctx)
  }
}

async function showBusinessMenu(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .webApp('📊 ' + ctx.t('menu.open_app'), process.env.MINIAPP_URL!).row()
    .text('🔍 ' + ctx.t('menu.new_campaign'), 'campaign:new').row()
    .text('📋 ' + ctx.t('menu.active_deals'), 'deals:list')
    .text('💡 ' + ctx.t('menu.recommendations'), 'matches:list').row()
    .text('💰 ' + ctx.t('menu.wallet'), 'wallet:view')
    .text('⚙️ ' + ctx.t('menu.settings'), 'settings:open')

  await ctx.reply(ctx.t('menu.welcome_business'), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })
}

async function showAdvertiserMenu(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .webApp('📊 ' + ctx.t('menu.open_app'), process.env.MINIAPP_URL!).row()
    .text('📬 ' + ctx.t('menu.new_orders'), 'orders:new')
    .text('📋 ' + ctx.t('menu.active_deals'), 'deals:list').row()
    .text('💰 ' + ctx.t('menu.earnings'), 'wallet:view')
    .text('⭐ ' + ctx.t('menu.my_profile'), 'profile:view').row()
    .text('⚙️ ' + ctx.t('menu.settings'), 'settings:open')

  await ctx.reply(ctx.t('menu.welcome_advertiser'), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })
}

async function showAgencyMenu(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .webApp('📊 ' + ctx.t('menu.open_app'), process.env.MINIAPP_URL!).row()
    .text('👥 ' + ctx.t('menu.clients'), 'agency:clients')
    .text('📋 ' + ctx.t('menu.all_deals'), 'deals:list').row()
    .text('💰 ' + ctx.t('menu.wallet'), 'wallet:view')
    .text('⚙️ ' + ctx.t('menu.settings'), 'settings:open')

  await ctx.reply(ctx.t('menu.welcome_agency'), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })
}

async function showAdminMenu(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .text('✅ Verifikatsiya navbati', 'admin:verification').row()
    .text('⚖️ Nizolar', 'admin:disputes')
    .text('📊 Statistika', 'admin:stats').row()
    .text('🔍 Foydalanuvchi qidirish', 'admin:search')

  await ctx.reply('<b>Admin panel</b>', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })
}

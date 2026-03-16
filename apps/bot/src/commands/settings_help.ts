// MIDAS Bot — /help command
import { CommandContext, InlineKeyboard } from 'grammy'
import { MyContext } from '../types'

export async function helpCommand(ctx: CommandContext<MyContext>) {
  const lang = ctx.session.lang || 'uz'

  const text = {
    uz: `ℹ️ <b>MIDAS — Yordam</b>\n\n` +
        `<b>Asosiy komandalar:</b>\n` +
        `/start — Bosh menyu\n` +
        `/menu — Menyu\n` +
        `/deals — Faol bitimlar\n` +
        `/wallet — Hamyon\n` +
        `/settings — Sozlamalar\n` +
        `/help — Yordam\n\n` +
        `<b>Muammo bo'lsa:</b>\n` +
        `@MidasSupportBot ga yozing\n\n` +
        `<b>Platforma haqida:</b>\n` +
        `MIDAS — O'zbekistonning reklama birjasi`,
    ru: `ℹ️ <b>MIDAS — Справка</b>\n\n` +
        `<b>Основные команды:</b>\n` +
        `/start — Главное меню\n` +
        `/menu — Меню\n` +
        `/deals — Активные сделки\n` +
        `/wallet — Кошелёк\n` +
        `/settings — Настройки\n` +
        `/help — Справка\n\n` +
        `<b>Поддержка:</b>\n` +
        `Напишите @MidasSupportBot`,
    en: `ℹ️ <b>MIDAS — Help</b>\n\n` +
        `<b>Main commands:</b>\n` +
        `/start — Main menu\n` +
        `/menu — Menu\n` +
        `/deals — Active deals\n` +
        `/wallet — Wallet\n` +
        `/settings — Settings\n` +
        `/help — Help\n\n` +
        `<b>Support:</b>\n` +
        `Contact @MidasSupportBot`,
  }

  await ctx.reply(text[lang], {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .url('💬 Support', 'https://t.me/MidasSupportBot')
  })
}

// ─── /settings command ─────────────────────
export async function settingsCommand(ctx: CommandContext<MyContext>) {
  const lang = ctx.session.lang || 'uz'

  const title = {
    uz: '⚙️ <b>Sozlamalar</b>',
    ru: '⚙️ <b>Настройки</b>',
    en: '⚙️ <b>Settings</b>',
  }

  const langLabel = {
    uz: `🌐 Til: O'zbek`,
    ru: '🌐 Язык: Русский',
    en: '🌐 Language: English',
  }

  const kb = new InlineKeyboard()
    .text(langLabel[lang], 'settings:change_lang').row()
    .text(
      lang === 'uz' ? '🔔 Bildirishnomalar' : lang === 'ru' ? '🔔 Уведомления' : '🔔 Notifications',
      'settings:notifications'
    ).row()
    .text(
      lang === 'uz' ? '👤 Profilni tahrirlash' : lang === 'ru' ? '👤 Редактировать профиль' : '👤 Edit profile',
      'settings:edit_profile'
    ).row()
    .webApp(
      lang === 'uz' ? '📊 Ilovada ochish' : lang === 'ru' ? '📊 Открыть в приложении' : '📊 Open in app',
      `${process.env.MINIAPP_URL}/settings`
    )

  await ctx.reply(title[lang], {
    parse_mode: 'HTML',
    reply_markup: kb,
  })
}

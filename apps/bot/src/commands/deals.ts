// MIDAS Bot — /deals command
import { CommandContext, InlineKeyboard } from 'grammy'
import { MyContext } from '../types'
import { apiClient } from '../utils/api.client'
import { formatMoney } from '@midas/shared'

export async function dealsCommand(ctx: CommandContext<MyContext>) {
  const lang = ctx.session.lang || 'uz'
  if (!ctx.session.userId) {
    return ctx.reply(lang === 'uz' ? 'Avval /start bosing.' : 'Сначала нажмите /start.')
  }

  try {
    const deals = (await apiClient.get<any[]>(`/deals/user/${ctx.session.userId}`, '')) || []
    const active = deals.filter(d => !['COMPLETED', 'CANCELLED', 'RESOLVED'].includes(d.status))

    if (!active.length) {
      return ctx.reply(
        lang === 'uz'
          ? '📋 Hozircha faol bitimlar yo\'q.\n\nYangi kampaniya boshlash uchun Mini App ni oching.'
          : lang === 'ru'
          ? '📋 Активных сделок нет.\n\nОткройте приложение для новых кампаний.'
          : '📋 No active deals.\n\nOpen the app to start new campaigns.',
        {
          reply_markup: new InlineKeyboard()
            .webApp(
              lang === 'uz' ? '📊 Ilovani ochish' : lang === 'ru' ? '📊 Открыть приложение' : '📊 Open app',
              process.env.MINIAPP_URL!
            )
        }
      )
    }

    const statusLabel: Record<string, Record<string, string>> = {
      PENDING:           { uz: 'Javob kutilmoqda',     ru: 'Ожидает ответа',      en: 'Pending' },
      ACCEPTED:          { uz: "To'lov kutilmoqda",    ru: 'Ожидает оплаты',      en: 'Payment pending' },
      ESCROW_HELD:       { uz: 'Kontent tayyorlash',   ru: 'Готовится контент',   en: 'Preparing content' },
      CONTENT_SUBMITTED: { uz: 'Tasdiqlash kutilmoqda',ru: 'Ожидает подтверждения',en: 'Awaiting approval' },
      DISPUTED:          { uz: 'Nizo',                 ru: 'Спор',                en: 'Disputed' },
    }

    const lines = active.slice(0, 5).map((d, i) => {
      const s = statusLabel[d.status]?.[lang] || d.status
      return `${i + 1}. <b>${d.campaignTitle || 'Kampaniya'}</b>\n   💰 ${formatMoney(d.price, lang)} · ${s}`
    })

    await ctx.reply(
      (lang === 'uz' ? `📋 <b>Faol bitimlar (${active.length} ta):</b>\n\n` :
       lang === 'ru' ? `📋 <b>Активные сделки (${active.length}):</b>\n\n` :
       `📋 <b>Active deals (${active.length}):</b>\n\n`) + lines.join('\n\n'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .webApp(
            lang === 'uz' ? '📊 Batafsil' : lang === 'ru' ? '📊 Подробнее' : '📊 Details',
            `${process.env.MINIAPP_URL}/deals`
          )
      }
    )
  } catch {
    await ctx.reply(lang === 'uz' ? '❌ Xatolik yuz berdi.' : '❌ Ошибка.')
  }
}

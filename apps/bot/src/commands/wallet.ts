// MIDAS Bot — /wallet command
import { CommandContext, InlineKeyboard } from 'grammy'
import { MyContext } from '../types'
import { apiClient } from '../utils/api.client'
import { formatMoney, maskCard } from '@midas/shared'

export async function walletCommand(ctx: CommandContext<MyContext>) {
  const lang = ctx.session.lang || 'uz'
  if (!ctx.session.userId) {
    return ctx.reply(lang === 'uz' ? 'Avval /start bosing.' : 'Сначала нажмите /start.')
  }

  try {
    const wallet = await apiClient.get<any>(`/users/${ctx.session.userId}/wallet`, '') as any

    const text =
      lang === 'uz'
        ? `💰 <b>Hamyon</b>\n\n` +
          `Mavjud balans: <b>${formatMoney(wallet.balance || 0, 'uz')}</b>\n` +
          `Bu oy tushum: <b>${formatMoney(wallet.monthlyIncome || 0, 'uz')}</b>\n` +
          `Jami tushum: <b>${formatMoney(wallet.totalIncome || 0, 'uz')}</b>\n` +
          (wallet.card ? `\nKarta: ${maskCard(wallet.card)}` : '')
        : lang === 'ru'
        ? `💰 <b>Кошелёк</b>\n\n` +
          `Доступный баланс: <b>${formatMoney(wallet.balance || 0, 'ru')}</b>\n` +
          `Доход за месяц: <b>${formatMoney(wallet.monthlyIncome || 0, 'ru')}</b>\n` +
          `Всего заработано: <b>${formatMoney(wallet.totalIncome || 0, 'ru')}</b>`
        : `💰 <b>Wallet</b>\n\n` +
          `Available: <b>${formatMoney(wallet.balance || 0, 'en')}</b>\n` +
          `This month: <b>${formatMoney(wallet.monthlyIncome || 0, 'en')}</b>`

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .webApp(
          lang === 'uz' ? '💸 Chiqarib olish' : lang === 'ru' ? '💸 Вывести' : '💸 Withdraw',
          `${process.env.MINIAPP_URL}/wallet`
        )
    })
  } catch {
    await ctx.reply(
      lang === 'uz' ? '❌ Hamyon ma\'lumotlari topilmadi.' : '❌ Данные кошелька не найдены.'
    )
  }
}

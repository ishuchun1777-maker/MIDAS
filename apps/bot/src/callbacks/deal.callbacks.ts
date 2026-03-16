// MIDAS Bot — Deal Callback Handlers
// apps/bot/src/callbacks/deal.callbacks.ts

import { Composer, InlineKeyboard } from 'grammy'
import { MyContext } from '../types'
import { acceptDeal, rejectDeal, submitContent, confirmContent, apiClient } from '../utils/api.client'
import { contentApproveKeyboard, dealResponseKeyboard } from '../keyboards'
import { formatMoney } from '@midas/shared'

const composer = new Composer<MyContext>()

// ─── Til tanlash callback ─────────────────
composer.callbackQuery(/^lang:/, async (ctx) => {
  const lang = ctx.callbackQuery.data.split(':')[1] as 'uz' | 'ru' | 'en'
  ctx.session.lang = lang
  ctx.session.__language_code = lang
  await ctx.i18n.setLocale(lang)
  await ctx.answerCallbackQuery()

  // Rol tanlash ga o'tamiz
  const roleKeyboard = new InlineKeyboard()
    .text(
      lang === 'uz' ? '🏪 Tadbirkor' : lang === 'ru' ? '🏪 Предприниматель' : '🏪 Business',
      'role:BUSINESS'
    ).row()
    .text(
      lang === 'uz' ? '📢 Reklamachi' : lang === 'ru' ? '📢 Рекламщик' : '📢 Advertiser',
      'role:ADVERTISER'
    ).row()
    .text(
      lang === 'uz' ? '🏢 Agentlik' : lang === 'ru' ? '🏢 Агентство' : '🏢 Agency',
      'role:AGENCY'
    )

  const text =
    lang === 'uz' ? '✅ O\'zbek tili tanlandi!\n\nSiz kim sifatida kirasiz?' :
    lang === 'ru' ? '✅ Выбран русский язык!\n\nКем вы являетесь?' :
    '✅ English selected!\n\nWhat is your role?'

  await ctx.editMessageText(text, { reply_markup: roleKeyboard })
})

// ─── Rol tanlash callback ─────────────────
composer.callbackQuery(/^role:/, async (ctx) => {
  const role = ctx.callbackQuery.data.split(':')[1]
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  const convMap: Record<string, string> = {
    BUSINESS:   'businessOnboarding',
    ADVERTISER: 'advertiserOnboarding',
    AGENCY:     'agencyOnboarding',
  }

  const convName = convMap[role]
  if (!convName) return

  const confirmText =
    role === 'BUSINESS'
      ? (lang === 'uz' ? '👍 Ajoyib! Tadbirkor sifatida ro\'yxatdan o\'tamiz.\n\nBiroz savollarimiz bor:' :
         lang === 'ru' ? '👍 Отлично! Регистрируемся как предприниматель.\n\nЗадам несколько вопросов:' :
         '👍 Great! Registering as a business.\n\nA few questions:')
      : role === 'ADVERTISER'
      ? (lang === 'uz' ? '👍 Zo\'r! Reklamachi sifatida ro\'yxatdan o\'tamiz.\n\nBiroz savollarimiz bor:' :
         lang === 'ru' ? '👍 Отлично! Регистрируемся как рекламщик.\n\nЗадам несколько вопросов:' :
         '👍 Great! Registering as an advertiser.\n\nA few questions:')
      : (lang === 'uz' ? '👍 Agentlik sifatida ro\'yxatdan o\'tamiz:' :
         '👍 Регистрируемся как агентство:')

  await ctx.editMessageText(confirmText)
  await ctx.conversation.enter(convName)
})

// ─── Nav callback (bosh menyu) ────────────
composer.callbackQuery('nav:main_menu', async (ctx) => {
  await ctx.answerCallbackQuery()
  const { showMainMenu } = await import('../commands/start')
  await showMainMenu(ctx)
})

// ─── Deal: qabul qilish ───────────────────
composer.callbackQuery(/^deal:accept:/, async (ctx) => {
  const dealId = ctx.callbackQuery.data.split(':')[2]
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  try {
    const deal = await acceptDeal(dealId, '') as any

    await ctx.editMessageText(
      lang === 'uz'
        ? `✅ <b>Taklif qabul qilindi!</b>\n\nBuyurtmachi to'lovni amalga oshirishi kutilmoqda.\nTo'lov tushgach, kontent tayyorlashni boshlaysiz.`
        : lang === 'ru'
        ? `✅ <b>Предложение принято!</b>\n\nОжидается оплата от заказчика.`
        : `✅ <b>Offer accepted!</b>\n\nWaiting for payment from the advertiser.`,
      { parse_mode: 'HTML' }
    )
  } catch (err) {
    await ctx.answerCallbackQuery(
      lang === 'uz' ? '❌ Xatolik yuz berdi' : '❌ Произошла ошибка'
    )
  }
})

// ─── Deal: rad etish ──────────────────────
composer.callbackQuery(/^deal:reject:/, async (ctx) => {
  const dealId = ctx.callbackQuery.data.split(':')[2]
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  try {
    await rejectDeal(dealId, 'Blogger refused', '')
    await ctx.editMessageText(
      lang === 'uz'
        ? '❌ Taklif rad etildi.'
        : lang === 'ru' ? '❌ Предложение отклонено.' : '❌ Offer declined.',
      { parse_mode: 'HTML' }
    )
  } catch {
    await ctx.answerCallbackQuery('❌ Error')
  }
})

// ─── Deal: kontent tasdiqlash (tadbirkor) ─
composer.callbackQuery(/^deal:approve:/, async (ctx) => {
  const dealId = ctx.callbackQuery.data.split(':')[2]
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  try {
    const deal = await confirmContent(dealId, '') as any
    const payout = deal?.advertiserPayout
      ? formatMoney(deal.advertiserPayout, lang)
      : ''

    await ctx.editMessageText(
      lang === 'uz'
        ? `✅ <b>Kontent tasdiqlandi!</b>\n\nTo'lov reklamachiga chiqarildi.\nBitim muvaffaqiyatli yakunlandi.`
        : lang === 'ru'
        ? `✅ <b>Контент подтверждён!</b>\n\nОплата переведена рекламщику.\nСделка успешно завершена.`
        : `✅ <b>Content approved!</b>\n\nPayment released to advertiser.\nDeal completed successfully.`,
      { parse_mode: 'HTML' }
    )
  } catch {
    await ctx.answerCallbackQuery('❌ Error')
  }
})

// ─── Deal: nizo ochish ────────────────────
composer.callbackQuery(/^deal:dispute:/, async (ctx) => {
  const dealId = ctx.callbackQuery.data.split(':')[2]
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  await ctx.reply(
    lang === 'uz'
      ? `⚠️ Nizo ochish uchun sabab yozing:\n\n<i>Masalan: "Kontent shartnomaga mos emas, logo ko'rinmaydi"</i>`
      : lang === 'ru'
      ? `⚠️ Опишите причину спора:\n\n<i>Например: "Контент не соответствует договору"</i>`
      : `⚠️ Describe the reason for the dispute:`,
    { parse_mode: 'HTML' }
  )

  // Keyingi xabarni dispute reason sifatida qabul qilamiz
  // Bu oddiy message handler orqali boshqariladi
  // (conversation ga o'tkazish ham mumkin, lekin bu MVP uchun yetarli)
})

// ─── Deals: ro'yxat ko'rish ───────────────
composer.callbackQuery('deals:list', async (ctx) => {
  const lang = ctx.session.lang || 'uz'
  await ctx.answerCallbackQuery()

  try {
    const deals = (await apiClient.get<any[]>(`/deals/user/${ctx.session.userId}`, '')) || []

    if (!deals.length) {
      return ctx.reply(
        lang === 'uz' ? 'Hozircha bitimlar yo\'q.' : 'Пока нет сделок.'
      )
    }

    const active = deals.filter(d => !['COMPLETED', 'CANCELLED'].includes(d.status))
    const statusEmoji: Record<string, string> = {
      PENDING: '⏳', ACCEPTED: '✅', ESCROW_HELD: '💰',
      CONTENT_SUBMITTED: '📎', PUBLISHED: '📤', DISPUTED: '⚠️',
    }

    const text = active.map(d =>
      `${statusEmoji[d.status] || '•'} <b>${d.businessName || 'Kampaniya'}</b>\n` +
      `   ${formatMoney(d.price, lang)} · ${d.status}`
    ).join('\n\n')

    await ctx.reply(
      (lang === 'uz' ? '📋 <b>Faol bitimlar:</b>\n\n' :
       lang === 'ru' ? '📋 <b>Активные сделки:</b>\n\n' :
       '📋 <b>Active deals:</b>\n\n') + (text || '—'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .webApp(
            lang === 'uz' ? '📊 Batafsil ko\'rish' : lang === 'ru' ? '📊 Подробнее' : '📊 View details',
            process.env.MINIAPP_URL + '/deals'
          )
      }
    )
  } catch {
    await ctx.reply(lang === 'uz' ? '❌ Xatolik.' : '❌ Ошибка.')
  }
})

export const dealCallbacks = composer

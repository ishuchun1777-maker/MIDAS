// MIDAS Bot — Tadbirkor Onboarding Scene
// apps/bot/src/scenes/business.onboarding.ts

import { InlineKeyboard } from 'grammy'
import { MyContext, MyConversation } from '../types'
import {
  phoneKeyboard,
  industryKeyboard,
  budgetKeyboard,
  regionKeyboard,
  openAppKeyboard,
} from '../keyboards'
import {
  apiClient,
  createBusinessProfile,
  updateUserRole,
  triggerAiMatching,
} from '../utils/api.client'

export async function businessOnboarding(
  conversation: MyConversation,
  ctx: MyContext
) {
  const lang = ctx.session.lang || 'uz'
  const t = (key: string, params?: object) => ctx.t(key, params)

  // ── Qadam 1: Telefon raqam ───────────────
  await ctx.reply(
    lang === 'uz'
      ? '📱 Telefon raqamingizni ulashing:'
      : lang === 'ru'
      ? '📱 Поделитесь своим номером телефона:'
      : '📱 Share your phone number:',
    { reply_markup: phoneKeyboard(lang) }
  )

  const phoneCtx = await conversation.waitFor('message:contact')
  const phone = phoneCtx.message.contact?.phone_number
  if (!phone) {
    await ctx.reply(lang === 'uz' ? "Telefon raqam olinmadi. /start bosing." : "Номер не получен. Нажмите /start.")
    return
  }
  ctx.session._ob.phone = phone
  await phoneCtx.reply(
    lang === 'uz' ? '✅ Qabul qilindi!' : lang === 'ru' ? '✅ Принято!' : '✅ Received!',
    { reply_markup: { remove_keyboard: true } }
  )

  // ── Qadam 2: Biznes nomi ─────────────────
  await ctx.reply(
    lang === 'uz'
      ? '🏪 Biznesingiz nomi nima?\n\n<i>Masalan: Plov House, Beauty Studio, TechMart</i>'
      : lang === 'ru'
      ? '🏪 Как называется ваш бизнес?\n\n<i>Например: Plov House, Beauty Studio</i>'
      : '🏪 What is your business name?\n\n<i>e.g. Plov House, Beauty Studio</i>',
    { parse_mode: 'HTML' }
  )

  const nameCtx = await conversation.waitFor('message:text')
  const businessName = nameCtx.message.text.trim()
  if (businessName.length < 2 || businessName.length > 100) {
    await ctx.reply(lang === 'uz' ? "Nom 2–100 belgi bo'lishi kerak." : "Название должно быть 2–100 символов.")
    return
  }
  ctx.session._ob.businessName = businessName

  // ── Qadam 3: Soha tanlash ────────────────
  await ctx.reply(
    lang === 'uz'
      ? '📋 Biznesingiz qaysi sohada?\n\nRo\'yxatdan tanlang:'
      : lang === 'ru'
      ? '📋 В какой сфере ваш бизнес?\n\nВыберите из списка:'
      : '📋 What industry is your business in?\n\nChoose from the list:',
    { reply_markup: industryKeyboard(lang) }
  )

  const industryCtx = await conversation.waitForCallbackQuery(/^industry:/)
  const industryCode = industryCtx.callbackQuery.data.split(':')[1]
  const industryNames: Record<string, Record<string, string>> = {
    restaurant: { uz: 'Restoran', ru: 'Ресторан', en: 'Restaurant' },
    fastfood: { uz: 'Tez ovqat', ru: 'Фастфуд', en: 'Fast food' },
    clothing: { uz: 'Kiyim', ru: 'Одежда', en: 'Clothing' },
    shoes: { uz: 'Poyabzal', ru: 'Обувь', en: 'Shoes' },
    electronics: { uz: 'Elektronika', ru: 'Электроника', en: 'Electronics' },
    beauty: { uz: "Go'zallik", ru: 'Красота', en: 'Beauty' },
    fitness: { uz: 'Fitnes', ru: 'Фитнес', en: 'Fitness' },
    education: { uz: "Ta'lim", ru: 'Образование', en: 'Education' },
    real_estate: { uz: "Ko'chmas mulk", ru: 'Недвижимость', en: 'Real Estate' },
    auto: { uz: 'Avtomobil', ru: 'Авто', en: 'Automotive' },
    pharmacy: { uz: 'Dorixona', ru: 'Аптека', en: 'Pharmacy' },
    travel: { uz: 'Sayohat', ru: 'Туризм', en: 'Travel' },
    finance: { uz: 'Moliya', ru: 'Финансы', en: 'Finance' },
    children: { uz: 'Bolalar', ru: 'Дети', en: 'Children' },
    pets: { uz: 'Hayvonlar', ru: 'Питомцы', en: 'Pets' },
    it: { uz: 'IT', ru: 'IT', en: 'IT' },
    wedding: { uz: "To'y xizmati", ru: 'Свадьба', en: 'Wedding' },
    grocery: { uz: 'Oziq-ovqat', ru: 'Продукты', en: 'Grocery' },
    medical: { uz: 'Tibbiyot', ru: 'Медицина', en: 'Medical' },
    entertainment: { uz: "Ko'ngilochar", ru: 'Развлечения', en: 'Entertainment' },
    other: { uz: 'Boshqa', ru: 'Другое', en: 'Other' },
  }
  ctx.session._ob.industryCode = industryCode
  ctx.session._ob.industryName = industryNames[industryCode]?.[lang] || industryCode
  await industryCtx.answerCallbackQuery()
  await ctx.reply(
    lang === 'uz' ? `✅ Soha: <b>${ctx.session._ob.industryName}</b>` : `✅ Сфера: <b>${ctx.session._ob.industryName}</b>`,
    { parse_mode: 'HTML' }
  )

  // ── Qadam 4: Hudud ───────────────────────
  await ctx.reply(
    lang === 'uz'
      ? '📍 Biznesingiz qaysi hududda joylashgan?'
      : lang === 'ru'
      ? '📍 В каком регионе находится ваш бизнес?'
      : '📍 In which region is your business located?',
    { reply_markup: regionKeyboard(lang) }
  )

  const regionCtx = await conversation.waitForCallbackQuery(/^region:/)
  const region = regionCtx.callbackQuery.data.split(':')[1]
  ctx.session._ob.region = region
  await regionCtx.answerCallbackQuery()

  // ── Qadam 5: Byudjet ─────────────────────
  await ctx.reply(
    lang === 'uz'
      ? '💰 Oylik reklama byudjetingiz taxminan qancha?'
      : lang === 'ru'
      ? '💰 Какой у вас примерный ежемесячный рекламный бюджет?'
      : '💰 What is your approximate monthly advertising budget?',
    { reply_markup: budgetKeyboard(lang) }
  )

  const budgetCtx = await conversation.waitForCallbackQuery(/^budget:/)
  const budget = budgetCtx.callbackQuery.data.split(':')[1]
  ctx.session._ob.budget = budget
  await budgetCtx.answerCallbackQuery()

  // ── Qadam 6: API ga saqlash ──────────────
  await ctx.reply(
    lang === 'uz'
      ? '⏳ Ma\'lumotlar saqlanmoqda...'
      : lang === 'ru'
      ? '⏳ Сохраняем данные...'
      : '⏳ Saving data...'
  )

  try {
    // Rol yangilash
    await updateUserRole(ctx.session.userId!, 'BUSINESS', '')

    // Profil yaratish
    const profile = await createBusinessProfile(
      ctx.session.userId!,
      {
        businessName: ctx.session._ob.businessName!,
        industryCode: ctx.session._ob.industryCode!,
        industryName: ctx.session._ob.industryName!,
        region: ctx.session._ob.region!,
        monthlyBudget: ctx.session._ob.budget!,
      },
      ''
    ) as any

    ctx.session.role = 'BUSINESS'

    // ── Qadam 7: AI tahlil ───────────────────
    await ctx.reply(
      lang === 'uz'
        ? '🤖 AI sizning soha va byudjetingizga mos reklamachilarni qidiryapti...\n\n<i>Bu bir necha soniya oladi</i>'
        : lang === 'ru'
        ? '🤖 AI ищет подходящих рекламщиков для вашей сферы...\n\n<i>Займёт несколько секунд</i>'
        : '🤖 AI is finding matching advertisers for your industry...\n\n<i>This takes a few seconds</i>',
      { parse_mode: 'HTML' }
    )

    // Kampaniya avtomatik yaratib AI ni ishga tushiramiz
    const campaign = await apiClient.post('/campaigns/auto', {
      businessId: profile.id,
      title: ctx.session._ob.businessName,
      industryCode: ctx.session._ob.industryCode,
      region: ctx.session._ob.region,
      budget: ctx.session._ob.budget,
    }, '') as any

    if (campaign?.id) {
      await triggerAiMatching(campaign.id, '')
    }

    // ── Natija ───────────────────────────────
    const miniAppUrl = `${process.env.MINIAPP_URL}?startapp=matches_${campaign?.id || ''}`

    await ctx.reply(
      lang === 'uz'
        ? `✅ <b>Profil muvaffaqiyatli yaratildi!</b>\n\n🏪 <b>${ctx.session._ob.businessName}</b>\n📋 Soha: ${ctx.session._ob.industryName}\n\nAI tavsiyalarini ko'rish uchun ilovani oching:`
        : lang === 'ru'
        ? `✅ <b>Профиль успешно создан!</b>\n\n🏪 <b>${ctx.session._ob.businessName}</b>\n📋 Сфера: ${ctx.session._ob.industryName}\n\nОткройте приложение для просмотра рекомендаций:`
        : `✅ <b>Profile created successfully!</b>\n\n🏪 <b>${ctx.session._ob.businessName}</b>\n📋 Industry: ${ctx.session._ob.industryName}\n\nOpen the app to see recommendations:`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .webApp(
            lang === 'uz' ? '🎯 AI tavsiyalarni ko\'rish' : lang === 'ru' ? '🎯 Смотреть рекомендации' : '🎯 View AI recommendations',
            miniAppUrl
          ).row()
          .text(
            lang === 'uz' ? '📋 Bosh menyu' : lang === 'ru' ? '📋 Главное меню' : '📋 Main menu',
            'nav:main_menu'
          ),
      }
    )

    // Session tozalash
    ctx.session._ob = {}

  } catch (err) {
    console.error('Business onboarding error:', err)
    await ctx.reply(
      lang === 'uz'
        ? '❌ Xatolik yuz berdi. Qayta urinib ko\'ring: /start'
        : '❌ Произошла ошибка. Попробуйте снова: /start'
    )
  }
}

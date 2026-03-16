// MIDAS Bot — Reklamachi Onboarding Scene
// apps/bot/src/scenes/advertiser.onboarding.ts

import { InlineKeyboard } from 'grammy'
import { MyContext, MyConversation } from '../types'
import {
  phoneKeyboard,
  platformKeyboard,
  ageRangeKeyboard,
  genderKeyboard,
  regionKeyboard,
  skipKeyboard,
} from '../keyboards'
import {
  createAdvertiserProfile,
  updateUserRole,
} from '../utils/api.client'

export async function advertiserOnboarding(
  conversation: MyConversation,
  ctx: MyContext
) {
  const lang = ctx.session.lang || 'uz'

  const L = {
    uz: {
      phone: '📱 Telefon raqamingizni ulashing:',
      platform: '📢 Siz qaysi platformada ishlaysiz?',
      handle_tg: '📱 Telegram kanalingizni ulash uchun:\n\n1. @MidasVerifyBot ni kanalingizga admin qilib qo\'shing\n2. Kanal havolasini yuboring (masalan: @sizning_kanal)',
      handle_other: '🔗 Sahifangiz havolasini yuboring:\n\n<i>Masalan: https://instagram.com/sizning_sahifa</i>',
      handle_billboard: '📍 Billboardning manzilini kiriting:\n\n<i>Masalan: Chilonzor ko\'chasi 15, Toshkent</i>',
      followers: '👥 Taxminiy obunachilar / kuzatuvchilar sonini kiriting:\n\n<i>Masalan: 48000</i>',
      price_post: "💰 Post uchun narxingiz (so'mda)?\n\n<i>Masalan: 1500000</i>",
      price_story: "📊 Story/Reels uchun narxingiz (so'mda)? (ixtiyoriy)",
      age: '👥 Auditoriyangizning asosiy yoshi qaysi?',
      gender: '⚧ Auditoriyangiz asosan kimlardan iborat?',
      region: '📍 Auditoriyangiz ko\'proq qaysi hududda?',
      verif_sent: '✅ <b>Arizangiz qabul qilindi!</b>\n\n⏳ Profilingiz 24 soat ichida tekshiriladi.\nNatija haqida xabar olasiz.\n\n<b>Tekshirish jarayoni:</b>\n• Auditoriya haqiqiyligi skaneri\n• Fraud ball hisoblash\n• Admin tasdiqlashi',
      error: '❌ Xatolik yuz berdi. Qayta urinib ko\'ring: /start',
      invalid_num: "Iltimos, faqat raqam kiriting. Masalan: 48000",
      invalid_price: "Iltimos, narxni raqamda kiriting. Masalan: 1500000",
    },
    ru: {
      phone: '📱 Поделитесь своим номером телефона:',
      platform: '📢 На какой платформе вы работаете?',
      handle_tg: '📱 Для подключения Telegram канала:\n\n1. Добавьте @MidasVerifyBot как администратора\n2. Отправьте ссылку на канал (например: @vash_kanal)',
      handle_other: '🔗 Отправьте ссылку на вашу страницу:\n\n<i>Например: https://instagram.com/vasha_stranitsa</i>',
      handle_billboard: '📍 Введите адрес билборда:\n\n<i>Например: ул. Чиланзарская 15, Ташкент</i>',
      followers: '👥 Укажите примерное количество подписчиков:\n\n<i>Например: 48000</i>',
      price_post: '💰 Ваша цена за пост (в сумах)?\n\n<i>Например: 1500000</i>',
      price_story: '📊 Ваша цена за Story/Reels (в сумах)? (необязательно)',
      age: '👥 Какой основной возраст вашей аудитории?',
      gender: '⚧ Из кого в основном состоит ваша аудитория?',
      region: '📍 В каком регионе больше всего ваша аудитория?',
      verif_sent: '✅ <b>Заявка принята!</b>\n\n⏳ Ваш профиль будет проверен в течение 24 часов.\nМы уведомим вас о результате.',
      error: '❌ Произошла ошибка. Попробуйте снова: /start',
      invalid_num: 'Пожалуйста, введите только цифры. Например: 48000',
      invalid_price: 'Пожалуйста, введите цену цифрами. Например: 1500000',
    },
    en: {
      phone: '📱 Share your phone number:',
      platform: '📢 Which platform do you work on?',
      handle_tg: '📱 To connect your Telegram channel:\n\n1. Add @MidasVerifyBot as admin\n2. Send channel link (e.g. @your_channel)',
      handle_other: '🔗 Send your profile link:\n\n<i>e.g. https://instagram.com/your_page</i>',
      handle_billboard: '📍 Enter the billboard address:\n\n<i>e.g. 15 Chilonzor Street, Tashkent</i>',
      followers: '👥 Enter approximate subscriber/follower count:\n\n<i>e.g. 48000</i>',
      price_post: '💰 Your price per post (in UZS)?\n\n<i>e.g. 1500000</i>',
      price_story: '📊 Your price per Story/Reel (in UZS)? (optional)',
      age: '👥 What is the main age range of your audience?',
      gender: '⚧ Who is your audience mostly composed of?',
      region: '📍 In which region is most of your audience?',
      verif_sent: '✅ <b>Application submitted!</b>\n\n⏳ Your profile will be reviewed within 24 hours.\nYou will be notified of the result.',
      error: '❌ An error occurred. Try again: /start',
      invalid_num: 'Please enter numbers only. e.g. 48000',
      invalid_price: 'Please enter price in numbers. e.g. 1500000',
    },
  }
  const lx = L[lang]

  // ── Qadam 1: Telefon ─────────────────────
  await ctx.reply(lx.phone, { reply_markup: phoneKeyboard(lang) })

  const phoneCtx = await conversation.waitFor('message:contact')
  const phone = phoneCtx.message.contact?.phone_number
  if (!phone) return
  ctx.session._ob.phone = phone
  await phoneCtx.reply('✅', { reply_markup: { remove_keyboard: true } })

  // ── Qadam 2: Platforma ───────────────────
  await ctx.reply(lx.platform, { reply_markup: platformKeyboard(lang) })

  const platformCtx = await conversation.waitForCallbackQuery(/^platform:/)
  const advertiserType = platformCtx.callbackQuery.data.split(':')[1]
  ctx.session._ob.advertiserType = advertiserType
  await platformCtx.answerCallbackQuery()

  // ── Qadam 3: Kanal/sahifa ulash ──────────
  const handlePrompt =
    advertiserType === 'TELEGRAM_CHANNEL' ? lx.handle_tg :
    advertiserType === 'BILLBOARD' || advertiserType === 'LED_SCREEN' ? lx.handle_billboard :
    lx.handle_other

  await ctx.reply(handlePrompt, {
    parse_mode: 'HTML',
    reply_markup: skipKeyboard(lang),
  })

  const handleCtx = await conversation.waitFor(['message:text', 'callback_query'])
  let platformHandle: string | undefined

  if ('message' in handleCtx.update && handleCtx.update.message?.text) {
    const text = handleCtx.update.message.text.trim()
    if (text !== 'skip:step') {
      platformHandle = text
      ctx.session._ob.platformHandle = platformHandle
    }
  }

  // ── Qadam 4: Obunachilar soni ─────────────
  await ctx.reply(lx.followers)

  let followerCount = 0
  while (true) {
    const fc = await conversation.waitFor('message:text')
    const num = parseInt(fc.message.text.replace(/\s/g, ''), 10)
    if (isNaN(num) || num < 0) {
      await ctx.reply(lx.invalid_num)
      continue
    }
    followerCount = num
    ctx.session._ob.followerCount = followerCount
    break
  }

  // ── Qadam 5: Post narxi ───────────────────
  await ctx.reply(lx.price_post)

  let pricePost = 0
  while (true) {
    const pc = await conversation.waitFor('message:text')
    const num = parseInt(pc.message.text.replace(/\s/g, ''), 10)
    if (isNaN(num) || num < 1000) {
      await ctx.reply(lx.invalid_price)
      continue
    }
    pricePost = num
    ctx.session._ob.pricePost = pricePost
    break
  }

  // ── Qadam 5b: Story narxi (ixtiyoriy) ────
  await ctx.reply(lx.price_story, { reply_markup: skipKeyboard(lang) })

  const storyCtx = await conversation.waitFor(['message:text', 'callback_query'])
  if ('message' in storyCtx.update && storyCtx.update.message?.text) {
    const num = parseInt(storyCtx.update.message.text.replace(/\s/g, ''), 10)
    if (!isNaN(num) && num >= 1000) {
      ctx.session._ob.priceStory = num
    }
  }

  // ── Qadam 6: Auditoriya ma'lumotlari ─────
  await ctx.reply(lx.age, { reply_markup: ageRangeKeyboard(lang) })
  const ageCtx = await conversation.waitForCallbackQuery(/^age:/)
  const [ageMin, ageMax] = ageCtx.callbackQuery.data.split(':').slice(1).map(Number)
  ctx.session._ob.ageMin = ageMin
  ctx.session._ob.ageMax = ageMax
  await ageCtx.answerCallbackQuery()

  await ctx.reply(lx.gender, { reply_markup: genderKeyboard(lang) })
  const genderCtx = await conversation.waitForCallbackQuery(/^gender:/)
  ctx.session._ob.gender = genderCtx.callbackQuery.data.split(':')[1]
  await genderCtx.answerCallbackQuery()

  await ctx.reply(
    lang === 'uz' ? '📍 Auditoriyangiz ko\'proq qaysi hududda?' :
    lang === 'ru' ? '📍 В каком регионе большинство вашей аудитории?' :
    '📍 Where is most of your audience located?',
    { reply_markup: regionKeyboard(lang) }
  )
  const regCtx = await conversation.waitForCallbackQuery(/^region:/)
  const region = regCtx.callbackQuery.data.split(':')[1]
  await regCtx.answerCallbackQuery()

  // ── Qadam 7: Saqlash va verifikatsiya ────
  await ctx.reply(
    lang === 'uz' ? '⏳ Profil yaratilmoqda...' :
    lang === 'ru' ? '⏳ Создаём профиль...' :
    '⏳ Creating profile...'
  )

  try {
    await updateUserRole(ctx.session.userId!, 'ADVERTISER', '')

    await createAdvertiserProfile(
      ctx.session.userId!,
      {
        advertiserType,
        platformHandle,
        followerCount,
        pricePost,
        priceStory: ctx.session._ob.priceStory,
        audienceData: {
          age_min: ctx.session._ob.ageMin || 18,
          age_max: ctx.session._ob.ageMax || 45,
          gender_split: ctx.session._ob.gender === 'male'
            ? { male: 70, female: 30 }
            : ctx.session._ob.gender === 'female'
            ? { male: 25, female: 75 }
            : { male: 50, female: 50 },
          top_regions: [region],
          interests: [],
          income_level: 'medium',
        },
      },
      ''
    )

    ctx.session.role = 'ADVERTISER'

    await ctx.reply(lx.verif_sent, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(
          lang === 'uz' ? '📋 Bosh menyu' : lang === 'ru' ? '📋 Главное меню' : '📋 Main menu',
          'nav:main_menu'
        )
    })

    ctx.session._ob = {}

  } catch (err) {
    console.error('Advertiser onboarding error:', err)
    await ctx.reply(lx.error)
  }
}

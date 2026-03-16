// MIDAS Bot — Agentlik Onboarding Scene
// apps/bot/src/scenes/agency.onboarding.ts

import { InlineKeyboard } from 'grammy'
import { MyContext, MyConversation } from '../types'
import { phoneKeyboard, skipKeyboard } from '../keyboards'
import { createAgencyProfile, updateUserRole } from '../utils/api.client'

export async function agencyOnboarding(
  conversation: MyConversation,
  ctx: MyContext
) {
  const lang = ctx.session.lang || 'uz'

  const L = {
    uz: {
      phone: '📱 Telefon raqamingizni ulashing:',
      company: '🏢 Agentlik/kompaniya nomini kiriting:',
      legal: '📄 Yuridik nomi (ixtiyoriy):',
      inn: '🔢 Soliq ID (INN) raqami (ixtiyoriy):',
      license: '📎 Litsenziya yoki faoliyat hujjatini yuboring (ixtiyoriy):\n\n<i>Rasm yoki PDF formatida</i>',
      verif: '✅ <b>Agentlik arizasi yuborildi!</b>\n\n⏳ 48 soat ichida ko\'rib chiqiladi.\nTasdiqlangach to\'liq agentlik paneli ochiladi.',
      err: '❌ Xatolik. /start bosing.',
    },
    ru: {
      phone: '📱 Поделитесь своим номером телефона:',
      company: '🏢 Введите название агентства/компании:',
      legal: '📄 Юридическое название (необязательно):',
      inn: '🔢 ИНН (необязательно):',
      license: '📎 Отправьте лицензию или документ (необязательно):\n\n<i>В формате изображения или PDF</i>',
      verif: '✅ <b>Заявка агентства отправлена!</b>\n\n⏳ Будет рассмотрена в течение 48 часов.',
      err: '❌ Ошибка. Нажмите /start.',
    },
    en: {
      phone: '📱 Share your phone number:',
      company: '🏢 Enter agency/company name:',
      legal: '📄 Legal name (optional):',
      inn: '🔢 Tax ID (optional):',
      license: '📎 Send license or business document (optional):\n\n<i>Image or PDF format</i>',
      verif: '✅ <b>Agency application submitted!</b>\n\n⏳ Will be reviewed within 48 hours.',
      err: '❌ Error. Press /start.',
    },
  }
  const lx = L[lang]
  const skip = skipKeyboard(lang)

  // Telefon
  await ctx.reply(lx.phone, { reply_markup: phoneKeyboard(lang) })
  const phoneCtx = await conversation.waitFor('message:contact')
  if (!phoneCtx.message.contact?.phone_number) return
  await phoneCtx.reply('✅', { reply_markup: { remove_keyboard: true } })

  // Kompaniya nomi
  await ctx.reply(lx.company)
  const compCtx = await conversation.waitFor('message:text')
  const companyName = compCtx.message.text.trim()
  if (companyName.length < 2) { await ctx.reply(lx.err); return }
  ctx.session._ob.companyName = companyName

  // Yuridik nom (ixtiyoriy)
  await ctx.reply(lx.legal, { reply_markup: skip })
  const legalCtx = await conversation.waitFor(['message:text', 'callback_query'])
  let legalName: string | undefined
  if ('message' in legalCtx.update) {
    const txt = legalCtx.update.message?.text?.trim()
    if (txt && !txt.startsWith('skip')) legalName = txt
  }

  // INN (ixtiyoriy)
  await ctx.reply(lx.inn, { reply_markup: skip })
  const innCtx = await conversation.waitFor(['message:text', 'callback_query'])
  // (saqlanmaydi MVP da, faqat UI uchun)

  // Litsenziya (ixtiyoriy)
  await ctx.reply(lx.license, {
    parse_mode: 'HTML',
    reply_markup: skip,
  })
  const licCtx = await conversation.waitFor(['message:document', 'message:photo', 'callback_query'])
  let licenseUrl: string | undefined
  // Hujjat URL keyinchalik file storage orqali olinadi

  // Saqlash
  try {
    await updateUserRole(ctx.session.userId!, 'AGENCY', '')
    await createAgencyProfile(ctx.session.userId!, { companyName, legalName, licenseUrl }, '')
    ctx.session.role = 'AGENCY'

    await ctx.reply(lx.verif, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(
        lang === 'uz' ? '📋 Bosh menyu' : lang === 'ru' ? '📋 Меню' : '📋 Menu',
        'nav:main_menu'
      ),
    })
    ctx.session._ob = {}
  } catch {
    await ctx.reply(lx.err)
  }
}

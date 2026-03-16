// MIDAS Bot — Keyboards
// apps/bot/src/keyboards/index.ts

import { InlineKeyboard, Keyboard } from 'grammy'
import { UZBEKISTAN_REGIONS, INDUSTRY_CODES } from '@midas/shared'

// ─── Til tanlash ──────────────────────────
export function langKeyboard() {
  return new InlineKeyboard()
    .text("🇺🇿 O'zbek", 'lang:uz').row()
    .text('🇷🇺 Русский', 'lang:ru').row()
    .text('🇬🇧 English', 'lang:en')
}

// ─── Rol tanlash ──────────────────────────
export function roleKeyboard(t: Function) {
  return new InlineKeyboard()
    .text('🏪 ' + t('onboarding.role_business'), 'role:BUSINESS').row()
    .text('📢 ' + t('onboarding.role_advertiser'), 'role:ADVERTISER').row()
    .text('🏢 ' + t('onboarding.role_agency'), 'role:AGENCY')
}

// ─── Telefon yuborish ─────────────────────
export function phoneKeyboard(t: Function) {
  return new Keyboard()
    .requestContact('📱 ' + t('onboarding.share_phone'))
    .resized()
    .oneTime()
}

// ─── Soha tanlash ─────────────────────────
export function industryKeyboard(lang: 'uz' | 'ru' | 'en') {
  const industries: Record<string, Record<string, string>> = {
    restaurant:   { uz: '🍽 Restoran',       ru: '🍽 Ресторан',       en: '🍽 Restaurant' },
    fastfood:     { uz: '🍔 Tez ovqat',      ru: '🍔 Фастфуд',       en: '🍔 Fast food' },
    clothing:     { uz: '👗 Kiyim',          ru: '👗 Одежда',         en: '👗 Clothing' },
    shoes:        { uz: '👟 Poyabzal',       ru: '👟 Обувь',          en: '👟 Shoes' },
    electronics:  { uz: '📱 Elektronika',    ru: '📱 Электроника',    en: '📱 Electronics' },
    beauty:       { uz: '💄 Go\'zallik',     ru: '💄 Красота',        en: '💄 Beauty' },
    fitness:      { uz: '💪 Fitnes',         ru: '💪 Фитнес',         en: '💪 Fitness' },
    education:    { uz: '📚 Ta\'lim',        ru: '📚 Образование',    en: '📚 Education' },
    real_estate:  { uz: '🏠 Ko\'chmas mulk', ru: '🏠 Недвижимость',   en: '🏠 Real Estate' },
    auto:         { uz: '🚗 Avtomobil',      ru: '🚗 Авто',           en: '🚗 Automotive' },
    pharmacy:     { uz: '💊 Dorixona',       ru: '💊 Аптека',         en: '💊 Pharmacy' },
    travel:       { uz: '✈️ Sayohat',        ru: '✈️ Туризм',         en: '✈️ Travel' },
    finance:      { uz: '💰 Moliya',         ru: '💰 Финансы',        en: '💰 Finance' },
    children:     { uz: '🧒 Bolalar',        ru: '🧒 Дети',           en: '🧒 Children' },
    pets:         { uz: '🐾 Hayvonlar',      ru: '🐾 Питомцы',        en: '🐾 Pets' },
    it:           { uz: '💻 IT / Dasturlar', ru: '💻 IT /软件',      en: '💻 IT / Software' },
    wedding:      { uz: '💒 To\'y xizmati',  ru: '💒 Свадьба',        en: '💒 Wedding' },
    grocery:      { uz: '🛒 Oziq-ovqat',     ru: '🛒 Продукты',       en: '🛒 Grocery' },
    medical:      { uz: '🏥 Tibbiyot',       ru: '🏥 Медицина',       en: '🏥 Medical' },
    entertainment:{ uz: '🎭 Ko\'ngilochar',  ru: '🎭 Развлечения',    en: '🎭 Entertainment' },
    other:        { uz: '📦 Boshqa',         ru: '📦 Другое',         en: '📦 Other' },
  }

  const kb = new InlineKeyboard()
  const entries = Object.entries(industries)
  for (let i = 0; i < entries.length; i += 2) {
    const [code1, names1] = entries[i]
    const [code2, names2] = entries[i + 1] || []
    if (code2) {
      kb.text(names1[lang], `industry:${code1}`)
        .text(names2[lang], `industry:${code2}`).row()
    } else {
      kb.text(names1[lang], `industry:${code1}`).row()
    }
  }
  return kb
}

// ─── Byudjet tanlash ──────────────────────
export function budgetKeyboard(lang: 'uz' | 'ru' | 'en') {
  const labels: Record<string, Record<string, string>> = {
    SMALL:      { uz: "500 000 so'mgacha",    ru: 'До 500 000 сум',    en: 'Up to 500,000' },
    MEDIUM:     { uz: "500K – 2 mln so'm",    ru: '500K – 2 млн сум',  en: '500K – 2M UZS' },
    LARGE:      { uz: "2 mln – 10 mln so'm",  ru: '2 млн – 10 млн',    en: '2M – 10M UZS' },
    ENTERPRISE: { uz: "10 mln so'm va undan", ru: '10 млн и выше',     en: '10M+ UZS' },
  }
  return new InlineKeyboard()
    .text(labels.SMALL[lang],      'budget:SMALL').row()
    .text(labels.MEDIUM[lang],     'budget:MEDIUM').row()
    .text(labels.LARGE[lang],      'budget:LARGE').row()
    .text(labels.ENTERPRISE[lang], 'budget:ENTERPRISE')
}

// ─── Hudud tanlash ────────────────────────
export function regionKeyboard(lang: 'uz' | 'ru' | 'en') {
  const kb = new InlineKeyboard()
  const regions = UZBEKISTAN_REGIONS.slice(0, 8) // Top 8 hudud
  for (let i = 0; i < regions.length; i += 2) {
    const r1 = regions[i]
    const r2 = regions[i + 1]
    if (r2) {
      kb.text(r1[lang], `region:${r1.code}`)
        .text(r2[lang], `region:${r2.code}`).row()
    } else {
      kb.text(r1[lang], `region:${r1.code}`).row()
    }
  }
  kb.text(lang === 'uz' ? "📍 Boshqa hudud" : lang === 'ru' ? "📍 Другой регион" : "📍 Other region", 'region:other')
  return kb
}

// ─── Platforma tanlash ────────────────────
export function platformKeyboard(lang: 'uz' | 'ru' | 'en') {
  const labels: Record<string, Record<string, string>> = {
    TELEGRAM_CHANNEL: { uz: '📱 Telegram kanal', ru: '📱 Telegram канал', en: '📱 Telegram channel' },
    INSTAGRAM:        { uz: '📸 Instagram',       ru: '📸 Instagram',      en: '📸 Instagram' },
    YOUTUBE:          { uz: '▶️ YouTube',          ru: '▶️ YouTube',         en: '▶️ YouTube' },
    TIKTOK:           { uz: '🎵 TikTok',          ru: '🎵 TikTok',         en: '🎵 TikTok' },
    BILLBOARD:        { uz: '🪧 Billboard',        ru: '🪧 Билборд',        en: '🪧 Billboard' },
    LED_SCREEN:       { uz: '💡 LED ekran',        ru: '💡 LED экран',      en: '💡 LED screen' },
  }
  return new InlineKeyboard()
    .text(labels.TELEGRAM_CHANNEL[lang], 'platform:TELEGRAM_CHANNEL')
    .text(labels.INSTAGRAM[lang],        'platform:INSTAGRAM').row()
    .text(labels.YOUTUBE[lang],          'platform:YOUTUBE')
    .text(labels.TIKTOK[lang],           'platform:TIKTOK').row()
    .text(labels.BILLBOARD[lang],        'platform:BILLBOARD')
    .text(labels.LED_SCREEN[lang],       'platform:LED_SCREEN')
}

// ─── Auditoriya yoshi ─────────────────────
export function ageRangeKeyboard(lang: 'uz' | 'ru' | 'en') {
  const labels: Record<string, string[]> = {
    uz: ['13–17 yosh', '18–24 yosh', '25–34 yosh', '35–44 yosh', '45+ yosh'],
    ru: ['13–17 лет',  '18–24 года', '25–34 года', '35–44 года', '45+ лет'],
    en: ['13–17 years','18–24 years','25–34 years','35–44 years','45+ years'],
  }
  const data = ['13:17', '18:24', '25:34', '35:44', '45:99']
  const kb = new InlineKeyboard()
  labels[lang].forEach((lbl, i) => kb.text(lbl, `age:${data[i]}`).row())
  return kb
}

// ─── Auditoriya jinsi ─────────────────────
export function genderKeyboard(lang: 'uz' | 'ru' | 'en') {
  const l: Record<string, string[]> = {
    uz: ['👨 Erkaklar ko\'proq', '👩 Ayollar ko\'proq', '👥 Aralash'],
    ru: ['👨 Больше мужчин',    '👩 Больше женщин',    '👥 Смешанная'],
    en: ['👨 Mostly male',       '👩 Mostly female',    '👥 Mixed'],
  }
  return new InlineKeyboard()
    .text(l[lang][0], 'gender:male').row()
    .text(l[lang][1], 'gender:female').row()
    .text(l[lang][2], 'gender:mixed')
}

// ─── Skip tugmasi ─────────────────────────
export function skipKeyboard(lang: 'uz' | 'ru' | 'en') {
  const labels = { uz: "⏭ O'tkazib yuborish", ru: '⏭ Пропустить', en: '⏭ Skip' }
  return new InlineKeyboard().text(labels[lang], 'skip:step')
}

// ─── Bitim qabul/rad ──────────────────────
export function dealResponseKeyboard(dealId: string, lang: 'uz' | 'ru' | 'en') {
  const l: Record<string, string[]> = {
    uz: ['✅ Qabul qilish', '❌ Rad etish'],
    ru: ['✅ Принять',      '❌ Отклонить'],
    en: ['✅ Accept',        '❌ Decline'],
  }
  return new InlineKeyboard()
    .text(l[lang][0], `deal:accept:${dealId}`)
    .text(l[lang][1], `deal:reject:${dealId}`)
}

// ─── Kontent tasdiqlash ───────────────────
export function contentApproveKeyboard(dealId: string, lang: 'uz' | 'ru' | 'en') {
  const l: Record<string, string[]> = {
    uz: ['✅ Tasdiqlash', '⚠️ Nizo ochish'],
    ru: ['✅ Подтвердить', '⚠️ Открыть спор'],
    en: ['✅ Approve',     '⚠️ Open dispute'],
  }
  return new InlineKeyboard()
    .text(l[lang][0], `deal:approve:${dealId}`).row()
    .text(l[lang][1], `deal:dispute:${dealId}`)
}

// ─── Mini App ochish ──────────────────────
export function openAppKeyboard(label: string, url: string) {
  return new InlineKeyboard().webApp(label, url)
}

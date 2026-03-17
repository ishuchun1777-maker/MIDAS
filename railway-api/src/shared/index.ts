// MIDAS Shared — Types, Constants, Utils
// packages/shared/src/index.ts

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────

export const MIDAS = {
  COMMISSION_RATE: 0.07,          // 7%
  FREE_DEALS_PER_MONTH: 5,
  FRAUD_SUSPEND_THRESHOLD: 60,    // 60 dan past → suspend
  CONTENT_DEADLINE_HOURS: 48,     // Kontent topshirish muddati
  DISPUTE_AUTO_RESOLVE_HOURS: 48, // Avtomatik yopish muddati
  ADMIN_RESOLVE_HOURS: 72,        // Admin qaror berish muddati
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_EXPIRES: '7d',
  SUPPORTED_LANGS: ['uz', 'ru', 'en'] as const,
  DEFAULT_LANG: 'uz' as const,
} as const

export const BUDGET_RANGES = {
  SMALL:      { min: 0,         max: 500_000,    label: { uz: '500 000 gacha', ru: 'До 500 000', en: 'Up to 500,000' } },
  MEDIUM:     { min: 500_000,   max: 2_000_000,  label: { uz: '500K – 2 mln',  ru: '500K – 2 млн', en: '500K – 2M' } },
  LARGE:      { min: 2_000_000, max: 10_000_000, label: { uz: '2 – 10 mln',    ru: '2 – 10 млн',   en: '2M – 10M' } },
  ENTERPRISE: { min: 10_000_000, max: Infinity,  label: { uz: '10 mln+',       ru: '10 млн+',      en: '10M+' } },
} as const

export const UZBEKISTAN_REGIONS = [
  { code: 'tashkent',    uz: 'Toshkent shahri',    ru: 'г. Ташкент',      en: 'Tashkent city' },
  { code: 'tashkent_r', uz: 'Toshkent viloyati',  ru: 'Ташкентская обл.', en: 'Tashkent region' },
  { code: 'samarkand',  uz: 'Samarqand',           ru: 'Самарканд',        en: 'Samarkand' },
  { code: 'bukhara',    uz: 'Buxoro',              ru: 'Бухара',           en: 'Bukhara' },
  { code: 'andijan',    uz: 'Andijon',             ru: 'Андижан',          en: 'Andijan' },
  { code: 'fergana',    uz: 'Farg\'ona',           ru: 'Фергана',          en: 'Fergana' },
  { code: 'namangan',   uz: 'Namangan',            ru: 'Наманган',         en: 'Namangan' },
  { code: 'kashkadarya',uz: 'Qashqadaryo',         ru: 'Кашкадарья',       en: 'Kashkadarya' },
  { code: 'surkhandarya',uz:'Surxondaryo',         ru: 'Сурхандарья',      en: 'Surkhandarya' },
  { code: 'jizzakh',    uz: 'Jizzax',              ru: 'Джизак',           en: 'Jizzakh' },
  { code: 'syrdarya',   uz: 'Sirdaryo',            ru: 'Сырдарья',         en: 'Syrdarya' },
  { code: 'navai',      uz: 'Navoiy',              ru: 'Навои',            en: 'Navoi' },
  { code: 'khorezm',    uz: 'Xorazm',              ru: 'Хорезм',           en: 'Khorezm' },
  { code: 'karakalpak', uz: 'Qoraqalpog\'iston',   ru: 'Каракалпакстан',   en: 'Karakalpakstan' },
] as const

export const INDUSTRY_CODES = [
  'restaurant', 'fastfood', 'cafe',
  'clothing', 'shoes', 'accessories',
  'electronics', 'appliances', 'gadgets',
  'beauty', 'cosmetics', 'salon',
  'fitness', 'sports', 'gym',
  'education', 'courses', 'tutoring',
  'real_estate', 'construction', 'furniture',
  'auto', 'auto_parts', 'auto_service',
  'pharmacy', 'medical', 'clinic',
  'travel', 'tourism', 'hotel',
  'finance', 'insurance', 'banking',
  'entertainment', 'events', 'games',
  'grocery', 'market', 'delivery',
  'it', 'software', 'startup',
  'wedding', 'photography', 'design',
  'children', 'toys', 'baby',
  'pets', 'vet', 'pet_shop',
  'legal', 'accounting', 'consulting',
  'other',
] as const

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type Lang = 'uz' | 'ru' | 'en'
export type Region = typeof UZBEKISTAN_REGIONS[number]['code']
export type IndustryCode = typeof INDUSTRY_CODES[number]

export interface LocalizedText {
  uz: string
  ru: string
  en: string
}

export interface AudienceProfile {
  age_min: number
  age_max: number
  gender: 'male' | 'female' | 'mixed'
  regions: Region[]
  interests: string[]
  income_level: 'low' | 'medium' | 'high' | 'mixed'
}

export interface AudienceData extends AudienceProfile {
  gender_split: { male: number; female: number }
  top_regions: Region[]
}

export interface MatchExplanation {
  reasoning_uz: string
  reasoning_ru: string
  reasoning_en: string
  audience_details: {
    overlap_percent: number
    matching_interests: string[]
    matching_regions: Region[]
  }
  why_recommended: string
}

export interface JwtPayload {
  userId: string
  telegramId: string
  role: string
  iat?: number
  exp?: number
}

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────

export function formatMoney(amount: number | string, lang: Lang = 'uz'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + (lang === 'uz' ? " so'm" : lang === 'ru' ? ' сум' : ' UZS')
}

export function calcPlatformFee(price: number): number {
  return Math.round(price * MIDAS.COMMISSION_RATE)
}

export function calcAdvertiserPayout(price: number): number {
  return price - calcPlatformFee(price)
}

export function calcContentDeadline(acceptedAt: Date): Date {
  const deadline = new Date(acceptedAt)
  deadline.setHours(deadline.getHours() + MIDAS.CONTENT_DEADLINE_HOURS)
  return deadline
}

export function isDeadlineExpired(deadline: Date): boolean {
  return new Date() > deadline
}

export function hoursUntilDeadline(deadline: Date): number {
  const diff = deadline.getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
}

export function getLocalizedText(text: LocalizedText, lang: Lang): string {
  return text[lang] || text.uz
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{3})\d+(\d{2})/, '$1*****$2')
}

export function maskCard(card: string): string {
  return '**** **** **** ' + card.slice(-4)
}

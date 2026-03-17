// MIDAS — Bot Sender (API tarafidagi bot instance)
// packages/api/src/bot-sender.ts
// Bu modul faqat sendMessage uchun Bot instance yaratadi

import { Bot } from 'grammy'

// Yengil bot instance — faqat API chaqiruvi uchun
export const bot = new Bot(process.env.BOT_TOKEN!, {
  botInfo: undefined as any, // Lazy init — getMe chaqirilmaydi
})

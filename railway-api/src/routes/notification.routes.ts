// MIDAS API — Notification Routes + Bot Sender
// packages/api/src/routes/notification.routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../plugins/prisma'
import { bot } from '../../bot-sender'
import { formatMoney } from './shared'

export async function notificationRoutes(app: FastifyInstance) {

  // ─── GET /notifications — Foydalanuvchi bildirishnomalari ─
  app.get(
    '/',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const reqUser = (req as any).user
      const { page = '1', limit = '20', unreadOnly } = req.query as Record<string, string>
      const skip = (parseInt(page) - 1) * parseInt(limit)

      const where: any = { userId: reqUser.userId }
      if (unreadOnly === 'true') where.isRead = false

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: reqUser.userId, isRead: false } }),
      ])

      return reply.send({ notifications, total, unreadCount, page: parseInt(page), limit: parseInt(limit) })
    }
  )

  // ─── PATCH /notifications/read-all ────────
  app.patch(
    '/read-all',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const reqUser = (req as any).user

      await prisma.notification.updateMany({
        where: { userId: reqUser.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })

      return reply.send({ success: true })
    }
  )

  // ─── PATCH /notifications/:id/read ────────
  app.patch(
    '/:id/read',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const reqUser = (req as any).user

      await prisma.notification.updateMany({
        where: { id, userId: reqUser.userId },
        data: { isRead: true, readAt: new Date() },
      })

      return reply.send({ success: true })
    }
  )

  // ─── POST /bot/send — Internal bot sender (jobs dan chaqiriladi) ─
  // Bu endpoint faqat internal — tashqaridan himoyalangan
  app.post(
    '/bot/send',
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Internal secret tekshiruvi
      const secret = req.headers['x-internal-secret']
      if (secret !== process.env.INTERNAL_SECRET) {
        return reply.status(403).send({ error: 'FORBIDDEN' })
      }

      const { telegramId, lang, type, payload } = req.body as {
        telegramId: string
        lang: 'uz' | 'ru' | 'en'
        type: string
        payload: Record<string, any>
      }

      try {
        const message = buildNotificationMessage(type, payload, lang)
        if (message) {
          await bot.api.sendMessage(telegramId, message.text, {
            parse_mode: 'HTML',
            reply_markup: message.keyboard,
          })
        }
        return reply.send({ success: true })
      } catch (err: any) {
        console.error('Bot send error:', err.message)
        return reply.send({ success: false, error: err.message })
      }
    }
  )
}

// ─── Xabar qurish ─────────────────────────

function buildNotificationMessage(
  type: string,
  payload: Record<string, any>,
  lang: 'uz' | 'ru' | 'en'
): { text: string; keyboard?: any } | null {

  const amount = payload.amount ? formatMoney(payload.amount, lang) : ''

  const messages: Record<string, Record<string, string>> = {
    NEW_OFFER: {
      uz: `📩 <b>Yangi taklif!</b>\n\n🏪 <b>${payload.business_name}</b>\n💰 Summa: <b>${amount}</b>${payload.note ? `\n📝 ${payload.note}` : ''}\n\nQabul qilasizmi?`,
      ru: `📩 <b>Новое предложение!</b>\n\n🏪 <b>${payload.business_name}</b>\n💰 Сумма: <b>${amount}</b>${payload.note ? `\n📝 ${payload.note}` : ''}\n\nПринимаете?`,
      en: `📩 <b>New offer!</b>\n\n🏪 <b>${payload.business_name}</b>\n💰 Amount: <b>${amount}</b>${payload.note ? `\n📝 ${payload.note}` : ''}\n\nDo you accept?`,
    },
    OFFER_ACCEPTED: {
      uz: `✅ <b>Taklif qabul qilindi!</b>\n\nReklamachi roziligi bildirdi.\nIltimos, to'lovni amalga oshiring.`,
      ru: `✅ <b>Предложение принято!</b>\n\nРекламщик согласился.\nПожалуйста, произведите оплату.`,
      en: `✅ <b>Offer accepted!</b>\n\nAdvertiser agreed.\nPlease proceed with payment.`,
    },
    OFFER_REJECTED: {
      uz: `❌ <b>Taklif rad etildi.</b>${payload.reason ? `\n\nSabab: ${payload.reason}` : ''}`,
      ru: `❌ <b>Предложение отклонено.</b>${payload.reason ? `\n\nПричина: ${payload.reason}` : ''}`,
      en: `❌ <b>Offer declined.</b>${payload.reason ? `\n\nReason: ${payload.reason}` : ''}`,
    },
    PAYMENT_HELD: {
      uz: `💰 <b>To'lov escrow'ga tushdi!</b>\n\n<b>${amount}</b> platforma'da xavfsiz saqlanmoqda.\nKontent tayyorlab, havolani yuboring.\n⏰ Muddat: ${payload.deadline ? new Date(payload.deadline).toLocaleDateString('uz') : '48 soat'}`,
      ru: `💰 <b>Оплата поступила на эскроу!</b>\n\n<b>${amount}</b> надёжно хранится на платформе.\nПодготовьте контент и отправьте ссылку.\n⏰ Срок: ${payload.deadline ? new Date(payload.deadline).toLocaleDateString('ru') : '48 часов'}`,
      en: `💰 <b>Payment held in escrow!</b>\n\n<b>${amount}</b> is safely held.\nPrepare content and send the link.\n⏰ Deadline: 48 hours`,
    },
    CONTENT_SUBMITTED: {
      uz: `📎 <b>Kontent yuborildi!</b>\n\n🔗 <a href="${payload.content_url}">Kontentni ko'rish</a>\n\nKo'rib chiqing va tasdiqlang.`,
      ru: `📎 <b>Контент отправлен!</b>\n\n🔗 <a href="${payload.content_url}">Посмотреть контент</a>\n\nПросмотрите и подтвердите.`,
      en: `📎 <b>Content submitted!</b>\n\n🔗 <a href="${payload.content_url}">View content</a>\n\nReview and confirm.`,
    },
    DEAL_COMPLETED: {
      uz: `🎉 <b>Bitim tugallandi!</b>\n\n💸 <b>${amount}</b> hisobingizga o'tkazildi.\nIshingiz uchun rahmat!`,
      ru: `🎉 <b>Сделка завершена!</b>\n\n💸 <b>${amount}</b> переведено на ваш счёт.\nСпасибо за работу!`,
      en: `🎉 <b>Deal completed!</b>\n\n💸 <b>${amount}</b> transferred to your account.\nThank you for your work!`,
    },
    DEAL_DISPUTED: {
      uz: `⚠️ <b>Nizo ochildi!</b>\n\nAdmin 72 soat ichida ko'rib chiqadi.\nNatija haqida xabar olasiz.`,
      ru: `⚠️ <b>Открыт спор!</b>\n\nАдмин рассмотрит в течение 72 часов.\nВы будете уведомлены о результате.`,
      en: `⚠️ <b>Dispute opened!</b>\n\nAdmin will review within 72 hours.\nYou will be notified of the result.`,
    },
    DISPUTE_RESOLVED: {
      uz: `✅ <b>Nizo hal qilindi!</b>\n\nQaror: ${payload.resolution}\n${payload.refundAmount ? `Qaytarildi: ${formatMoney(payload.refundAmount, 'uz')}` : ''}${payload.advertiserAmount ? `To'landi: ${formatMoney(payload.advertiserAmount, 'uz')}` : ''}`,
      ru: `✅ <b>Спор разрешён!</b>\n\nРешение: ${payload.resolution}`,
      en: `✅ <b>Dispute resolved!</b>\n\nDecision: ${payload.resolution}`,
    },
    VERIFICATION_APPROVED: {
      uz: `✅ <b>Profil tasdiqlandi!</b>\n\nSiz endi MIDAS platformasida reklama qabul qila olasiz.\nXaridorlar tavsiyangizga murojaat qiladi.`,
      ru: `✅ <b>Профиль подтверждён!</b>\n\nТеперь вы можете принимать рекламные заказы на платформе MIDAS.`,
      en: `✅ <b>Profile approved!</b>\n\nYou can now receive advertising orders on MIDAS.`,
    },
    VERIFICATION_REJECTED: {
      uz: `❌ <b>Profil tasdiqlanmadi.</b>\n\nSabab: ${payload.reason || 'Ko\'rsatilmagan'}\n\nProfilni to'g'rilab, qayta topshiring.`,
      ru: `❌ <b>Профиль не подтверждён.</b>\n\nПричина: ${payload.reason || 'Не указана'}`,
      en: `❌ <b>Profile rejected.</b>\n\nReason: ${payload.reason || 'Not specified'}`,
    },
    DEADLINE_REMINDER: {
      uz: `⚠️ <b>Diqqat! Muddat yaqinlashmoqda!</b>\n\nKontent topshirishga atigi <b>${payload.hours} soat</b> qoldi!\nVaqtida topshirmasangiz, to'lov qaytariladi.`,
      ru: `⚠️ <b>Внимание! Срок приближается!</b>\n\nДо сдачи контента осталось <b>${payload.hours} ч.</b>\nЕсли не сдать вовремя, оплата вернётся.`,
      en: `⚠️ <b>Deadline approaching!</b>\n\nOnly <b>${payload.hours} hours</b> left to submit content!\nPayment will be refunded if not submitted in time.`,
    },
  }

  const text = messages[type]?.[lang]
  if (!text) return null

  // Bitim uchun tugmalar
  let keyboard: any = undefined
  if (type === 'NEW_OFFER' && payload.dealId) {
    const { InlineKeyboard } = require('grammy')
    keyboard = new InlineKeyboard()
      .text(lang === 'uz' ? '✅ Qabul' : lang === 'ru' ? '✅ Принять' : '✅ Accept',
        `deal:accept:${payload.dealId}`)
      .text(lang === 'uz' ? '❌ Rad' : lang === 'ru' ? '❌ Отклонить' : '❌ Decline',
        `deal:reject:${payload.dealId}`)
  }

  if (type === 'CONTENT_SUBMITTED' && payload.dealId) {
    const { InlineKeyboard } = require('grammy')
    keyboard = new InlineKeyboard()
      .text(lang === 'uz' ? '✅ Tasdiqlash' : lang === 'ru' ? '✅ Подтвердить' : '✅ Approve',
        `deal:approve:${payload.dealId}`).row()
      .text(lang === 'uz' ? '⚠️ Nizo ochish' : lang === 'ru' ? '⚠️ Открыть спор' : '⚠️ Dispute',
        `deal:dispute:${payload.dealId}`)
  }

  return { text, keyboard }
}

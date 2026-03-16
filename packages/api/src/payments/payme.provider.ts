// MIDAS — Payme Integration
// packages/api/src/payments/payme.provider.ts
// Payme JSONRPC 2.0 API: https://developer.help.paycom.uz

import crypto from 'crypto'
import { prisma } from '../plugins/prisma'
import { holdEscrow } from '../services/deal.service'

const PAYME_MERCHANT_ID  = process.env.PAYME_MERCHANT_ID!
const PAYME_SECRET_KEY   = process.env.PAYME_SECRET_KEY!
const PAYME_TEST_MODE    = process.env.PAYME_TEST_MODE === 'true'

const PAYME_HOST = PAYME_TEST_MODE
  ? 'https://checkout.test.paycom.uz'
  : 'https://checkout.paycom.uz'

// ─── To'lov havolasi yaratish ─────────────
export function createPaymeCheckoutUrl(input: {
  dealId: string
  amount: number       // So'mda (tiyin uchun ×100)
  description: string
  returnUrl: string
  lang?: 'uz' | 'ru' | 'en'
}): string {
  const amountTiyin = input.amount * 100

  const params = {
    m: PAYME_MERCHANT_ID,
    ac: { deal_id: input.dealId },     // order ID
    a: amountTiyin,
    d: input.description,
    l: input.lang || 'uz',
    c: input.returnUrl,
  }

  const encoded = Buffer.from(JSON.stringify(params)).toString('base64')
  return `${PAYME_HOST}/${encoded}`
}

// ─── Payme Merchant API – Webhook handler ─
export interface PaymeRequest {
  id: number | string
  jsonrpc: string
  method: string
  params: Record<string, any>
}

export interface PaymeResponse {
  id: number | string
  jsonrpc: string
  result?: Record<string, any>
  error?: { code: number; message: { uz: string; ru: string; en: string } }
}

// Payme xatolik kodlari
const PAYME_ERRORS = {
  METHOD_NOT_FOUND:   { code: -32601, uz: 'Metod topilmadi',        ru: 'Метод не найден',        en: 'Method not found' },
  INSUFFICIENT_FUNDS: { code: -31003, uz: 'Mablag\' yetarli emas',  ru: 'Недостаточно средств',   en: 'Insufficient funds' },
  ORDER_NOT_FOUND:    { code: -31050, uz: 'Buyurtma topilmadi',      ru: 'Заказ не найден',        en: 'Order not found' },
  ORDER_INVALID_AMOUNT: { code: -31001, uz: 'Noto\'g\'ri summa',     ru: 'Неверная сумма',         en: 'Invalid amount' },
  TRANSACTION_EXISTS: { code: -31099, uz: 'Tranzaksiya mavjud',      ru: 'Транзакция существует',  en: 'Transaction exists' },
  CANNOT_CANCEL:      { code: -31007, uz: 'Bekor qilib bo\'lmaydi',  ru: 'Нельзя отменить',        en: 'Cannot cancel' },
}

export async function handlePaymeWebhook(
  req: PaymeRequest,
  authorization: string
): Promise<PaymeResponse> {
  // Autentifikatsiya tekshiruvi
  if (!verifyPaymeAuth(authorization)) {
    return errorResponse(req.id, PAYME_ERRORS.METHOD_NOT_FOUND)
  }

  switch (req.method) {
    case 'CheckPerformTransaction': return checkPerformTransaction(req)
    case 'CreateTransaction':       return createTransaction(req)
    case 'PerformTransaction':      return performTransaction(req)
    case 'CancelTransaction':       return cancelTransaction(req)
    case 'CheckTransaction':        return checkTransaction(req)
    case 'GetStatement':            return getStatement(req)
    default:
      return errorResponse(req.id, PAYME_ERRORS.METHOD_NOT_FOUND)
  }
}

function verifyPaymeAuth(authorization: string): boolean {
  const expected = 'Basic ' + Buffer.from(`Paycom:${PAYME_SECRET_KEY}`).toString('base64')
  return authorization === expected
}

// 1. Buyurtmani tekshirish
async function checkPerformTransaction(req: PaymeRequest): Promise<PaymeResponse> {
  const { account, amount } = req.params
  const dealId = account?.deal_id

  if (!dealId) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  const deal = await prisma.deal.findUnique({ where: { id: dealId } })
  if (!deal) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  // Summa tekshirish (tiyin → so'm)
  const expectedTiyin = Number(deal.price) * 100
  if (amount !== expectedTiyin) {
    return errorResponse(req.id, PAYME_ERRORS.ORDER_INVALID_AMOUNT)
  }

  if (deal.status !== 'ACCEPTED') {
    return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)
  }

  return { id: req.id, jsonrpc: '2.0', result: { allow: true } }
}

// 2. Tranzaksiya yaratish
async function createTransaction(req: PaymeRequest): Promise<PaymeResponse> {
  const { id: paymeId, time, amount, account } = req.params
  const dealId = account?.deal_id

  const deal = await prisma.deal.findUnique({ where: { id: dealId } })
  if (!deal) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  // Mavjud payment tekshirish
  const existing = await prisma.payment.findUnique({ where: { dealId } })
  if (existing) {
    if (existing.txId !== paymeId.toString()) {
      return errorResponse(req.id, PAYME_ERRORS.TRANSACTION_EXISTS)
    }
    return {
      id: req.id, jsonrpc: '2.0',
      result: {
        create_time: existing.createdAt.getTime(),
        transaction: existing.id,
        state: 1,
      },
    }
  }

  // Yangi payment yaratish (PENDING)
  const payment = await prisma.payment.create({
    data: {
      dealId,
      provider: 'PAYME',
      status: 'PENDING',
      amount: deal.price,
      fee: deal.platformFee,
      txId: paymeId.toString(),
      providerData: req.params,
    },
  })

  return {
    id: req.id, jsonrpc: '2.0',
    result: {
      create_time: payment.createdAt.getTime(),
      transaction: payment.id,
      state: 1,
    },
  }
}

// 3. To'lovni bajarish (escrow ushlab qolish)
async function performTransaction(req: PaymeRequest): Promise<PaymeResponse> {
  const { id: paymeId } = req.params

  const payment = await prisma.payment.findFirst({
    where: { txId: paymeId.toString() },
  })
  if (!payment) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  // Escrow ushlab olish
  await holdEscrow(payment.dealId, paymeId.toString(), 'PAYME')

  return {
    id: req.id, jsonrpc: '2.0',
    result: {
      perform_time: Date.now(),
      transaction: payment.id,
      state: 2,
    },
  }
}

// 4. Bekor qilish
async function cancelTransaction(req: PaymeRequest): Promise<PaymeResponse> {
  const { id: paymeId, reason } = req.params

  const payment = await prisma.payment.findFirst({
    where: { txId: paymeId.toString() },
  })
  if (!payment) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  if (payment.status === 'RELEASED') {
    return errorResponse(req.id, PAYME_ERRORS.CANNOT_CANCEL)
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    }),
    prisma.deal.update({
      where: { id: payment.dealId },
      data: { status: 'CANCELLED', escrowStatus: 'REFUNDED' },
    }),
  ])

  return {
    id: req.id, jsonrpc: '2.0',
    result: {
      cancel_time: Date.now(),
      transaction: payment.id,
      state: -1,
    },
  }
}

// 5. Tranzaksiya holati tekshirish
async function checkTransaction(req: PaymeRequest): Promise<PaymeResponse> {
  const { id: paymeId } = req.params

  const payment = await prisma.payment.findFirst({
    where: { txId: paymeId.toString() },
  })
  if (!payment) return errorResponse(req.id, PAYME_ERRORS.ORDER_NOT_FOUND)

  const stateMap: Record<string, number> = {
    PENDING: 1, HELD: 2, RELEASED: 2, REFUNDED: -1, FAILED: -2,
  }

  return {
    id: req.id, jsonrpc: '2.0',
    result: {
      create_time:  payment.createdAt.getTime(),
      perform_time: payment.heldAt?.getTime() || 0,
      cancel_time:  payment.refundedAt?.getTime() || 0,
      transaction:  payment.id,
      state: stateMap[payment.status] || 1,
      reason: null,
    },
  }
}

// 6. Statement olish
async function getStatement(req: PaymeRequest): Promise<PaymeResponse> {
  const { from, to } = req.params

  const payments = await prisma.payment.findMany({
    where: {
      provider: 'PAYME',
      createdAt: { gte: new Date(from), lte: new Date(to) },
    },
  })

  return {
    id: req.id, jsonrpc: '2.0',
    result: {
      transactions: payments.map(p => ({
        id: p.txId,
        time: p.createdAt.getTime(),
        amount: Number(p.amount) * 100,
        account: { deal_id: p.dealId },
        create_time: p.createdAt.getTime(),
        perform_time: p.heldAt?.getTime() || 0,
        cancel_time: p.refundedAt?.getTime() || 0,
        transaction: p.id,
        state: p.status === 'HELD' || p.status === 'RELEASED' ? 2 : 1,
        reason: null,
      })),
    },
  }
}

function errorResponse(id: any, error: any): PaymeResponse {
  return {
    id, jsonrpc: '2.0',
    error: { code: error.code, message: { uz: error.uz, ru: error.ru, en: error.en } },
  }
}

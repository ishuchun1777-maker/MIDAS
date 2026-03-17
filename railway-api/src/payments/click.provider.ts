// MIDAS — Click Integration
// packages/api/src/payments/click.provider.ts
// Click SOAP/REST API: https://docs.click.uz

import crypto from 'crypto'
import { prisma } from '../plugins/prisma'
import { holdEscrow } from '../services/deal.service'

const CLICK_MERCHANT_ID  = process.env.CLICK_MERCHANT_ID!
const CLICK_SERVICE_ID   = process.env.CLICK_SERVICE_ID!
const CLICK_SECRET_KEY   = process.env.CLICK_SECRET_KEY!
const CLICK_TEST_MODE    = process.env.CLICK_TEST_MODE === 'true'

const CLICK_HOST = CLICK_TEST_MODE
  ? 'https://test.checkout.click.uz'
  : 'https://checkout.click.uz'

// ─── To'lov havolasi yaratish ─────────────
export function createClickCheckoutUrl(input: {
  dealId: string
  amount: number
  description: string
  returnUrl: string
}): string {
  const params = new URLSearchParams({
    service_id:    CLICK_SERVICE_ID,
    merchant_id:   CLICK_MERCHANT_ID,
    amount:        input.amount.toString(),
    transaction_param: input.dealId,
    return_url:    input.returnUrl,
    description:   input.description.slice(0, 255),
  })

  return `${CLICK_HOST}/services/pay?${params.toString()}`
}

// ─── Click Webhook handler ─────────────────
export interface ClickWebhookBody {
  click_trans_id:    string
  service_id:        string
  click_paydoc_id:   string
  merchant_trans_id: string    // dealId
  amount:            number
  action:            number    // 0=prepare, 1=complete
  error:             number
  error_note:        string
  sign_time:         string
  sign_string:       string
  merchant_prepare_id?: string
}

export interface ClickResponse {
  click_trans_id:    string
  merchant_trans_id: string
  merchant_prepare_id?: string
  merchant_confirm_id?: string
  error:             number
  error_note:        string
}

const CLICK_ERROR = {
  OK:               { code: 0,   note: 'Success' },
  SIGN_FAILED:      { code: -1,  note: 'SIGN CHECK FAILED!' },
  ORDER_NOT_FOUND:  { code: -5,  note: 'Order not found' },
  ALREADY_PAID:     { code: -4,  note: 'Already paid' },
  WRONG_AMOUNT:     { code: -2,  note: 'Incorrect parameter amount' },
  ACTION_NOTFOUND:  { code: -3,  note: 'Action not found' },
  TRANSACTION_CANCEL: { code: -9, note: 'Transaction cancelled' },
}

export async function handleClickWebhook(body: ClickWebhookBody): Promise<ClickResponse> {
  const base: ClickResponse = {
    click_trans_id: body.click_trans_id,
    merchant_trans_id: body.merchant_trans_id,
    error: CLICK_ERROR.OK.code,
    error_note: CLICK_ERROR.OK.note,
  }

  // Imzo tekshiruvi
  if (!verifyClickSign(body)) {
    return { ...base, error: CLICK_ERROR.SIGN_FAILED.code, error_note: CLICK_ERROR.SIGN_FAILED.note }
  }

  const dealId = body.merchant_trans_id
  const deal = await prisma.deal.findUnique({ where: { id: dealId } })

  if (!deal) {
    return { ...base, error: CLICK_ERROR.ORDER_NOT_FOUND.code, error_note: CLICK_ERROR.ORDER_NOT_FOUND.note }
  }

  // Summa tekshirish
  if (Math.abs(Number(deal.price) - body.amount) > 1) {
    return { ...base, error: CLICK_ERROR.WRONG_AMOUNT.code, error_note: CLICK_ERROR.WRONG_AMOUNT.note }
  }

  if (body.action === 0) {
    // PREPARE — buyurtma mavjudligini tekshirish
    if (deal.status !== 'ACCEPTED') {
      return { ...base, error: CLICK_ERROR.ALREADY_PAID.code, error_note: CLICK_ERROR.ALREADY_PAID.note }
    }

    // Prepare ID saqlaymiz
    const payment = await prisma.payment.upsert({
      where: { dealId },
      create: {
        dealId,
        provider: 'CLICK',
        status: 'PENDING',
        amount: deal.price,
        fee: deal.platformFee,
        txId: body.click_trans_id,
        providerData: body as any,
      },
      update: { txId: body.click_trans_id, providerData: body as any },
    })

    return {
      ...base,
      merchant_prepare_id: payment.id,
    }

  } else if (body.action === 1) {
    // COMPLETE — to'lovni tasdiqlash
    if (body.error < 0) {
      // Click tomonidan xatolik — bekor qilamiz
      await prisma.payment.update({
        where: { dealId },
        data: { status: 'FAILED' },
      })
      return { ...base, error: CLICK_ERROR.TRANSACTION_CANCEL.code, error_note: body.error_note }
    }

    // Escrow ushlab qolish
    await holdEscrow(dealId, body.click_trans_id, 'CLICK')

    const payment = await prisma.payment.findUnique({ where: { dealId } })

    return {
      ...base,
      merchant_prepare_id: payment?.id,
      merchant_confirm_id: payment?.id,
    }

  } else {
    return { ...base, error: CLICK_ERROR.ACTION_NOTFOUND.code, error_note: CLICK_ERROR.ACTION_NOTFOUND.note }
  }
}

function verifyClickSign(body: ClickWebhookBody): boolean {
  const signString = [
    body.click_trans_id,
    body.service_id,
    CLICK_SECRET_KEY,
    body.merchant_trans_id,
    body.merchant_prepare_id || '',
    body.amount,
    body.action,
    body.sign_time,
  ].join('')

  const expected = crypto.createHash('md5').update(signString).digest('hex')
  return expected === body.sign_string
}

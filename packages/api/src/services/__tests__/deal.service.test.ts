// MIDAS — Deal Service Tests
// packages/api/src/services/__tests__/deal.service.test.ts

import { calcPlatformFee, calcAdvertiserPayout, calcContentDeadline, MIDAS } from '@midas/shared'

// ─── Moliya hisob-kitob testlari ──────────

describe('Deal financial calculations', () => {

  test('7% komissiya to\'g\'ri hisoblanadi', () => {
    expect(calcPlatformFee(1_000_000)).toBe(70_000)
    expect(calcPlatformFee(500_000)).toBe(35_000)
    expect(calcPlatformFee(2_000_000)).toBe(140_000)
    expect(calcPlatformFee(100_000)).toBe(7_000)
  })

  test('reklamachi to\'lovi to\'g\'ri hisoblanadi', () => {
    expect(calcAdvertiserPayout(1_000_000)).toBe(930_000)
    expect(calcAdvertiserPayout(500_000)).toBe(465_000)
  })

  test('komissiya + payout = narx', () => {
    const price = 1_500_000
    const fee = calcPlatformFee(price)
    const payout = calcAdvertiserPayout(price)
    expect(fee + payout).toBe(price)
  })

  test('kontent muddati 48 soatdan keyin', () => {
    const now = new Date('2026-01-01T10:00:00Z')
    const deadline = calcContentDeadline(now)
    const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    expect(diffHours).toBe(MIDAS.CONTENT_DEADLINE_HOURS)
  })
})

// ─── DealError testlari ───────────────────

describe('DealError', () => {
  const { DealError } = require('../deal.service')

  test('DealError to\'g\'ri tuziladi', () => {
    const err = new DealError('NOT_FOUND', 'Bitim topilmadi')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Bitim topilmadi')
    expect(err.name).toBe('DealError')
  })
})

// ─── MIDAS konstantalari testlari ─────────

describe('MIDAS constants', () => {
  test('komissiya 7%', () => {
    expect(MIDAS.COMMISSION_RATE).toBe(0.07)
  })

  test('bepul bitimlar soni 5', () => {
    expect(MIDAS.FREE_DEALS_PER_MONTH).toBe(5)
  })

  test('fraud chegarasi 60', () => {
    expect(MIDAS.FRAUD_SUSPEND_THRESHOLD).toBe(60)
  })

  test('kontent muddati 48 soat', () => {
    expect(MIDAS.CONTENT_DEADLINE_HOURS).toBe(48)
  })
})

// ─── Payment URL testlari ─────────────────

describe('Payment URL generation', () => {
  beforeAll(() => {
    process.env.PAYME_MERCHANT_ID = 'test_merchant'
    process.env.PAYME_SECRET_KEY  = 'test_secret'
    process.env.PAYME_TEST_MODE   = 'true'
    process.env.CLICK_MERCHANT_ID = 'test_click_merchant'
    process.env.CLICK_SERVICE_ID  = 'test_service'
    process.env.CLICK_SECRET_KEY  = 'test_click_secret'
    process.env.CLICK_TEST_MODE   = 'true'
  })

  test('Payme URL to\'g\'ri yaratiladi', () => {
    const { createPaymeCheckoutUrl } = require('../payments/payme.provider')
    const url = createPaymeCheckoutUrl({
      dealId: 'test-deal-id',
      amount: 1_000_000,
      description: 'Test to\'lov',
      returnUrl: 'https://example.com/return',
    })
    expect(url).toContain('checkout.test.paycom.uz')
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(50)
  })

  test('Click URL to\'g\'ri yaratiladi', () => {
    const { createClickCheckoutUrl } = require('../payments/click.provider')
    const url = createClickCheckoutUrl({
      dealId: 'test-deal-id',
      amount: 1_000_000,
      description: 'Test to\'lov',
      returnUrl: 'https://example.com/return',
    })
    expect(url).toContain('test.checkout.click.uz')
    expect(url).toContain('service_id=test_service')
    expect(url).toContain('amount=1000000')
  })

  test('Click URL deal ID ni o\'z ichiga oladi', () => {
    const { createClickCheckoutUrl } = require('../payments/click.provider')
    const url = createClickCheckoutUrl({
      dealId: 'abc-123',
      amount: 500_000,
      description: 'Test',
      returnUrl: 'https://example.com',
    })
    expect(url).toContain('transaction_param=abc-123')
  })
})

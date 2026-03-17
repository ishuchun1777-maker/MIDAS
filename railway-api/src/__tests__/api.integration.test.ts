// MIDAS — API Integration Tests
// packages/api/src/__tests__/api.integration.test.ts

import Fastify, { FastifyInstance } from 'fastify'
import { createTokenPair } from '../services/auth.service'
import { prisma } from '../plugins/prisma'

let app: FastifyInstance
let adminToken: string
let businessToken: string

beforeAll(async () => {
  // Test uchun Fastify instance
  app = Fastify({ logger: false })

  // Plugins va routes qo'shish
  await app.register(require('../plugins/prisma').prismaPlugin)
  await app.register(require('@fastify/jwt'), { secret: process.env.JWT_SECRET || 'test_secret_min_32_chars_long_here' })
  app.decorate('authenticate', async (req: any, reply: any) => {
    try { await req.jwtVerify() }
    catch { reply.status(401).send({ error: 'UNAUTHORIZED' }) }
  })
  app.decorate('requireAdmin', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
      if (req.user.role !== 'ADMIN') reply.status(403).send({ error: 'FORBIDDEN' })
    } catch { reply.status(401).send({ error: 'UNAUTHORIZED' }) }
  })

  await app.register(require('../routes/auth.routes').authRoutes,   { prefix: '/api/v1/auth' })
  await app.register(require('../routes/user.routes').userRoutes,   { prefix: '/api/v1/users' })
  await app.register(require('../routes/admin.routes').adminRoutes, { prefix: '/api/v1/admin' })
  await app.ready()

  // Test foydalanuvchilar yaratish
  const adminUser = await prisma.user.upsert({
    where: { telegramId: BigInt(88000001) },
    update: {},
    create: { telegramId: BigInt(88000001), role: 'ADMIN', fullName: 'Test Admin', lang: 'uz' },
  })
  const bizUser = await prisma.user.upsert({
    where: { telegramId: BigInt(88000002) },
    update: {},
    create: { telegramId: BigInt(88000002), role: 'BUSINESS', fullName: 'Test Business', lang: 'uz' },
  })

  const adminTokens = await createTokenPair(adminUser.id)
  const bizTokens   = await createTokenPair(bizUser.id)
  adminToken    = adminTokens.accessToken
  businessToken = bizTokens.accessToken
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { telegramId: { in: [BigInt(88000001), BigInt(88000002)] } } })
  await app.close()
})

// ─── Auth ─────────────────────────────────
describe('Auth Routes', () => {
  test('GET /auth/me — autentifikatsiyasiz 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  test('GET /auth/me — token bilan 200', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${businessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.role).toBe('BUSINESS')
  })

  test('POST /auth/miniapp — noto\'g\'ri initData 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/miniapp',
      payload: { initData: 'invalid_data', lang: 'uz' },
    })
    expect(res.statusCode).toBe(401)
  })

  test('POST /auth/refresh — noto\'g\'ri token 401', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'invalid_refresh_token_here' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── Admin ────────────────────────────────
describe('Admin Routes', () => {
  test('GET /admin/dashboard — admin token bilan 200', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('users')
    expect(body).toHaveProperty('deals')
    expect(body).toHaveProperty('revenue')
  })

  test('GET /admin/dashboard — business token bilan 403', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${businessToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  test('GET /admin/settings — admin 200', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('commission_rate')
  })

  test('PATCH /admin/settings/commission_rate — yangilash', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/admin/settings/commission_rate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: '0.07' },
    })
    expect(res.statusCode).toBe(200)
  })

  test('PATCH /admin/settings — noto\'g\'ri kalit 400', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/admin/settings/invalid_key',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'test' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── Users ────────────────────────────────
describe('User Routes', () => {
  test('GET /users/telegram/:id — mavjud foydalanuvchi', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/users/telegram/88000002',
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.role).toBe('BUSINESS')
  })

  test('GET /users/telegram/:id — mavjud emas 404', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/users/telegram/99999999',
    })
    expect(res.statusCode).toBe(404)
  })

  test('GET /health — 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('ok')
  })
})

// ─── Input validation ─────────────────────
describe('Input Validation', () => {
  test('POST /auth/miniapp — bo\'sh payload 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/miniapp',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})

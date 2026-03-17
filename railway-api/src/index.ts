// MIDAS API Server — Entry Point
// packages/api/src/index.ts

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { authRoutes } from './routes/auth.routes'
import { userRoutes } from './routes/user.routes'
import { advertiserRoutes } from './routes/advertiser.routes'
import { businessRoutes } from './routes/business.routes'
import { dealRoutes } from './routes/deal.routes'
import { matchRoutes } from './routes/match.routes'
import { notificationRoutes } from './routes/notification.routes'
import { adminRoutes } from './routes/admin.routes'
import { prismaPlugin } from './plugins/prisma'
import { redisPlugin } from './plugins/redis'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

async function bootstrap() {
  // ─── Plugins ─────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: false, // Telegram WebApp bilan muammo qiladi
  })

  await app.register(cors, {
    origin: [
      process.env.MINIAPP_URL!,
      process.env.ADMIN_URL!,
      'https://web.telegram.org',
    ],
    credentials: true,
  })

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: undefined, // Redis plugin dan keyin qo'shiladi
    keyGenerator: (req: any) => req.user?.userId || req.ip,
    errorResponseBuilder: () => ({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Juda ko\'p so\'rov. Biroz kutib turing.',
    }),
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  })

  // ─── Custom plugins ───────────────────────

  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  // ─── Auth decorator ───────────────────────

  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
  })

  app.decorate('requireAdmin', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
      if (req.user.role !== 'ADMIN') {
        reply.status(403).send({ error: 'FORBIDDEN' })
      }
    } catch {
      reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
  })

  // ─── Routes ───────────────────────────────

  app.register(authRoutes,         { prefix: '/api/v1/auth' })
  app.register(userRoutes,         { prefix: '/api/v1/users' })
  app.register(advertiserRoutes,   { prefix: '/api/v1/advertisers' })
  app.register(businessRoutes,     { prefix: '/api/v1/businesses' })
  
  app.register(dealRoutes,         { prefix: '/api/v1/deals' })
  app.register(matchRoutes,        { prefix: '/api/v1/matches' })
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' })
  app.register(adminRoutes,        { prefix: '/api/v1/admin' })

  // ─── Health check ─────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  }))

  // ─── Global error handler ─────────────────

  app.setErrorHandler((error, req, reply) => {
    app.log.error({ err: error, url: req.url, method: req.method })

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: error.validation,
      })
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message,
      })
    }

    return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR' })
  })

  // ─── Start ────────────────────────────────

  const port = parseInt(process.env.PORT || '3001')
  const host = process.env.HOST || '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`MIDAS API server running on http://${host}:${port}`)
}

bootstrap().catch((err) => {
  console.error('Server start error:', err)
  process.exit(1)
})

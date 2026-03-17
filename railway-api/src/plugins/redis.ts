// MIDAS Redis Plugin
// packages/api/src/plugins/redis.ts

import fp from 'fastify-plugin'
import { createClient } from 'redis'

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
})

redis.on('error', (err) => console.error('Redis error:', err))
redis.on('connect', () => console.log('Redis connected'))

export { redis }

export const redisPlugin = fp(async (app) => {
  await redis.connect()
  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
  })
})

// ─── Redis helpers ────────────────────────

const DEFAULT_TTL = 60 * 60 // 1 soat

export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key)
  if (!val) return null
  try { return JSON.parse(val) } catch { return null }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL) {
  await redis.setEx(key, ttl, JSON.stringify(value))
}

export async function cacheDel(key: string) {
  await redis.del(key)
}

export async function cacheDelPattern(pattern: string) {
  const keys = await redis.keys(pattern)
  if (keys.length) await redis.del(keys)
}

// AI matching natijalarini cache qilish (30 daqiqa)
export const AI_MATCH_CACHE_TTL = 60 * 30

// Fraud score cache (24 soat)
export const FRAUD_CACHE_TTL = 60 * 60 * 24

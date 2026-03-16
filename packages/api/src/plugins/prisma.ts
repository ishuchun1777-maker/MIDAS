// MIDAS Prisma Plugin
// packages/api/src/plugins/prisma.ts

import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

export { prisma }

export const prismaPlugin = fp(async (app) => {
  await prisma.$connect()
  app.decorate('prisma', prisma)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})

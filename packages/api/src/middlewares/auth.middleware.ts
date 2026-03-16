// MIDAS Auth Middleware
// packages/api/src/middlewares/auth.middleware.ts

import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '../services/auth.service'
import { prisma } from '../plugins/prisma'

/**
 * Role-based access control middleware factory
 * Ishlatish: { preHandler: [requireRole('ADMIN')] }
 */
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await (req as any).jwtVerify()
      const user = (req as any).user

      if (!roles.includes(user.role)) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: `Ushbu amalni bajarish uchun ruxsat yo'q`,
        })
      }

      // Foydalanuvchi ban bo'lganligini tekshiramiz
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isBanned: true, isActive: true, banReason: true },
      })

      if (!dbUser || dbUser.isBanned) {
        return reply.status(403).send({
          error: 'USER_BANNED',
          reason: dbUser?.banReason,
        })
      }

      if (!dbUser.isActive) {
        return reply.status(403).send({ error: 'USER_INACTIVE' })
      }
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED' })
    }
  }
}

/**
 * Foydalanuvchi o'z resursiga kirishi tekshiriladi
 * Masalan: /users/:userId — faqat o'zi yoki admin
 */
export function requireOwnerOrAdmin(userIdParam = 'userId') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const reqUser = (req as any).user
    const targetId = (req.params as any)[userIdParam]

    if (reqUser.role === 'ADMIN') return // Admin hamma narsaga kirishi mumkin

    if (reqUser.userId !== targetId) {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
  }
}

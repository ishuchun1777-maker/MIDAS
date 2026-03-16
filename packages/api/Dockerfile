# MIDAS API — Production Dockerfile
# packages/api/Dockerfile

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencies ─────────────────────────
FROM base AS deps
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
RUN npm ci --workspace=packages/api --workspace=packages/shared --workspace=packages/database

# ─── Build ────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY turbo.json .
RUN cd packages/database && npx prisma generate
RUN npm run build --workspace=packages/api --workspace=packages/shared

# ─── Production ───────────────────────────
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 midas

COPY --from=builder --chown=midas:nodejs /app/packages/api/dist ./dist
COPY --from=builder --chown=midas:nodejs /app/packages/shared/dist ./shared
COPY --from=builder --chown=midas:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma

USER midas
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

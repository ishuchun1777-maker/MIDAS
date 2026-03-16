# MIDAS Bot — Production Dockerfile
# apps/bot/Dockerfile

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
COPY apps/bot/package*.json ./apps/bot/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/bot --workspace=packages/shared

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/bot ./apps/bot
COPY packages/shared ./packages/shared
COPY turbo.json .
RUN npm run build --workspace=apps/bot --workspace=packages/shared

FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 midas

COPY --from=builder --chown=midas:nodejs /app/apps/bot/dist ./dist
COPY --from=builder --chown=midas:nodejs /app/apps/bot/src/locales ./dist/locales
COPY --from=builder --chown=midas:nodejs /app/node_modules ./node_modules

USER midas
EXPOSE 3002

CMD ["node", "dist/index.js"]

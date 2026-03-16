FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/

RUN npm ci --workspace=packages/api --workspace=packages/shared --workspace=packages/database

COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/api ./packages/api

RUN cd packages/database && npx prisma generate

RUN cd packages/shared && npx tsc --project tsconfig.json || true
RUN cd packages/api && npx tsc --project tsconfig.json

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]

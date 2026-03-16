# MIDAS — Reklama Marketplace

> O'zbekistondagi reklama industriyasi uchun to'liq tizimli, AI-powered marketplace

## Tezkor boshlash

### Talablar
- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Reponi klonlash

```bash
git clone https://github.com/sizning-username/midas.git
cd midas
```

### 2. Environment sozlash

```bash
cp .env.example .env
# .env faylini to'ldiring (BOT_TOKEN, JWT_SECRET, va boshqalar)
```

### 3. Dependencies o'rnatish

```bash
npm install
```

### 4. Docker orqali DB va Redis ishga tushirish

```bash
docker-compose up -d postgres redis
```

### 5. Database migratsiya

```bash
npm run db:generate   # Prisma client generatsiya
npm run db:migrate    # Migratsiyalar ishga tushirish
```

### 6. Loyihani ishga tushirish

```bash
npm run dev           # Barcha serviceslarni parallel ishga tushirish
```

Yoki alohida:
```bash
# Faqat API
cd packages/api && npm run dev

# Faqat Bot
cd apps/bot && npm run dev

# Faqat Mini App
cd apps/miniapp && npm run dev
```

---

## Arxitektura

```
midas/
├── apps/
│   ├── bot/          # Grammy.js Telegram Bot
│   ├── miniapp/      # React + Vite (Telegram Mini App)
│   └── admin/        # React Admin Panel
│
├── packages/
│   ├── api/          # Fastify Backend API
│   ├── database/     # Prisma Schema + Migratsiyalar
│   ├── shared/       # Umumiy types, constants, utils
│   └── i18n/         # Tarjima fayllar (uz/ru/en)
```

## Tech Stack

| Qism | Texnologiya |
|------|-------------|
| Bot | Grammy.js (Node.js) |
| API | Fastify + Prisma |
| Mini App | React 18 + Vite + Tailwind |
| DB | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT + Telegram HMAC |
| AI | OpenAI API + Custom matching |
| To'lov | Payme + Click |
| DevOps | Docker + GitHub Actions |

## Portlar

| Servis | Port |
|--------|------|
| API | 3001 |
| Mini App | 5173 |
| Admin | 5174 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| pgAdmin | 5050 |

## Asosiy komandalar

```bash
npm run dev           # Development mode
npm run build         # Production build
npm run test          # Testlar
npm run lint          # Linting
npm run db:studio     # Prisma Studio (DB UI)
npm run db:migrate    # DB migratsiya
npm run db:generate   # Prisma client regenerate
```

## Muhit o'zgaruvchilari

Barcha kerakli o'zgaruvchilar `.env.example` faylida ko'rsatilgan.
Minimal to'plam:
- `DATABASE_URL` — PostgreSQL ulanish URL
- `REDIS_URL` — Redis ulanish URL
- `JWT_SECRET` — Kamida 64 belgili random string
- `BOT_TOKEN` — @BotFather dan olingan token
- `OPENAI_API_KEY` — OpenAI API kaliti

## Sprint rejasi

- **Sprint 1** (hozir): Repo + DB + Auth ✅
- **Sprint 2**: Bot onboarding (tadbirkor + reklamachi + agentlik)
- **Sprint 3**: AI matching tizimi
- **Sprint 4**: Bitim + Payme/Click to'lov
- **Sprint 5**: Admin panel + nizo tizimi
- **Sprint 6**: Test + deploy + beta

---

*MIDAS — Har bir reklama o'z oltin qadrini topadi*

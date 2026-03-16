# MIDAS — Beta Launch Tekshiruv Ro'yxati
# scripts/BETA_CHECKLIST.md

## 1. INFRATUZILMA ✅

### Server
- [ ] Server o'rnatildi (UzCloud/Humans.uz — asosiy)
- [ ] Backup server sozlandi (Hetzner — ikkilamchi)
- [ ] SSL sertifikatlar olingan (`certbot --nginx -d ...`)
- [ ] Firewall sozlangan (`ufw status` — 80, 443, SSH)
- [ ] Swap fayl yaratilgan (2GB minimum)
- [ ] Crontab backup sozlangan

### Domenlar
- [ ] `api.midas.uz` → Server IP
- [ ] `app.midas.uz` → Server IP (Mini App)
- [ ] `admin.midas.uz` → Server IP
- [ ] DNS propagation tekshirildi (24-48 soat)

---

## 2. ENVIRONMENT VARIABLES ✅

### Majburiy
- [ ] `JWT_SECRET` — kamida 64 belgili random string
- [ ] `BOT_TOKEN` — @BotFather dan olingan
- [ ] `DATABASE_URL` — PostgreSQL ulanish
- [ ] `REDIS_URL` — Redis ulanish
- [ ] `OPENAI_API_KEY` — AI matching uchun
- [ ] `WEBHOOK_DOMAIN` — `https://api.midas.uz`
- [ ] `MINIAPP_URL` — `https://app.midas.uz`
- [ ] `INTERNAL_SECRET` — bot-API aloqasi uchun

### To'lov
- [ ] `PAYME_MERCHANT_ID` + `PAYME_SECRET_KEY`
- [ ] `CLICK_MERCHANT_ID` + `CLICK_SERVICE_ID` + `CLICK_SECRET_KEY`
- [ ] `PAYME_TEST_MODE=false` (production da)
- [ ] `CLICK_TEST_MODE=false` (production da)

---

## 3. TELEGRAM ✅

### Bot sozlamalari
- [ ] `/setname` — bot nomi o'rnatildi
- [ ] `/setdescription` — tavsif yozildi
- [ ] `/setuserpic` — profil rasmi qo'yildi
- [ ] `/setcommands` — komandalar ro'yxati:
  ```
  start - Bosh menyu
  menu - Menyu
  deals - Bitimlar
  wallet - Hamyon
  help - Yordam
  settings - Sozlamalar
  ```
- [ ] `/setprivacy` — DISABLED (guruhlarda ishlash uchun)
- [ ] Webhook o'rnatildi: `https://api.midas.uz/bot{TOKEN}`

### Mini App
- [ ] `@BotFather → /newapp` — Mini App yaratildi
- [ ] Mini App URL: `https://app.midas.uz`
- [ ] Mini App rasm va nom qo'yildi

---

## 4. TO'LOV TIZIMLARI ✅

### Payme
- [ ] Merchant akkaunt yaratildi (merchant.payme.uz)
- [ ] Callback URL sozlandi: `https://api.midas.uz/api/v1/payments/payme`
- [ ] Test to'lov o'tkazildi (staging da)
- [ ] Production kalitlar environment ga kiritildi

### Click
- [ ] Merchant akkaunt yaratildi (my.click.uz)
- [ ] Prepare URL: `https://api.midas.uz/api/v1/payments/click/prepare`
- [ ] Complete URL: `https://api.midas.uz/api/v1/payments/click/complete`
- [ ] Test to'lov o'tkazildi

---

## 5. DATABASE ✅

- [ ] Migratsiyalar bajarildi: `prisma migrate deploy`
- [ ] Default industry profiles yuklandi (migration 001_init.sql)
- [ ] Default platform settings yuklandi
- [ ] Admin foydalanuvchi yaratildi
- [ ] DB backup ishlayapti

---

## 6. FUNKTSIONAL TESTLAR ✅

### Onboarding
- [ ] Tadbirkor onboarding — boshidan oxirigacha test qilindi
- [ ] Reklamachi onboarding — test qilindi
- [ ] Agentlik onboarding — test qilindi
- [ ] Til o'zgartirish ishlaydi (uz/ru/en)

### AI Matching
- [ ] Tadbirkor profil yaratganda AI ishga tushadi
- [ ] Top-5 tavsiya ko'rsatiladi
- [ ] Moslik % to'g'ri hisoblanadi
- [ ] Fraud ball hisoblanadi

### Bitim
- [ ] Taklif yuborish ishlaydi
- [ ] Bot bildirishnomasi keladi
- [ ] Qabul qilish ishlaydi
- [ ] Payme to'lov linki ochiladi
- [ ] Payme webhook ishlaydi (escrow held)
- [ ] Kontent URL yuborish ishlaydi
- [ ] Tasdiqlash → escrow release ishlaydi
- [ ] Nizo ochish ishlaydi
- [ ] Admin nizo hal qiladi

### Admin Panel
- [ ] Login ishlaydi
- [ ] Dashboard ma'lumotlari to'g'ri
- [ ] Verifikatsiya navbati ishlaydi
- [ ] Nizo hal qilish ishlaydi
- [ ] Foydalanuvchi ban/unban ishlaydi

---

## 7. PERFORMANCE ✅

- [ ] API response time < 500ms (P95)
- [ ] AI matching < 3s
- [ ] DB so'rovlar optimallashtirildi (EXPLAIN ANALYZE)
- [ ] Redis cache ishlayapti
- [ ] Nginx gzip yoqilgan

---

## 8. BETA FOYDALANUVCHILAR ✅

### Tanlash kriterlari (50 kishi)
- [ ] 20 ta tadbirkor (turli sohalar)
- [ ] 25 ta reklamachi (turli platformalar)
- [ ] 5 ta agentlik

### Onboarding
- [ ] Beta invite link yaratildi
- [ ] Qo'llanma video tayyorlandi
- [ ] Feedback form yaratildi (Google Forms)
- [ ] Support chat guruh yaratildi (@MidasBetaSupport)

### Monitoring
- [ ] Grafana dashboard sozlandi
- [ ] Alerts sozlandi (downtime, error rate, payment failure)
- [ ] Kunlik hisobot bot yuboriladi

---

## 9. HUQUQIY ✅

- [ ] Foydalanuvchi shartnomasi yozildi
- [ ] Maxfiylik siyosati yozildi
- [ ] Telegram bot xizmat shartlari qabul qilindi
- [ ] Soliq masalasi hal qilindi (STIR raqam)

---

## 10. LAUNCH REJASI ✅

**Hafta 1 (ichki test):**
- Jamoa a'zolari + do'stlar (10 kishi)
- Barcha buyurtmalar qo'lda kuzatiladi

**Hafta 2–3 (beta):**
- 50 ta tanlangan foydalanuvchi
- Har kuni feedback to'plash
- Muhim xatolarni darhol tuzatish

**Hafta 4 (soft launch):**
- Public launch
- Reklama kampaniyasi boshlash
- Press release yuborish

---

*Har bir qatorni belgilang va deploy qiling! 🚀*

-- MIDAS Platform — Initial Migration
-- Bu fayl Prisma migrate orqali avtomatik ishlatiladi
-- Qo'lda ishlatish uchun: psql -U midas_user -d midas_db -f 001_init.sql

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Indexes for performance (Prisma schema'dagi @@index'lardan tashqari qo'shimcha)

-- Full text search uchun
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_advertiser_platform_handle
  ON "AdvertiserProfile" USING gin(to_tsvector('russian', COALESCE("platformHandle", '')));

-- AI matching uchun tez qidirish
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_matches_score
  ON "AiMatch" ("campaignId", "matchScore" DESC)
  WHERE "isDismissed" = false;

-- Faol bitimlar uchun
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_active
  ON "Deal" ("advertiserId", "status")
  WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'RESOLVED');

-- Notifications unread
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON "Notification" ("userId", "createdAt" DESC)
  WHERE "isRead" = false;

-- ─── Default Platform Settings ────────────
INSERT INTO "PlatformSetting" (key, value) VALUES
  ('commission_rate',           '0.07'),
  ('free_deals_per_month',      '5'),
  ('premium_price_advertiser',  '149000'),
  ('premium_price_business',    '99000'),
  ('fraud_suspend_threshold',   '60'),
  ('content_deadline_hours',    '48'),
  ('dispute_auto_resolve_hours','48'),
  ('admin_resolve_hours',       '72'),
  ('maintenance_mode',          'false')
ON CONFLICT (key) DO NOTHING;

-- ─── Default Industry Profiles (AI uchun) ─
INSERT INTO "IndustryProfile" (id, code, "nameUz", "nameRu", "nameEn", "audienceTemplate", "relatedCodes")
VALUES
  (uuid_generate_v4(), 'restaurant', 'Restoran', 'Ресторан', 'Restaurant',
   '{"age_min":18,"age_max":55,"gender":"mixed","gender_split":{"male":45,"female":55},"top_regions":["tashkent","samarkand"],"interests":["food","family","dining","local"],"income_level":"medium"}',
   ARRAY['fastfood','cafe']),

  (uuid_generate_v4(), 'fastfood', 'Tez ovqat', 'Фастфуд', 'Fast Food',
   '{"age_min":15,"age_max":40,"gender":"mixed","gender_split":{"male":55,"female":45},"top_regions":["tashkent"],"interests":["food","delivery","speed"],"income_level":"low"}',
   ARRAY['restaurant','cafe']),

  (uuid_generate_v4(), 'clothing', 'Kiyim-kechak', 'Одежда', 'Clothing',
   '{"age_min":16,"age_max":45,"gender":"female","gender_split":{"male":25,"female":75},"top_regions":["tashkent","samarkand","andijan"],"interests":["fashion","style","shopping","trends"],"income_level":"medium"}',
   ARRAY['shoes','accessories']),

  (uuid_generate_v4(), 'electronics', 'Elektronika', 'Электроника', 'Electronics',
   '{"age_min":18,"age_max":50,"gender":"male","gender_split":{"male":65,"female":35},"top_regions":["tashkent"],"interests":["tech","gadgets","gaming","internet"],"income_level":"medium"}',
   ARRAY['appliances','gadgets']),

  (uuid_generate_v4(), 'beauty', 'Go\'zallik', 'Красота', 'Beauty',
   '{"age_min":18,"age_max":45,"gender":"female","gender_split":{"male":10,"female":90},"top_regions":["tashkent","samarkand"],"interests":["beauty","makeup","skincare","fashion"],"income_level":"medium"}',
   ARRAY['cosmetics','salon']),

  (uuid_generate_v4(), 'fitness', 'Fitnes', 'Фитнес', 'Fitness',
   '{"age_min":18,"age_max":40,"gender":"mixed","gender_split":{"male":50,"female":50},"top_regions":["tashkent"],"interests":["sports","health","gym","lifestyle"],"income_level":"medium"}',
   ARRAY['sports','gym']),

  (uuid_generate_v4(), 'education', 'Ta\'lim', 'Образование', 'Education',
   '{"age_min":15,"age_max":35,"gender":"mixed","gender_split":{"male":50,"female":50},"top_regions":["tashkent","samarkand","andijan","namangan"],"interests":["learning","career","development","it"],"income_level":"low"}',
   ARRAY['courses','tutoring']),

  (uuid_generate_v4(), 'real_estate', 'Ko\'chmas mulk', 'Недвижимость', 'Real Estate',
   '{"age_min":25,"age_max":55,"gender":"mixed","gender_split":{"male":55,"female":45},"top_regions":["tashkent","tashkent_r"],"interests":["investment","family","home","finance"],"income_level":"high"}',
   ARRAY['construction','furniture']),

  (uuid_generate_v4(), 'auto', 'Avtomobil', 'Авто', 'Automotive',
   '{"age_min":22,"age_max":55,"gender":"male","gender_split":{"male":80,"female":20},"top_regions":["tashkent","samarkand"],"interests":["cars","tech","driving","investment"],"income_level":"high"}',
   ARRAY['auto_parts','auto_service']),

  (uuid_generate_v4(), 'pharmacy', 'Dorixona', 'Аптека', 'Pharmacy',
   '{"age_min":25,"age_max":65,"gender":"mixed","gender_split":{"male":40,"female":60},"top_regions":["tashkent","samarkand","andijan"],"interests":["health","family","wellness"],"income_level":"mixed"}',
   ARRAY['medical','clinic'])

ON CONFLICT (code) DO NOTHING;

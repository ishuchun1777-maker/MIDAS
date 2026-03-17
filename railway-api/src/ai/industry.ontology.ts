// MIDAS AI — Industry Ontology
// packages/api/src/ai/industry.ontology.ts
// Layer 1 uchun qo'lda tuzilgan soha-mijoz profil jadvali

export interface AudienceTemplate {
  age_min: number
  age_max: number
  gender: 'male' | 'female' | 'mixed'
  gender_split: { male: number; female: number }
  top_regions: string[]
  interests: string[]
  income_level: 'low' | 'medium' | 'high' | 'mixed'
  engagement_pattern: 'daily' | 'weekly' | 'occasional'
  best_platforms: string[]
  peak_hours: string[]
  seasonal_boost?: string[]
}

export interface IndustryEntry {
  code: string
  nameUz: string
  nameRu: string
  nameEn: string
  keywords: string[]           // NLP uchun
  relatedCodes: string[]
  audience: AudienceTemplate
  avgCPM_uzs: number           // O'rtacha narx minglab so'mda
}

export const INDUSTRY_ONTOLOGY: IndustryEntry[] = [
  {
    code: 'restaurant',
    nameUz: 'Restoran', nameRu: 'Ресторан', nameEn: 'Restaurant',
    keywords: ['restoran', 'cafe', 'oshxona', 'taom', 'restaurant', 'ресторан', 'кафе', 'еда'],
    relatedCodes: ['fastfood', 'cafe', 'catering'],
    audience: {
      age_min: 18, age_max: 55, gender: 'mixed',
      gender_split: { male: 45, female: 55 },
      top_regions: ['tashkent', 'samarkand', 'andijan'],
      interests: ['food', 'dining', 'family', 'local', 'lifestyle'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TELEGRAM_CHANNEL', 'TIKTOK'],
      peak_hours: ['12:00-14:00', '18:00-21:00'],
      seasonal_boost: ['ramazon', 'yangi_yil', 'navro\'z'],
    },
    avgCPM_uzs: 45000,
  },
  {
    code: 'fastfood',
    nameUz: 'Tez ovqat', nameRu: 'Фастфуд', nameEn: 'Fast food',
    keywords: ['fastfood', 'burger', 'pizza', 'tez ovqat', 'доставка', 'delivery'],
    relatedCodes: ['restaurant', 'cafe', 'delivery'],
    audience: {
      age_min: 15, age_max: 40, gender: 'mixed',
      gender_split: { male: 55, female: 45 },
      top_regions: ['tashkent'],
      interests: ['food', 'delivery', 'speed', 'games', 'entertainment'],
      income_level: 'low',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TIKTOK', 'TELEGRAM_CHANNEL'],
      peak_hours: ['11:00-14:00', '17:00-22:00'],
    },
    avgCPM_uzs: 35000,
  },
  {
    code: 'clothing',
    nameUz: 'Kiyim-kechak', nameRu: 'Одежда', nameEn: 'Clothing',
    keywords: ['kiyim', 'moda', 'fashion', 'одежда', 'style', 'outfit', 'trend'],
    relatedCodes: ['shoes', 'accessories', 'sport_clothing'],
    audience: {
      age_min: 16, age_max: 45, gender: 'female',
      gender_split: { male: 20, female: 80 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'namangan'],
      interests: ['fashion', 'style', 'shopping', 'beauty', 'trends', 'instagram'],
      income_level: 'medium',
      engagement_pattern: 'weekly',
      best_platforms: ['INSTAGRAM', 'TIKTOK'],
      peak_hours: ['20:00-23:00'],
      seasonal_boost: ['yangi_yil', 'navro\'z', 'toqqiz_mart'],
    },
    avgCPM_uzs: 55000,
  },
  {
    code: 'shoes',
    nameUz: 'Poyabzal', nameRu: 'Обувь', nameEn: 'Footwear',
    keywords: ['poyabzal', 'tuflya', 'кроссовки', 'shoes', 'sneakers', 'boots'],
    relatedCodes: ['clothing', 'accessories', 'sport'],
    audience: {
      age_min: 16, age_max: 45, gender: 'mixed',
      gender_split: { male: 35, female: 65 },
      top_regions: ['tashkent', 'samarkand', 'andijan'],
      interests: ['fashion', 'style', 'sports', 'shopping'],
      income_level: 'medium',
      engagement_pattern: 'weekly',
      best_platforms: ['INSTAGRAM', 'TIKTOK'],
      peak_hours: ['19:00-23:00'],
    },
    avgCPM_uzs: 50000,
  },
  {
    code: 'electronics',
    nameUz: 'Elektronika', nameRu: 'Электроника', nameEn: 'Electronics',
    keywords: ['telefon', 'laptop', 'elektronika', 'gadget', 'tech', 'электроника', 'смартфон'],
    relatedCodes: ['appliances', 'gadgets', 'it'],
    audience: {
      age_min: 18, age_max: 50, gender: 'male',
      gender_split: { male: 65, female: 35 },
      top_regions: ['tashkent', 'samarkand'],
      interests: ['tech', 'gadgets', 'gaming', 'internet', 'reviews'],
      income_level: 'medium',
      engagement_pattern: 'weekly',
      best_platforms: ['YOUTUBE', 'TELEGRAM_CHANNEL', 'INSTAGRAM'],
      peak_hours: ['20:00-00:00'],
    },
    avgCPM_uzs: 60000,
  },
  {
    code: 'beauty',
    nameUz: "Go'zallik va parvarish", nameRu: 'Красота и уход', nameEn: 'Beauty & Care',
    keywords: ['krem', 'parfum', 'kosmetika', 'beauty', 'makeup', 'skincare', 'красота', 'косметика'],
    relatedCodes: ['cosmetics', 'salon', 'pharmacy'],
    audience: {
      age_min: 16, age_max: 45, gender: 'female',
      gender_split: { male: 8, female: 92 },
      top_regions: ['tashkent', 'samarkand', 'bukhara'],
      interests: ['beauty', 'makeup', 'skincare', 'fashion', 'lifestyle'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
      peak_hours: ['20:00-23:00'],
      seasonal_boost: ['toqqiz_mart', 'yangi_yil'],
    },
    avgCPM_uzs: 65000,
  },
  {
    code: 'fitness',
    nameUz: 'Fitnes va sport', nameRu: 'Фитнес и спорт', nameEn: 'Fitness & Sports',
    keywords: ['gym', 'fitnes', 'sport', 'mashq', 'фитнес', 'тренажёр', 'workout'],
    relatedCodes: ['sports', 'health', 'nutrition'],
    audience: {
      age_min: 18, age_max: 40, gender: 'mixed',
      gender_split: { male: 50, female: 50 },
      top_regions: ['tashkent'],
      interests: ['sports', 'health', 'gym', 'nutrition', 'lifestyle', 'motivation'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
      peak_hours: ['06:00-09:00', '17:00-20:00'],
    },
    avgCPM_uzs: 50000,
  },
  {
    code: 'education',
    nameUz: "Ta'lim va kurslar", nameRu: 'Образование и курсы', nameEn: 'Education & Courses',
    keywords: ['kurs', "ta'lim", 'dars', 'sertifikat', 'online', 'курсы', 'обучение', 'образование'],
    relatedCodes: ['courses', 'tutoring', 'it'],
    audience: {
      age_min: 15, age_max: 35, gender: 'mixed',
      gender_split: { male: 50, female: 50 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'namangan', 'fergana'],
      interests: ['learning', 'career', 'development', 'it', 'english', 'skills'],
      income_level: 'low',
      engagement_pattern: 'daily',
      best_platforms: ['TELEGRAM_CHANNEL', 'INSTAGRAM', 'YOUTUBE'],
      peak_hours: ['19:00-23:00'],
    },
    avgCPM_uzs: 30000,
  },
  {
    code: 'real_estate',
    nameUz: "Ko'chmas mulk", nameRu: 'Недвижимость', nameEn: 'Real Estate',
    keywords: ['uy', 'kvartira', "ko'chmas mulk", 'недвижимость', 'квартира', 'apartment', 'house'],
    relatedCodes: ['construction', 'furniture', 'interior'],
    audience: {
      age_min: 25, age_max: 55, gender: 'mixed',
      gender_split: { male: 55, female: 45 },
      top_regions: ['tashkent', 'tashkent_r'],
      interests: ['investment', 'family', 'home', 'finance', 'property'],
      income_level: 'high',
      engagement_pattern: 'occasional',
      best_platforms: ['TELEGRAM_CHANNEL', 'INSTAGRAM', 'YOUTUBE'],
      peak_hours: ['18:00-22:00'],
    },
    avgCPM_uzs: 80000,
  },
  {
    code: 'auto',
    nameUz: 'Avtomobil', nameRu: 'Автомобили', nameEn: 'Automotive',
    keywords: ['mashina', 'avto', 'автомобиль', 'car', 'avtomobil', 'yengil', 'nexia', 'cobalt'],
    relatedCodes: ['auto_parts', 'auto_service', 'fuel'],
    audience: {
      age_min: 22, age_max: 55, gender: 'male',
      gender_split: { male: 80, female: 20 },
      top_regions: ['tashkent', 'samarkand', 'andijan'],
      interests: ['cars', 'tech', 'driving', 'investment', 'mechanics'],
      income_level: 'high',
      engagement_pattern: 'weekly',
      best_platforms: ['YOUTUBE', 'TELEGRAM_CHANNEL', 'INSTAGRAM'],
      peak_hours: ['19:00-22:00'],
    },
    avgCPM_uzs: 70000,
  },
  {
    code: 'pharmacy',
    nameUz: 'Dorixona va tibbiyot', nameRu: 'Аптека и медицина', nameEn: 'Pharmacy & Medical',
    keywords: ['dori', 'dorixona', 'apteka', 'аптека', 'таблетки', 'pharma', 'vitamin'],
    relatedCodes: ['medical', 'clinic', 'wellness'],
    audience: {
      age_min: 25, age_max: 65, gender: 'mixed',
      gender_split: { male: 40, female: 60 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'fergana', 'namangan'],
      interests: ['health', 'family', 'wellness', 'nutrition'],
      income_level: 'mixed',
      engagement_pattern: 'weekly',
      best_platforms: ['TELEGRAM_CHANNEL', 'INSTAGRAM'],
      peak_hours: ['18:00-21:00'],
    },
    avgCPM_uzs: 40000,
  },
  {
    code: 'travel',
    nameUz: 'Sayohat va turizm', nameRu: 'Туризм и путешествия', nameEn: 'Travel & Tourism',
    keywords: ['sayohat', 'tur', 'turizm', 'виза', 'travel', 'tour', 'путешествие'],
    relatedCodes: ['hotel', 'aviation', 'visa'],
    audience: {
      age_min: 20, age_max: 50, gender: 'mixed',
      gender_split: { male: 45, female: 55 },
      top_regions: ['tashkent'],
      interests: ['travel', 'adventure', 'culture', 'family', 'photography'],
      income_level: 'high',
      engagement_pattern: 'occasional',
      best_platforms: ['INSTAGRAM', 'YOUTUBE', 'TIKTOK'],
      peak_hours: ['20:00-23:00'],
      seasonal_boost: ['yoz', 'qish_tatil'],
    },
    avgCPM_uzs: 75000,
  },
  {
    code: 'finance',
    nameUz: "Moliya va bank", nameRu: 'Финансы и банки', nameEn: 'Finance & Banking',
    keywords: ['bank', 'kredit', 'moliya', 'банк', 'кредит', 'депозит', 'loan', 'invest'],
    relatedCodes: ['insurance', 'investment', 'crypto'],
    audience: {
      age_min: 22, age_max: 55, gender: 'male',
      gender_split: { male: 60, female: 40 },
      top_regions: ['tashkent'],
      interests: ['finance', 'investment', 'business', 'career', 'savings'],
      income_level: 'high',
      engagement_pattern: 'weekly',
      best_platforms: ['TELEGRAM_CHANNEL', 'YOUTUBE'],
      peak_hours: ['08:00-10:00', '18:00-21:00'],
    },
    avgCPM_uzs: 90000,
  },
  {
    code: 'children',
    nameUz: 'Bolalar mahsulotlari', nameRu: 'Детские товары', nameEn: 'Children Products',
    keywords: ['bola', 'toys', 'o\'yinchoq', 'детский', 'toys', "ko'ylak", 'pampers'],
    relatedCodes: ['baby', 'toys', 'education'],
    audience: {
      age_min: 22, age_max: 45, gender: 'female',
      gender_split: { male: 20, female: 80 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'namangan', 'fergana'],
      interests: ['parenting', 'children', 'family', 'education', 'health'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TELEGRAM_CHANNEL', 'TIKTOK'],
      peak_hours: ['20:00-23:00'],
    },
    avgCPM_uzs: 45000,
  },
  {
    code: 'wedding',
    nameUz: "To'y va bayram xizmatlari", nameRu: 'Свадебные услуги', nameEn: 'Wedding Services',
    keywords: ["to'y", 'nikoh', 'свадьба', 'wedding', 'banket', 'фотограф', 'декор'],
    relatedCodes: ['photography', 'design', 'catering'],
    audience: {
      age_min: 18, age_max: 45, gender: 'female',
      gender_split: { male: 25, female: 75 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'namangan', 'fergana', 'bukhara'],
      interests: ['wedding', 'family', 'fashion', 'photography', 'design'],
      income_level: 'medium',
      engagement_pattern: 'occasional',
      best_platforms: ['INSTAGRAM', 'TIKTOK'],
      peak_hours: ['20:00-23:00'],
      seasonal_boost: ['bahor', 'kuz'],
    },
    avgCPM_uzs: 55000,
  },
  {
    code: 'it',
    nameUz: 'IT va dasturlar', nameRu: 'IT и программы', nameEn: 'IT & Software',
    keywords: ['dastur', 'it', 'programming', 'app', 'software', 'startup', 'код', 'программирование'],
    relatedCodes: ['education', 'courses', 'gadgets'],
    audience: {
      age_min: 18, age_max: 40, gender: 'male',
      gender_split: { male: 70, female: 30 },
      top_regions: ['tashkent'],
      interests: ['tech', 'programming', 'startup', 'gaming', 'ai', 'career'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['TELEGRAM_CHANNEL', 'YOUTUBE', 'INSTAGRAM'],
      peak_hours: ['21:00-01:00'],
    },
    avgCPM_uzs: 55000,
  },
  {
    code: 'grocery',
    nameUz: 'Oziq-ovqat va supermarket', nameRu: 'Продукты и супермаркет', nameEn: 'Grocery & Supermarket',
    keywords: ['oziq-ovqat', 'supermarket', 'do\'kon', 'mahsulot', 'продукты', 'магазин', 'delivery'],
    relatedCodes: ['delivery', 'organic', 'restaurant'],
    audience: {
      age_min: 20, age_max: 60, gender: 'mixed',
      gender_split: { male: 35, female: 65 },
      top_regions: ['tashkent', 'samarkand', 'andijan', 'namangan', 'fergana'],
      interests: ['food', 'family', 'savings', 'health', 'cooking'],
      income_level: 'mixed',
      engagement_pattern: 'daily',
      best_platforms: ['TELEGRAM_CHANNEL', 'INSTAGRAM'],
      peak_hours: ['17:00-21:00'],
    },
    avgCPM_uzs: 35000,
  },
  {
    code: 'medical',
    nameUz: 'Klinika va tibbiy xizmatlar', nameRu: 'Клиника и медуслуги', nameEn: 'Clinic & Medical Services',
    keywords: ['klinika', 'shifokor', 'tibbiyot', 'clinic', 'doctor', 'медицина', 'поликлиника'],
    relatedCodes: ['pharmacy', 'dental', 'wellness'],
    audience: {
      age_min: 25, age_max: 60, gender: 'mixed',
      gender_split: { male: 40, female: 60 },
      top_regions: ['tashkent', 'samarkand'],
      interests: ['health', 'family', 'wellness', 'prevention'],
      income_level: 'medium',
      engagement_pattern: 'occasional',
      best_platforms: ['TELEGRAM_CHANNEL', 'INSTAGRAM'],
      peak_hours: ['18:00-21:00'],
    },
    avgCPM_uzs: 50000,
  },
  {
    code: 'pets',
    nameUz: "Uy hayvonlari", nameRu: 'Домашние животные', nameEn: 'Pets',
    keywords: ['it', 'mushuk', 'hayvon', 'pet', 'dog', 'cat', 'питомец', 'ветеринар'],
    relatedCodes: ['vet', 'pet_shop'],
    audience: {
      age_min: 18, age_max: 45, gender: 'female',
      gender_split: { male: 30, female: 70 },
      top_regions: ['tashkent'],
      interests: ['pets', 'animals', 'lifestyle', 'family'],
      income_level: 'medium',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TIKTOK'],
      peak_hours: ['20:00-23:00'],
    },
    avgCPM_uzs: 40000,
  },
  {
    code: 'entertainment',
    nameUz: "Ko'ngilochar va media", nameRu: 'Развлечения и медиа', nameEn: 'Entertainment & Media',
    keywords: ["ko'ngil", 'kino', 'konsert', 'games', 'развлечения', 'кино', 'шоу', 'event'],
    relatedCodes: ['events', 'gaming', 'music'],
    audience: {
      age_min: 15, age_max: 40, gender: 'mixed',
      gender_split: { male: 50, female: 50 },
      top_regions: ['tashkent'],
      interests: ['entertainment', 'music', 'games', 'movies', 'social'],
      income_level: 'low',
      engagement_pattern: 'daily',
      best_platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TELEGRAM_CHANNEL'],
      peak_hours: ['20:00-00:00'],
    },
    avgCPM_uzs: 30000,
  },
]

// ─── Lookup helpers ────────────────────────

export function getIndustryByCode(code: string): IndustryEntry | undefined {
  return INDUSTRY_ONTOLOGY.find(i => i.code === code)
}

export function findIndustryByKeyword(query: string): IndustryEntry | undefined {
  const q = query.toLowerCase()
  return INDUSTRY_ONTOLOGY.find(industry =>
    industry.keywords.some(kw => q.includes(kw) || kw.includes(q))
  )
}

export function getRelatedIndustries(code: string): IndustryEntry[] {
  const entry = getIndustryByCode(code)
  if (!entry) return []
  return entry.relatedCodes
    .map(c => getIndustryByCode(c))
    .filter(Boolean) as IndustryEntry[]
}

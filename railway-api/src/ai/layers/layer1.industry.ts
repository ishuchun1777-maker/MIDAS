// MIDAS AI — Layer 1: Soha tahlili
// packages/api/src/ai/layers/layer1.industry.ts

import OpenAI from 'openai'
import { INDUSTRY_ONTOLOGY, getIndustryByCode, findIndustryByKeyword, AudienceTemplate } from '../industry.ontology'
import { cacheGet, cacheSet } from '../../plugins/redis'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface IndustryAnalysisInput {
  industryCode?: string
  businessName: string
  description?: string
  region: string
  budgetRange: string
}

export interface IndustryAnalysisOutput {
  industryCode: string
  industryName: { uz: string; ru: string; en: string }
  audienceProfile: AudienceTemplate
  matchingKeywords: string[]
  reasoning: string
  confidence: number   // 0–1
}

/**
 * Layer 1: Soha tahlili
 * 1. Avval ontologiyadan qidiramiz (tez, bepul)
 * 2. Topilmasa OpenAI bilan tasnif qilamiz
 */
export async function analyzeIndustry(
  input: IndustryAnalysisInput
): Promise<IndustryAnalysisOutput> {
  // Cache tekshiruv
  const cacheKey = `ai:l1:${input.industryCode || input.businessName.toLowerCase().slice(0, 20)}`
  const cached = await cacheGet<IndustryAnalysisOutput>(cacheKey)
  if (cached) return cached

  // Ontologiyadan qidiramiz
  let industryEntry = input.industryCode
    ? getIndustryByCode(input.industryCode)
    : findIndustryByKeyword(input.businessName)

  if (industryEntry) {
    // Ontologiyadan topildi — byudjet va regionga moslashtiramiz
    const profile = adaptAudienceToContext(industryEntry.audience, input)
    const result: IndustryAnalysisOutput = {
      industryCode: industryEntry.code,
      industryName: {
        uz: industryEntry.nameUz,
        ru: industryEntry.nameRu,
        en: industryEntry.nameEn,
      },
      audienceProfile: profile,
      matchingKeywords: industryEntry.keywords.slice(0, 5),
      reasoning: `"${input.businessName}" biznesiga mos "${industryEntry.nameUz}" sohasining standart auditoriya profili ishlatildi.`,
      confidence: 0.9,
    }
    await cacheSet(cacheKey, result, 60 * 60 * 24) // 24 soat cache
    return result
  }

  // Ontologiyada yo'q — OpenAI bilan tasnif
  return classifyWithOpenAI(input)
}

/**
 * OpenAI bilan soha tasnifi (fallback)
 */
async function classifyWithOpenAI(
  input: IndustryAnalysisInput
): Promise<IndustryAnalysisOutput> {
  const availableCodes = INDUSTRY_ONTOLOGY.map(i => `${i.code}: ${i.nameUz}`).join('\n')

  const prompt = `Sen O'zbekistondagi biznes soha tasniflovchisisiz.

Biznes ma'lumoti:
- Nomi: "${input.businessName}"
- Tavsif: "${input.description || 'yo\'q'}"
- Hudud: ${input.region}
- Byudjet: ${input.budgetRange}

Mavjud sohalar:
${availableCodes}

Quyidagi JSON formatida javob ber (boshqa hech narsa yozma):
{
  "industryCode": "eng mos kod",
  "confidence": 0.0-1.0,
  "reasoning": "nima uchun bu sohaga kiritildi (o'zbekcha)",
  "audienceAge": {"min": 18, "max": 45},
  "audienceGender": "male|female|mixed",
  "topInterests": ["qiziqish1", "qiziqish2", "qiziqish3"],
  "incomeLevel": "low|medium|high|mixed"
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    })

    const text = response.choices[0].message.content || '{}'
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    const baseIndustry = getIndustryByCode(parsed.industryCode)
    const baseAudience = baseIndustry?.audience || INDUSTRY_ONTOLOGY[0].audience

    const audienceProfile: AudienceTemplate = {
      ...baseAudience,
      age_min: parsed.audienceAge?.min || baseAudience.age_min,
      age_max: parsed.audienceAge?.max || baseAudience.age_max,
      gender: parsed.audienceGender || baseAudience.gender,
      interests: parsed.topInterests || baseAudience.interests,
      income_level: parsed.incomeLevel || baseAudience.income_level,
    }

    const result: IndustryAnalysisOutput = {
      industryCode: parsed.industryCode || 'other',
      industryName: {
        uz: baseIndustry?.nameUz || input.businessName,
        ru: baseIndustry?.nameRu || input.businessName,
        en: baseIndustry?.nameEn || input.businessName,
      },
      audienceProfile,
      matchingKeywords: parsed.topInterests || [],
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 0.7,
    }

    await cacheSet(`ai:l1:${input.businessName.toLowerCase().slice(0, 20)}`, result, 60 * 60 * 12)
    return result

  } catch (err) {
    console.error('OpenAI classify error:', err)
    // Fallback: "other" soha
    const fallback = INDUSTRY_ONTOLOGY.find(i => i.code === 'other') || INDUSTRY_ONTOLOGY[0]
    return {
      industryCode: 'other',
      industryName: { uz: "Boshqa soha", ru: "Другая сфера", en: "Other" },
      audienceProfile: fallback.audience,
      matchingKeywords: [],
      reasoning: 'Soha aniqlanmadi, umumiy profil ishlatildi',
      confidence: 0.3,
    }
  }
}

/**
 * Byudjet va hududga qarab auditoriya profilini moslashtiramiz
 */
function adaptAudienceToContext(
  base: AudienceTemplate,
  ctx: IndustryAnalysisInput
): AudienceTemplate {
  const adapted = { ...base }

  // Hudud: agar Toshkent bo'lmasa — top_regions ga biznes hududini qo'shamiz
  if (ctx.region && ctx.region !== 'tashkent' && !adapted.top_regions.includes(ctx.region)) {
    adapted.top_regions = [ctx.region, ...adapted.top_regions.slice(0, 2)]
  }

  // Byudjet: yuqori byudjet → daromad darajasi yuqoriroq auditoriya
  if (ctx.budgetRange === 'LARGE' || ctx.budgetRange === 'ENTERPRISE') {
    if (adapted.income_level === 'low') adapted.income_level = 'medium'
    if (adapted.income_level === 'medium') adapted.income_level = 'high'
  }

  return adapted
}

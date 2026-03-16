// MIDAS Bot — Context Types
import { Context, SessionFlavor } from 'grammy'
import { I18nFlavor } from '@grammyjs/i18n'
import { ConversationFlavor } from '@grammyjs/conversations'
import { FileFlavor } from '@grammyjs/files'

export interface SessionData {
  lang: 'uz' | 'ru' | 'en'
  userId: string | null
  role: string | null
  onboardingStep: number
  __language_code: string
  // Onboarding temp data
  _ob: {
    phone?: string
    businessName?: string
    industryCode?: string
    industryName?: string
    region?: string
    budget?: string
    advertiserType?: string
    platformHandle?: string
    followerCount?: number
    pricePost?: number
    priceStory?: number
    ageMin?: number
    ageMax?: number
    gender?: string
    interests?: string[]
    companyName?: string
    legalName?: string
  }
}

export type MyContext = FileFlavor<
  Context &
  SessionFlavor<SessionData> &
  I18nFlavor &
  ConversationFlavor
>

export type MyConversation = import('@grammyjs/conversations').Conversation<MyContext>

// MIDAS Bot — API Client
// apps/bot/src/utils/api.client.ts

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    token?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'UNKNOWN' }))
      throw new ApiError(res.status, err.error || 'REQUEST_FAILED', err)
    }

    return res.json() as Promise<T>
  }

  get<T>(path: string, token?: string) {
    return this.request<T>('GET', path, undefined, token)
  }

  post<T>(path: string, data?: unknown, token?: string) {
    return this.request<T>('POST', path, data, token)
  }

  put<T>(path: string, data?: unknown, token?: string) {
    return this.request<T>('PUT', path, data, token)
  }

  patch<T>(path: string, data?: unknown, token?: string) {
    return this.request<T>('PATCH', path, data, token)
  }

  delete<T>(path: string, token?: string) {
    return this.request<T>('DELETE', path, undefined, token)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public data?: unknown
  ) {
    super(code)
  }
}

export const apiClient = new ApiClient(BASE_URL)

// ─── Bot-specific API helpers ─────────────

export async function getBotUserByTelegramId(telegramId: number) {
  return apiClient.get<any>(`/users/telegram/${telegramId}`).catch(() => null)
}

export async function createBusinessProfile(userId: string, data: {
  businessName: string
  industryCode: string
  industryName: string
  region: string
  monthlyBudget: string
}, token: string) {
  return apiClient.post('/businesses/profile', { userId, ...data }, token)
}

export async function createAdvertiserProfile(userId: string, data: {
  advertiserType: string
  platformHandle?: string
  followerCount: number
  pricePost?: number
  priceStory?: number
  audienceData: object
}, token: string) {
  return apiClient.post('/advertisers/profile', { userId, ...data }, token)
}

export async function createAgencyProfile(userId: string, data: {
  companyName: string
  legalName?: string
  licenseUrl?: string
}, token: string) {
  return apiClient.post('/agencies/profile', { userId, ...data }, token)
}

export async function updateUserRole(userId: string, role: string, token: string) {
  return apiClient.patch(`/users/${userId}/role`, { role }, token)
}

export async function updateUserLang(userId: string, lang: string, token: string) {
  return apiClient.patch(`/users/${userId}/lang`, { lang }, token)
}

export async function triggerAiMatching(campaignId: string, token: string) {
  return apiClient.post(`/matches/generate/${campaignId}`, {}, token)
}

export async function getUserDeals(userId: string, token: string) {
  return apiClient.get<any[]>(`/deals/user/${userId}`, token)
}

export async function getUserWallet(userId: string, token: string) {
  return apiClient.get<any>(`/users/${userId}/wallet`, token)
}

export async function acceptDeal(dealId: string, token: string) {
  return apiClient.patch(`/deals/${dealId}/accept`, {}, token)
}

export async function rejectDeal(dealId: string, reason: string, token: string) {
  return apiClient.patch(`/deals/${dealId}/reject`, { reason }, token)
}

export async function submitContent(dealId: string, contentUrl: string, token: string) {
  return apiClient.patch(`/deals/${dealId}/submit-content`, { contentUrl }, token)
}

export async function confirmContent(dealId: string, token: string) {
  return apiClient.patch(`/deals/${dealId}/confirm`, {}, token)
}

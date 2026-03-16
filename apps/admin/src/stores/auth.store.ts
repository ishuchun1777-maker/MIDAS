// MIDAS Admin — Auth Store (Zustand)
// apps/admin/src/stores/auth.store.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface AuthState {
  token:  string | null
  user:   { id: string; role: string; fullName: string | null } | null
  login:  (telegramInitData: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user:  null,

      login: async (telegramInitData: string) => {
        const res = await api.post<any>('/auth/miniapp', { initData: telegramInitData, lang: 'uz' })
        if (res.accessToken) {
          localStorage.setItem('midas_admin_token', res.accessToken)
          set({ token: res.accessToken, user: res.user })
        }
      },

      logout: () => {
        localStorage.removeItem('midas_admin_token')
        set({ token: null, user: null })
      },
    }),
    { name: 'midas-admin-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)

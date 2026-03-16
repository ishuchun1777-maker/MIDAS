// MIDAS Admin — API Client + Auth Store
// apps/admin/src/api/client.ts

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'

export async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('midas_admin_token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('midas_admin_token')
    window.location.href = '/login'
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'UNKNOWN' }))
    throw new Error(err.error || 'REQUEST_FAILED')
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string)                   => adminFetch<T>(path),
  post:   <T>(path: string, body?: unknown)   => adminFetch<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)   => adminFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => adminFetch<T>(path, { method: 'DELETE' }),
}

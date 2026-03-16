// MIDAS Admin Panel — Main App
// apps/admin/src/App.tsx

import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage }    from './pages/Dashboard'
import { VerificationPage } from './pages/Verification'
import { DisputesPage }     from './pages/Disputes'
import { UsersPage }        from './pages/Users'
import { DealsPage }        from './pages/Deals'
import { FraudPage }        from './pages/Fraud'
import { FinancePage }      from './pages/Finance'
import { SettingsPage }     from './pages/Settings'
import { LoginPage }        from './pages/Login'
import { useAuthStore }     from './stores/auth.store'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function AppRoutes() {
  const { token } = useAuthStore()

  if (!token) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background-tertiary)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', maxWidth: 'calc(100vw - 220px)', overflow: 'auto' }}>
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/disputes"     element={<DisputesPage />} />
          <Route path="/users"        element={<UsersPage />} />
          <Route path="/deals"        element={<DealsPage />} />
          <Route path="/fraud"        element={<FraudPage />} />
          <Route path="/finance"      element={<FinancePage />} />
          <Route path="/settings"     element={<SettingsPage />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { path: '/',             label: 'Dashboard',       icon: '📊' },
  { path: '/verification', label: 'Verifikatsiya',   icon: '✅', badge: 'pending' },
  { path: '/disputes',     label: 'Nizolar',         icon: '⚖️', badge: 'disputes' },
  { path: '/users',        label: 'Foydalanuvchilar',icon: '👥' },
  { path: '/deals',        label: 'Bitimlar',        icon: '🤝' },
  { path: '/fraud',        label: 'Fraud',           icon: '🛡️', badge: 'fraud' },
  { path: '/finance',      label: 'Moliya',          icon: '💰' },
  { path: '/settings',     label: 'Sozlamalar',      icon: '⚙️' },
]

function Sidebar() {
  const location = useLocation()
  const { logout } = useAuthStore()

  return (
    <aside style={{
      width: 220, minHeight: '100vh',
      background: 'var(--color-background-primary)',
      borderRight: '0.5px solid var(--color-border-tertiary)',
      display: 'flex', flexDirection: 'column',
      padding: '0',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>MIDAS</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Admin Panel</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px',
                textDecoration: 'none',
                fontSize: 13,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-background-secondary)' : 'transparent',
                borderLeft: active ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                transition: 'all .12s',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '8px', border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 8, background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: 'var(--color-text-secondary)',
          }}
        >
          Chiqish
        </button>
      </div>
    </aside>
  )
}

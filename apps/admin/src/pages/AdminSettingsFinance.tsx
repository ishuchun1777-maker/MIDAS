// MIDAS Admin — Settings Page
// apps/admin/src/pages/Settings.tsx

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function SettingsPage() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<Record<string, string>>('/admin/settings'),
  })

  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.patch(`/admin/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settings'] }),
  })

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-text-secondary)' }}>Yuklanmoqda...</div>

  const SETTING_DEFS = [
    { key: 'commission_rate',           label: 'Komissiya foizi',          hint: 'Masalan: 0.07 = 7%',          type: 'number' },
    { key: 'free_deals_per_month',      label: 'Bepul bitimlar (oylik)',    hint: 'Masalan: 5',                  type: 'number' },
    { key: 'premium_price_advertiser',  label: 'Premium narxi (reklamachi)',hint: "So'mda. Masalan: 149000",     type: 'number' },
    { key: 'premium_price_business',    label: 'Premium narxi (tadbirkor)', hint: "So'mda. Masalan: 99000",      type: 'number' },
    { key: 'fraud_suspend_threshold',   label: 'Fraud chegarasi',           hint: 'Masalan: 60 (0-100)',         type: 'number' },
    { key: 'content_deadline_hours',    label: 'Kontent muddati (soat)',    hint: 'Masalan: 48',                 type: 'number' },
    { key: 'dispute_auto_resolve_hours',label: 'Nizo avtomatik yopilish',   hint: 'Masalan: 48',                 type: 'number' },
    { key: 'maintenance_mode',          label: 'Texnik ishlar rejimi',      hint: 'true yoki false',             type: 'text' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 24, color: 'var(--color-text-primary)' }}>
        Platforma sozlamalari
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {SETTING_DEFS.map(def => (
          <SettingCard
            key={def.key}
            settingKey={def.key}
            label={def.label}
            hint={def.hint}
            value={settings?.[def.key] || ''}
            onSave={(value) => updateSetting.mutate({ key: def.key, value })}
            isPending={updateSetting.isPending}
          />
        ))}
      </div>

      {/* Fraud scan trigger */}
      <div style={{ marginTop: 24, padding: 16, background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Fraud skanerlash</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          Barcha tasdiqlangan reklamachilarning fraud ballini qayta hisoblaydi.
          Haftalik avtomatik ishlaydi, lekin qo'lda ham ishlatish mumkin.
        </div>
        <button
          onClick={() => api.post('/admin/fraud/scan').then(() => alert('Scan boshlandi!'))}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          Fraud scan ishga tushirish
        </button>
      </div>
    </div>
  )
}

function SettingCard({ settingKey, label, hint, value: initial, onSave, isPending }: any) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await onSave(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{hint}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ flex: 1, padding: '7px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13 }}
        />
        <button
          onClick={handleSave}
          disabled={isPending || value === initial}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: saved ? '#1D9E75' : '#534AB7', color: '#fff', cursor: 'pointer', fontSize: 12, minWidth: 60 }}
        >
          {saved ? '✓' : 'Saqlash'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// FINANCE PAGE
// ══════════════════════════════════════════

export function FinancePage() {
  const [range, setRange] = useState(30)

  const fromDate = new Date(Date.now() - range * 86400_000).toISOString().split('T')[0]
  const toDate   = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['finance', range],
    queryFn: () => api.get<any>(`/admin/reports/financial?from=${fromDate}&to=${toDate}`),
  })

  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn:  () => api.get<any>('/payments/stats'),
  })

  function fmt(n: number) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>Moliya</h1>
        <select
          value={range}
          onChange={e => setRange(parseInt(e.target.value))}
          style={{ padding: '6px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 12 }}
        >
          <option value={7}>7 kun</option>
          <option value={30}>30 kun</option>
          <option value={90}>90 kun</option>
        </select>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Bugun daromad', value: `${fmt(stats?.today?.platformFees || 0)} so'm` },
          { label: 'Oy daromad',    value: `${fmt(stats?.thisMonth?.platformFees || 0)} so'm`, color: '#1D9E75' },
          { label: 'Oy aylanma',    value: `${fmt(stats?.thisMonth?.volume || 0)} so'm` },
          { label: 'Escrow held',   value: `${fmt(stats?.escrowHeld?.volume || 0)} so'm`, color: '#534AB7' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: color || 'var(--color-text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Provider breakdown */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>To'lov tizimi bo'yicha</div>
            {Object.entries(data?.byProvider || {}).map(([provider, fees]: any) => (
              <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{provider}</span>
                <span style={{ fontWeight: 500 }}>{fmt(fees)} so'm</span>
              </div>
            ))}
          </div>

          {/* Industry breakdown */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Soha bo'yicha aylanma (Top 5)</div>
            {Object.entries(data?.byIndustry || {})
              .sort(([,a]: any, [,b]: any) => b - a)
              .slice(0, 5)
              .map(([industry, volume]: any) => (
                <div key={industry} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{industry}</span>
                  <span style={{ fontWeight: 500 }}>{fmt(volume)} so'm</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Stub pages
export function DealsPage()   { return <div><h1 style={{ fontSize: 20, fontWeight: 500 }}>Bitimlar</h1><p style={{ color: 'var(--color-text-secondary)' }}>API: GET /admin/deals</p></div> }
export function FraudPage()   { return <div><h1 style={{ fontSize: 20, fontWeight: 500 }}>Fraud monitoring</h1><p style={{ color: 'var(--color-text-secondary)' }}>API: GET /admin/fraud/alerts</p></div> }
export function LoginPage()   { return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div style={{ textAlign: 'center' }}><h1>MIDAS Admin</h1><p style={{ color: 'var(--color-text-secondary)' }}>Telegram orqali kirish</p></div></div> }

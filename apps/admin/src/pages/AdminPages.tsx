// MIDAS Admin — Verification Page
// apps/admin/src/pages/Verification.tsx

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function VerificationPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['verification', page],
    queryFn: () => api.get<any>(`/admin/verification/pending?page=${page}&limit=20`),
  })

  const verify = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      api.patch(`/admin/verification/${id}`, { approved, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verification'] }),
  })

  if (isLoading) return <div style={s.loading}>Yuklanmoqda...</div>

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Verifikatsiya navbati</h1>
        <span style={s.badge}>{data?.total || 0} ta kutmoqda</span>
      </div>

      {!data?.items?.length && (
        <div style={s.empty}>Verifikatsiya navbati bo'sh ✓</div>
      )}

      {data?.items?.map((profile: any) => (
        <VerificationCard
          key={profile.id}
          profile={profile}
          onApprove={() => verify.mutate({ id: profile.id, approved: true })}
          onReject={(reason) => verify.mutate({ id: profile.id, approved: false, reason })}
          isPending={verify.isPending}
        />
      ))}

      <Pagination page={page} total={data?.total} limit={20} onChange={setPage} />
    </div>
  )
}

function VerificationCard({ profile, onApprove, onReject, isPending }: any) {
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div style={s.card}>
      <div style={s.cardRow}>
        <div>
          <div style={s.name}>{profile.user?.fullName || profile.platformHandle || '—'}</div>
          <div style={s.sub}>
            @{profile.user?.telegramUsername} · {profile.user?.phone} · {profile.advertiserType}
          </div>
          <div style={{ ...s.sub, marginTop: 4 }}>
            Obunachilar: {profile.followerCount?.toLocaleString()} ·
            Fraud ball: <span style={{ color: profile.fraudScore >= 60 ? '#1D9E75' : '#A32D2D' }}>{profile.fraudScore}</span> ·
            Narx: {profile.pricePost ? `${(profile.pricePost/1000).toFixed(0)}K so'm` : '—'}
          </div>
          {profile.platformHandle && (
            <div style={{ ...s.sub, marginTop: 2 }}>
              Havola: {profile.platformUrl || profile.platformHandle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {!rejectMode ? (
            <>
              <button onClick={onApprove} disabled={isPending} style={s.btnGreen}>✓ Tasdiqlash</button>
              <button onClick={() => setRejectMode(true)} disabled={isPending} style={s.btnRed}>✗ Rad etish</button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Rad etish sababi..."
                style={s.input}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { onReject(reason); setRejectMode(false) }} style={s.btnRed}>Tasdiqlash</button>
                <button onClick={() => setRejectMode(false)} style={s.btnGray}>Bekor</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={s.meta}>
        Ariza: {new Date(profile.createdAt).toLocaleDateString('uz-UZ')}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// DISPUTES PAGE
// ══════════════════════════════════════════

export function DisputesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', page],
    queryFn: () => api.get<any>(`/admin/disputes?page=${page}&limit=20`),
  })

  const resolve = useMutation({
    mutationFn: ({ id, ...body }: any) => api.post(`/admin/disputes/${id}/resolve`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['disputes'] }); setSelected(null) },
  })

  if (isLoading) return <div style={s.loading}>Yuklanmoqda...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
      <div>
        <div style={s.header}>
          <h1 style={s.h1}>Nizolar</h1>
          <span style={{ ...s.badge, background: '#FCEBEB', color: '#A32D2D' }}>{data?.total || 0} ta ochiq</span>
        </div>

        {!data?.disputes?.length && <div style={s.empty}>Ochiq nizolar yo'q ✓</div>}

        {data?.disputes?.map((dispute: any) => (
          <div
            key={dispute.id}
            style={{ ...s.card, cursor: 'pointer', borderLeft: dispute.status === 'UNDER_REVIEW' ? '3px solid #534AB7' : '3px solid #A32D2D' }}
            onClick={() => setSelected(dispute)}
          >
            <div style={s.cardRow}>
              <div>
                <div style={s.name}>Deal #{dispute.dealId.slice(-8)}</div>
                <div style={s.sub}>
                  🏪 {dispute.deal?.campaign?.business?.businessName} ↔
                  📢 {dispute.deal?.advertiser?.user?.fullName || dispute.deal?.advertiser?.platformHandle}
                </div>
                <div style={{ ...s.sub, marginTop: 4 }}>
                  💰 {Number(dispute.deal?.payment?.amount || 0).toLocaleString()} so'm
                </div>
                <div style={{ ...s.sub, marginTop: 4, color: 'var(--color-text-primary)' }}>
                  Sabab: {dispute.reason}
                </div>
              </div>
              <div>
                <span style={{
                  padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                  background: dispute.status === 'OPEN' ? '#FCEBEB' : '#EEEDFE',
                  color: dispute.status === 'OPEN' ? '#A32D2D' : '#534AB7',
                }}>
                  {dispute.status}
                </span>
              </div>
            </div>
            <div style={s.meta}>{new Date(dispute.createdAt).toLocaleDateString('uz-UZ')}</div>
          </div>
        ))}

        <Pagination page={page} total={data?.total} limit={20} onChange={setPage} />
      </div>

      {/* Nizo detail panel */}
      {selected && (
        <DisputePanel
          dispute={selected}
          onClose={() => setSelected(null)}
          onResolve={(body) => resolve.mutate({ id: selected.id, ...body })}
          isPending={resolve.isPending}
        />
      )}
    </div>
  )
}

function DisputePanel({ dispute, onClose, onResolve, isPending }: any) {
  const [resolution, setResolution] = useState('RESOLVED_REFUND')
  const [refundPct, setRefundPct]   = useState(100)
  const [adminNote, setAdminNote]   = useState('')

  return (
    <div style={{ ...s.card, position: 'sticky', top: 0, maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={s.name}>Nizo tafsiloti</div>
        <button onClick={onClose} style={s.btnGray}>✕</button>
      </div>

      <Section title="Ishtirokchilar">
        <Row label="Tadbirkor" value={dispute.deal?.campaign?.business?.businessName} />
        <Row label="Reklamachi" value={dispute.deal?.advertiser?.user?.fullName || dispute.deal?.advertiser?.platformHandle} />
        <Row label="Summa" value={`${Number(dispute.deal?.payment?.amount || 0).toLocaleString()} so'm`} />
        <Row label="Kontent" value={dispute.deal?.contentUrl ? <a href={dispute.deal.contentUrl} target="_blank" rel="noreferrer" style={{ color: '#534AB7' }}>Ko'rish</a> : '—'} />
      </Section>

      <Section title="Nizo sababi">
        <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.6 }}>
          {dispute.reason}
        </p>
      </Section>

      <Section title="Qaror">
        <select
          value={resolution}
          onChange={e => setResolution(e.target.value)}
          style={{ ...s.input, marginBottom: 8 }}
        >
          <option value="RESOLVED_REFUND">To'liq qaytarish (tadbirkorga)</option>
          <option value="RESOLVED_PARTIAL">Qisman qaytarish</option>
          <option value="RESOLVED_PAID_ADVERTISER">Reklamachiga to'lash</option>
        </select>

        {resolution === 'RESOLVED_PARTIAL' && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Qaytarish foizi: {refundPct}%
            </label>
            <input
              type="range" min={0} max={100} value={refundPct}
              onChange={e => setRefundPct(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
        )}

        <textarea
          value={adminNote}
          onChange={e => setAdminNote(e.target.value)}
          placeholder="Admin izohi (majburiy)..."
          style={{ ...s.input, height: 80, resize: 'vertical', display: 'block', marginBottom: 8 }}
        />

        <button
          onClick={() => onResolve({ resolution, adminNote, refundPercent: resolution === 'RESOLVED_PARTIAL' ? refundPct : undefined })}
          disabled={isPending || !adminNote.trim()}
          style={{ ...s.btnGreen, width: '100%' }}
        >
          {isPending ? 'Saqlanmoqda...' : 'Qarorni tasdiqlash'}
        </button>
      </Section>
    </div>
  )
}

// ══════════════════════════════════════════
// USERS PAGE
// ══════════════════════════════════════════

export function UsersPage() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn: () => api.get<any>(`/admin/users?page=${page}&limit=20${search ? `&search=${search}` : ''}${role ? `&role=${role}` : ''}`),
  })

  const banUser = useMutation({
    mutationFn: ({ id, banned, reason }: any) => api.patch(`/admin/users/${id}/ban`, { banned, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Foydalanuvchilar</h1>
        <span style={s.badge}>{data?.total?.toLocaleString() || 0} ta</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Ism, username, telefon..."
          style={{ ...s.input, flex: 1 }}
        />
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1) }} style={s.input}>
          <option value="">Barcha rollar</option>
          <option value="BUSINESS">Tadbirkor</option>
          <option value="ADVERTISER">Reklamachi</option>
          <option value="AGENCY">Agentlik</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {isLoading ? (
        <div style={s.loading}>Yuklanmoqda...</div>
      ) : (
        <table style={{ ...s.table, background: 'var(--color-background-primary)', borderRadius: 10, overflow: 'hidden', border: '0.5px solid var(--color-border-tertiary)' }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)' }}>
              {['Ism', 'Username', 'Rol', 'Til', 'Holat', 'Sana', 'Amal'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.users?.map((user: any) => (
              <tr key={user.id} style={{ opacity: user.isBanned ? 0.5 : 1 }}>
                <td style={s.td}>{user.fullName || '—'}</td>
                <td style={s.td}>@{user.telegramUsername || '—'}</td>
                <td style={s.td}><RoleBadge role={user.role} /></td>
                <td style={s.td}>{user.lang}</td>
                <td style={s.td}>
                  {user.isBanned
                    ? <span style={{ color: '#A32D2D', fontSize: 11 }}>Ban ({user.banReason?.slice(0,20)})</span>
                    : <span style={{ color: '#1D9E75', fontSize: 11 }}>Aktiv</span>}
                </td>
                <td style={s.td}>{new Date(user.createdAt).toLocaleDateString('uz')}</td>
                <td style={s.td}>
                  <button
                    onClick={() => banUser.mutate({
                      id: user.id,
                      banned: !user.isBanned,
                      reason: !user.isBanned ? 'Admin tomonidan bloklandi' : undefined,
                    })}
                    style={{ ...s.btnSmall, color: user.isBanned ? '#1D9E75' : '#A32D2D' }}
                  >
                    {user.isBanned ? 'Ochish' : 'Ban'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} total={data?.total} limit={20} onChange={setPage} />
    </div>
  )
}

// ─── Shared helpers ───────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    BUSINESS: '#1D9E75', ADVERTISER: '#534AB7', AGENCY: '#BA7517', ADMIN: '#A32D2D',
  }
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: (colors[role] || '#888') + '22', color: colors[role] || '#888', fontWeight: 500 }}>
      {role}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function Pagination({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil((total || 0) / limit)
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} style={s.btnGray}>←</button>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '6px 12px' }}>{page} / {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} style={s.btnGray}>→</button>
    </div>
  )
}

// ─── Styles ───────────────────────────────
const s: Record<string, React.CSSProperties> = {
  h1:      { fontSize: 20, fontWeight: 500, marginBottom: 0, color: 'var(--color-text-primary)' },
  loading: { padding: 40, color: 'var(--color-text-secondary)', textAlign: 'center' },
  empty:   { padding: 32, color: 'var(--color-text-secondary)', textAlign: 'center', background: 'var(--color-background-primary)', borderRadius: 10, border: '0.5px solid var(--color-border-tertiary)' },
  header:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  badge:   { fontSize: 11, padding: '3px 10px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B', fontWeight: 500 },
  card:    { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  name:    { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 },
  sub:     { fontSize: 12, color: 'var(--color-text-secondary)' },
  meta:    { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:      { textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 400, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td:      { padding: '8px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-primary)' },
  input:   { width: '100%', padding: '8px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 8, background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13, boxSizing: 'border-box' },
  btnGreen: { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  btnRed:   { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#A32D2D', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  btnGray:  { padding: '7px 14px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 12 },
  btnSmall: { padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', cursor: 'pointer', fontSize: 11 },
}

// MIDAS Admin — Dashboard Page
// apps/admin/src/pages/Dashboard.tsx

import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn:  () => api.get<any>('/admin/dashboard'),
    refetchInterval: 60_000,
  })

  if (isLoading) return <div style={styles.loading}>Yuklanmoqda...</div>
  if (!data) return null

  return (
    <div>
      <h1 style={styles.h1}>Dashboard</h1>

      {/* KPI kartalar */}
      <div style={styles.grid4}>
        <StatCard label="Jami foydalanuvchilar" value={fmt(data.users.total)}    sub={`+${data.users.today} bugun`} />
        <StatCard label="Faol bitimlar"         value={fmt(data.deals.active)}   sub={`${fmt(data.deals.total)} jami`} />
        <StatCard label="Oylik daromad (platform)" value={`${fmt(data.revenue.monthFees)} so'm`} sub={`${fmt(data.revenue.monthVolume)} so'm aylanma`} color="#1D9E75" />
        <StatCard label="Escrow (kutilayotgan)" value={`${fmt(data.revenue.escrowHeld)} so'm`} sub={`${data.revenue.escrowCount} ta bitim`} color="#534AB7" />
      </div>

      {/* Alert kartalar */}
      <div style={styles.grid3}>
        <AlertCard
          label="Verifikatsiya navbati"
          count={data.advertisers.pendingVerification}
          color="#BA7517"
          link="/verification"
        />
        <AlertCard
          label="Ochiq nizolar"
          count={data.disputes.open}
          color="#A32D2D"
          link="/disputes"
        />
        <AlertCard
          label="Fraud xavfi"
          count={data.fraudAlerts}
          color="#D85A30"
          link="/fraud"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        {/* Top reklamachilar */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Top reklamachilar</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Ism', 'Platforma', 'Bitimlar', 'Reyting', 'Fraud'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topAdvertisers?.map((adv: any) => (
                <tr key={adv.id} style={styles.tr}>
                  <td style={styles.td}>{adv.user?.fullName || adv.platformHandle || '—'}</td>
                  <td style={styles.td}><TypeBadge type={adv.advertiserType} /></td>
                  <td style={styles.td}>{adv.dealsCount}</td>
                  <td style={styles.td}>{adv.rating.toFixed(1)}</td>
                  <td style={styles.td}><FraudBadge score={adv.fraudScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* So'nggi bitimlar */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>So'nggi bitimlar</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Biznes', 'Narx', 'Holat', 'Vaqt'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentDeals?.map((deal: any) => (
                <tr key={deal.id} style={styles.tr}>
                  <td style={styles.td}>{deal.campaign?.business?.businessName || '—'}</td>
                  <td style={styles.td}>{fmt(deal.price)} so'm</td>
                  <td style={styles.td}><StatusBadge status={deal.status} /></td>
                  <td style={styles.td} >{new Date(deal.createdAt).toLocaleDateString('uz')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || 'var(--color-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function AlertCard({ label, count, color, link }: { label: string; count: number; color: string; link: string }) {
  return (
    <a href={link} style={{ textDecoration: 'none' }}>
      <div style={{ ...styles.statCard, borderLeft: `3px solid ${color}`, borderRadius: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 500, color, marginTop: 4 }}>{count}</div>
      </div>
    </a>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: '#BA7517', ACCEPTED: '#1D9E75', ESCROW_HELD: '#534AB7',
    CONTENT_SUBMITTED: '#185FA5', COMPLETED: '#3B6D11',
    DISPUTED: '#A32D2D', CANCELLED: '#888780',
  }
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 500,
      background: colors[status] + '22',
      color: colors[status] || '#888',
    }}>
      {status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    TELEGRAM_CHANNEL: 'TG', INSTAGRAM: 'IG', YOUTUBE: 'YT',
    TIKTOK: 'TT', BILLBOARD: 'BB', LED_SCREEN: 'LED',
  }
  return <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{icons[type] || type}</span>
}

function FraudBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#1D9E75' : score >= 60 ? '#BA7517' : '#A32D2D'
  return <span style={{ fontSize: 12, fontWeight: 500, color }}>{score}</span>
}

// ─── Styles ───────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 20, fontWeight: 500, marginBottom: 20, color: 'var(--color-text-primary)' },
  loading: { padding: 40, color: 'var(--color-text-secondary)', textAlign: 'center' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 8 },
  statCard: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10, padding: '14px 16px',
  },
  card: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10, padding: 16,
  },
  cardTitle: { fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 400, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td: { padding: '7px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-primary)' },
  tr: {},
}

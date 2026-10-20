import { AppShell } from '@/components/layout/AppShell'
import { Kpis } from '@/components/ds/Kpi'

// Fase 0 placeholder: the shell with the artist NAV and empty KPIs. Phase 1
// replaces it with the Dashboard of the design (session, profile, real counts).
export default function HomePage() {
  return (
    <AppShell user={{ initials: 'HA', profile: 'artist' }} activeKey="home">
      <div className="ha-page">
        <div className="ha-page__head">
          <div>
            <div className="ha-eyebrow">Início</div>
            <h1 className="ha-h1">Bem-vindo ao HouseArt</h1>
          </div>
        </div>
        <Kpis items={[
          { label: 'Obras certificadas', value: '—' },
          { label: 'À venda', value: '—' },
          { label: 'Vendidas em 2026', value: '—' },
          { label: 'Direito de sequência', value: '—' },
        ]} />
      </div>
    </AppShell>
  )
}

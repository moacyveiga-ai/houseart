// Cobrança for the HouseArt team: the house's revenue, not an account's plan.
import { Kpis } from '@/components/ds/Kpi'
import { formatBRL } from '@/lib/artworks/domain'

export interface HouseBillingProps {
  monthLabel: string; revenueCents: string; revenueByKind: { kind: string; label: string; cents: string }[]
  commissionHeldCents: string; activePlans: number; pastDuePlans: number
  payouts: { pendingCount: number; pendingCents: string; failed: { dealCode: string; party: string; amountCents: string; error: string }[] }
  invoices: { id: number; date: string; account: string; kind: string; description: string; amountCents: string; statusLabel: string }[]
}

const brl = (c: string) => formatBRL(BigInt(c))

export function HouseBillingScreen(p: HouseBillingProps) {
  return (
    <div className="ha-stack">
      <div className="ha-page__head"><div><div className="ha-eyebrow">Equipe HouseArt</div><h1 className="ha-h1">Cobrança da casa</h1></div></div>
      <Kpis items={[
        { label: `Receita em ${p.monthLabel}`, value: brl(p.revenueCents), note: p.revenueByKind.map((k) => `${k.label} ${brl(k.cents)}`).join(' · ') },
        { label: 'Comissão retida no split', value: brl(p.commissionHeldCents), note: 'libera quando a escritura é emitida' },
        { label: 'Planos ativos', value: String(p.activePlans), note: p.pastDuePlans ? `${p.pastDuePlans} em atraso` : 'nenhum em atraso' },
        { label: 'Repasses pendentes', value: String(p.payouts.pendingCount), note: p.payouts.pendingCount ? `${brl(p.payouts.pendingCents)} a pagar aos vendedores` : 'nada a repassar' },
      ]} />
      {p.payouts.failed.length ? (
        <section className="ha-card ha-card--pad ha-stack">
          <h2 className="ha-h3">Repasses com falha</h2>
          <p className="ha-muted ha-sm">A Stripe recusou estas transferências. O sistema tenta de novo de hora em hora; o vendedor ou a equipe pode tentar na hora pela página do negócio.</p>
          <ul className="ha-list">
            {p.payouts.failed.map((f, i) => (
              <li key={i} className="ha-list__row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span><b className="ha-id">{f.dealCode}</b> · {f.party}<br /><span className="ha-muted ha-sm">{f.error}</span></span>
                <span className="ha-markers__num">{brl(f.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <h2 className="ha-h3">Faturas recentes de todas as contas</h2>
      <div className="ha-markers" role="table" aria-label="Faturas">
        <div className="ha-markers__inner" style={{ minWidth: 820 }}>
          <div className="ha-house__row ha-markers__head" role="row"><span role="columnheader">Data</span><span role="columnheader">Conta</span><span role="columnheader">Tipo</span><span role="columnheader">Descrição</span><span role="columnheader">Valor</span><span role="columnheader">Situação</span></div>
          {p.invoices.length === 0 ? <div className="ha-markers__empty">Nenhuma fatura ainda.</div> : null}
          {p.invoices.map((i) => (
            <div key={i.id} className="ha-house__row ha-markers__row" role="row">
              <span role="cell" className="ha-markers__num">{i.date}</span><span role="cell">{i.account}</span><span role="cell">{i.kind}</span>
              <span role="cell">{i.description}</span><span role="cell" className="ha-markers__num">{brl(i.amountCents)}</span><span role="cell">{i.statusLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

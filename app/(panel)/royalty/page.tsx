import { requirePanelPage } from '../_session'
import { royaltyView } from '@/lib/resale-royalty/server'
import { Kpis } from '@/components/ds/Kpi'
import { Badge } from '@/components/ds/Badge'
import { formatBRL } from '@/lib/artworks/domain'

export const metadata = { title: 'Direito de sequência — HouseArt' }

export default async function RoyaltyPage() {
  const { scope } = await requirePanelPage('/royalty')
  const v = await royaltyView(scope)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Direito de sequência</h1></div>
      <p className="ha-muted">A cada revenda registrada na HouseArt, 5% da valorização é retido e repassado ao artista automaticamente (Lei 9.610/98, art. 38).</p>
      <Kpis items={[
        { label: `Recebido em ${v.year}`, value: formatBRL(v.kpis.yearCents), note: 'Repasses já pagos neste ano' },
        { label: 'A receber', value: formatBRL(v.kpis.pendingCents), note: 'Retido nas revendas, liberado na conclusão do negócio' },
        { label: 'Obras revendidas', value: String(v.kpis.resold), note: 'Obras suas que mudaram de dono na HouseArt' },
      ]} />
      <section className="ha-table" style={{ '--ha-cols': '100px 2fr 1fr 1fr 1fr 120px' } as React.CSSProperties}>
        <div className="ha-table__inner">
          <div className="ha-table__head"><div>Data</div><div>Obra</div><div>Revenda</div><div>Valorização</div><div>Repasse 5%</div><div>Status</div></div>
          {v.rows.length === 0 ? <div className="ha-table__row"><div className="ha-muted">Nenhuma revenda registrada.</div></div> : null}
          {v.rows.map((r) => <div key={r.id} className="ha-table__row"><div>{r.date}</div><div className="ha-row" style={{ gap: 12, flexWrap: 'nowrap', minWidth: 0 }}><span className="ha-wall ha-wall--thumb" aria-hidden>{/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            {r.cover ? <img src={r.cover} alt="" /> : null}</span><span style={{ minWidth: 0 }}><em style={{ fontFamily: 'var(--ha-font-display)' }}>{r.title}</em>{r.artworkYear ? <span className="ha-muted">, {r.artworkYear}</span> : null}</span></div><div className="ha-num">{formatBRL(r.saleCents)}</div><div className="ha-num">{formatBRL(r.appreciationCents)}</div><div className="ha-num">{formatBRL(r.royaltyCents)}</div><div><Badge tone={r.paid ? 'verified' : 'pending'}>{r.status}</Badge></div></div>)}
        </div>
      </section>
    </div>
  )
}

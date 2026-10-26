// "Vendas em {ano}" (handoff "Web Artista" › Início): one bar per month, the current one in sand,
// the caption "R$ 268 mil em 11 obras". Server Component over the pure `salesChart`.
import type { SalesChart as SalesChartData } from '@/lib/dashboard/core'
import './dashboard.css'

export function SalesChart({ year, chart }: { year: number; chart: SalesChartData }) {
  return (
    <section className="ha-dash__section" aria-labelledby="ha-dash-sales">
      <div className="ha-dash__head"><h2 id="ha-dash-sales" className="ha-dash__title">Vendas em {year}</h2><span className="ha-dash__caption">{chart.total}</span></div>
      <div className="ha-dash__chart" role="img" aria-label={chart.empty ? `Vendas em ${year}: nenhuma venda concluída ainda` : `Vendas em ${year} por mês: ${chart.bars.filter((b) => b.count).map((b) => `${b.month} ${b.label}`).join(', ')}`}>
        {chart.empty ? <p className="ha-dash__empty">As vendas concluídas pela HouseArt aparecem aqui, mês a mês.</p> : chart.bars.map((b) => (
          <div key={b.month} className={`ha-dash__bar${b.current ? ' ha-dash__bar--now' : ''}`}>
            <span className="ha-dash__bar-v">{b.label}</span>
            <div className="ha-dash__bar-fill" style={{ height: `${b.pct}%` }} />
            <span className="ha-dash__bar-m">{b.month}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

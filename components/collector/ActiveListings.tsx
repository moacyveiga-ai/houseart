// "Anúncios ativos" of the collector's Vendas (handoff "Web Colecionador" › Vendas): one row per
// work on the marketplace — price "· aceita ofertas / preço fixo", "N visualizações · N curtidas ·
// N comentários" — opening the work in the collection's side panel (?own=). Server Component.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import { ACTIVE_LISTINGS_HINT, modeLine, statsLine } from '@/lib/collectors/listings-core'
import type { ActiveListingRow } from '@/lib/collectors/listings-server'
import './active-listings.css'

export function ActiveListings({ rows }: { rows: ActiveListingRow[] }) {
  // a paused listing keeps status LISTED but is out of the marketplace: listed here as "pausado", not counted as on sale
  const live = rows.filter((r) => !r.paused).length
  return (
    <section className="ha-alist" aria-labelledby="ha-alist-title">
      <div className="ha-alist__head">
        <h2 id="ha-alist-title" className="ha-alist__title">Anúncios ativos</h2>
        <span className="ha-alist__count">{live} {live === 1 ? 'obra à venda' : 'obras à venda'}{rows.length > live ? ` · ${rows.length - live} ${rows.length - live === 1 ? 'pausada' : 'pausadas'}` : ''}</span>
      </div>
      {rows.length === 0 ? <p className="ha-muted ha-sm">Nenhuma obra sua está no marketplace agora.</p> : (
        <ul className="ha-alist__list">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/wallet?own=${r.id}`} className="ha-alist__row">
                <span className="ha-alist__wall">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                  {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <Icon name="imagesmode" size={24} />}</span>
                <span className="ha-alist__body">
                  <span className="ha-alist__name">{r.title}{r.year ? `, ${r.year}` : ''}</span>
                  <span className="ha-alist__price">{r.saleMode === 'ON_REQUEST' ? 'Sob consulta' : formatBRL(r.listPriceCents === null ? null : BigInt(r.listPriceCents))} <span>· {modeLine(r)}</span></span>
                  <span className="ha-alist__stats">{statsLine(r.stats)}</span>
                </span>
                <span className="ha-alist__chev"><Icon name="chevron_right" size={20} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="ha-alist__hint">{ACTIVE_LISTINGS_HINT}</p>
    </section>
  )
}

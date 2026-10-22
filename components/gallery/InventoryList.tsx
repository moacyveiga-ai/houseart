// "Acervo" (handoff "HouseArt Web Galeria" › Acervo): summary, search (GET ?q=),
// chips by status and the rows (68 px wall, italic title, artist · year, price +
// status pill, views · offers). Server Component; the page loads and filters.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Chip } from '@/components/ds/Chip'
import { INVENTORY_CHIPS, emptyText, rowPrice, rowStats, rowStatus, summaryLine, type InventoryItem } from './inventory-core'
import './inventory-list.css'

export function InventoryList({ title, all, items, chip, q, counts }: { title: string; all: InventoryItem[]; items: InventoryItem[]; chip: string; q: string; counts: Record<string, number> }) {
  const href = (key: string) => `/artworks?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <div className="ha-inv">
      <div className="ha-inv__head">
        <span className="ha-inv__who"><h1 className="ha-inv__title">{title}</h1><span className="ha-inv__summary">{summaryLine(all)}</span></span>
        <Link href="/artworks/new" className="ha-inv__add" aria-label="Adicionar nova obra"><Icon name="add" size={26} /></Link>
      </div>
      <form className="ha-inv__search" role="search" action="/artworks" method="get">
        <input type="hidden" name="filter" value={chip} />
        <Icon name="search" size={20} />
        <input name="q" className="ha-inv__input" defaultValue={q} placeholder="Título, artista ou certificado" aria-label="Buscar no acervo" />
      </form>
      <div className="ha-inv__chips" role="group" aria-label="Filtros">
        {INVENTORY_CHIPS.map((c) => <Chip key={c.key} on={c.key === chip} href={href(c.key)}>{c.name} · {counts[c.key] ?? 0}</Chip>)}
      </div>
      {items.length === 0 ? <div className="ha-inv__empty">{emptyText(q)}</div> : (
        <ul className="ha-inv__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((a) => {
            const st = rowStatus(a)
            return (
              <li key={a.id} className="ha-inv__row">
                <Link href={`/artworks/${a.id}/edit`} className="ha-inv__main">
                  <span className="ha-inv__wall">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                    {a.coverUrl ? <img src={a.coverUrl} alt="" /> : <Icon name="imagesmode" size={24} />}</span>
                  <span className="ha-inv__body">
                    <span className="ha-inv__name">{a.title}</span>
                    <span className="ha-inv__artist">{a.artistName}{a.year ? ` · ${a.year}` : ''}</span>
                    <span className="ha-inv__price-line"><span className="ha-inv__price">{rowPrice(a)}</span><span className={`ha-inv__pill ha-inv__pill--${st.tone}`}>{st.label}</span></span>
                    <span className="ha-inv__stats">{rowStats(a)}</span>
                  </span>
                </Link>
                <span className="ha-inv__aside">
                  {a.status === 'LISTED' ? <Link href={`/artworks/${a.id}/listing`} className="ha-inv__manage"><Icon name="tune" size={16} /><span>Gestão do anúncio</span></Link> : null}
                  <Link href={`/artworks/${a.id}/edit`} className="ha-inv__chev" aria-label={`Abrir ${a.title}`}><Icon name="chevron_right" size={20} /></Link>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

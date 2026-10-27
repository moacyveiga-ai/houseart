// Marketplace público (handoff: HouseArt Marketplace.dc.html). Server Component:
// o estado dos filtros vive na URL — cada opção é um <Link> e a busca e a
// ordenação são um <form method="get"> — e a conta de cada opção sai de
// lib/marketplace/filter-core sobre o conjunto carregado uma vez.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { LanguageMark, type Language } from '@/components/layout/HouseArtLogo'
import { ARTWORK_CATEGORIES, ARTWORK_CATEGORY_LABELS } from '@/lib/artworks/domain'
import {
  countFor, paramsOf, passes, sortItems, toggleIn, EMPTY_SELECTION,
  PRICE_RANGES, SELLER_LABELS, MARKET_LABELS, SIZE_LABELS,
  type GroupKey, type MarketItem, type Selection, type SortKey,
} from '@/lib/marketplace/filter-core'
import { MarketCard, priceLabel, type MarketCardLikeState } from './MarketCard'
import { ArtistCard } from './Artists'
import { MarketplaceSortSelect } from './MarketplaceSortSelect'
import { MarketplaceSearch } from './MarketplaceSearch'
import './marketplace.css'

export interface MarketArtist { slug: string; name: string; meta: string; count: number; photoUrl: string | null }

const LANGUAGE_TILES: { language: Language; category: string; label: string }[] = [
  { language: 'pintura', category: 'PAINTING', label: 'Pintura' },
  { language: 'escultura', category: 'SCULPTURE', label: 'Escultura' },
  { language: 'fotografia', category: 'PHOTOGRAPHY', label: 'Fotografia' },
  { language: 'literatura', category: 'LITERATURE', label: 'Literatura' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rel', label: 'Relevância' }, { key: 'recent', label: 'Mais recentes' }, { key: 'lower', label: 'Menor preço' }, { key: 'higher', label: 'Maior preço' },
]

interface Group { key: GroupKey; title: string; options: { value: string; label: string }[] }

function groupsOf(items: MarketItem[]): Group[] {
  const ufs = [...new Set(items.map((i) => i.uf).filter((u): u is string => !!u))].sort()
  return [
    { key: 'category', title: 'Técnica', options: ARTWORK_CATEGORIES.map((c) => ({ value: c, label: ARTWORK_CATEGORY_LABELS[c] })) },
    { key: 'price', title: 'Preço', options: PRICE_RANGES.map((r) => ({ value: r.key, label: r.label })) },
    { key: 'seller', title: 'Vendedor', options: Object.entries(SELLER_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'market', title: 'Mercado', options: Object.entries(MARKET_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'size', title: 'Tamanho', options: Object.entries(SIZE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'uf', title: 'Estado', options: ufs.map((u) => ({ value: u, label: u })) },
  ]
}

/** The viewer's like state per publicId (numeric id + liked), from the page; absent = anonymous heart. */
export interface MarketReactions { signedIn: boolean; byPublicId: Record<string, { id: number; liked: boolean }> }

export function Marketplace({ items, artists, sel, q, sort, reactions }: { items: MarketItem[]; artists: MarketArtist[]; sel: Selection; q: string; sort: SortKey; reactions?: MarketReactions }) {
  const likeOf = (publicId: string): MarketCardLikeState | undefined => reactions ? { signedIn: reactions.signedIn, id: reactions.byPublicId[publicId]?.id ?? null, liked: reactions.byPublicId[publicId]?.liked ?? false } : undefined
  const href = (s: Selection, query = q, order = sort) => '/e/marketplace' + paramsOf(s, query, order)
  const groups = groupsOf(items)
  const list = sortItems(items.filter((i) => passes(i, sel, q)), sort)
  const chips = groups.flatMap((g) => sel[g.key].map((v) => ({ g: g.key, value: v, label: g.options.find((o) => o.value === v)?.label ?? v })))
  const featured = [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  const hiddenParams = (Object.keys(sel) as GroupKey[]).filter((g) => sel[g].length).map((g) => <input key={g} type="hidden" name={g} value={sel[g].join(',')} />)

  return (
    <>
      <section className="hp-market-hero" aria-labelledby="market-title">
        <div className="hp-market-hero__row">
          <div className="hp-market-hero__text">
            <h1 id="market-title" className="hp-market-hero__title">Marketplace</h1>
            <span className="hp-market-hero__sub">Arte brasileira certificada, de galerias e colecionadores verificados.</span>
          </div>
          <MarketplaceSearch sel={sel} q={q} sort={sort} />
        </div>
      </section>

      <section className="hp-market-langs" aria-label="Linguagens">
        <div className="hp-market-langs__grid">
          {LANGUAGE_TILES.map((t) => {
            const on = sel.category.includes(t.category)
            return (
              <Link key={t.language} href={href(toggleIn(sel, 'category', t.category))} className={`hp-market-lang${on ? ' hp-market-lang--on' : ''}`} aria-label={t.label} aria-pressed={on}>
                <LanguageMark language={t.language} tone={on ? 'color' : 'mono'} height={84} />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="hp-market-catalog" aria-label="Catálogo">
        <aside className="hp-market-filters" aria-label="Filtros">
          <div className="hp-market-filters__head">
            <span className="hp-market-filters__title"><Icon name="tune" size={20} />Filtros</span>
            <Link href={href(EMPTY_SELECTION, '')} className="hp-market-filters__clear">Limpar</Link>
          </div>
          {groups.map((g) => g.options.length ? (
            <div key={g.key} className="hp-market-group">
              <span className="hp-market-group__title">{g.title}</span>
              <div className="hp-market-group__list">
                {g.options.map((o) => {
                  const on = sel[g.key].includes(o.value)
                  return (
                    <Link key={o.value} href={href(toggleIn(sel, g.key, o.value))} className={`hp-market-option${on ? ' hp-market-option--on' : ''}`} aria-pressed={on}>
                      <span className="hp-market-option__box">{on ? <Icon name="check" size={14} /> : null}</span>
                      <span className="hp-market-option__name">{o.label}</span>
                      <span className="hp-market-option__count">{countFor(items, sel, q, g.key, o.value)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null)}
        </aside>

        <div className="hp-market-results">
          <div className="hp-market-toolbar">
            <span className="hp-market-toolbar__count"><b>{list.length}</b> {list.length === 1 ? 'obra certificada' : 'obras certificadas'}</span>
            <form method="get" action="/e/marketplace" className="hp-market-sort">
              {hiddenParams}
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <label htmlFor="market-sort">Ordenar</label>
              <MarketplaceSortSelect name="sort" defaultValue={sort} id="market-sort">
                {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </MarketplaceSortSelect>
            </form>
          </div>
          {chips.length ? (
            <div className="hp-market-chips" aria-label="Filtros ativos">
              {chips.map((c) => (
                <Link key={`${c.g}:${c.value}`} href={href(toggleIn(sel, c.g, c.value))} className="hp-market-chip" aria-label={`Remover filtro ${c.label}`}>{c.label}<Icon name="close" size={16} /></Link>
              ))}
            </div>
          ) : null}
          {list.length ? (
            <div className="hp-market-grid">{list.map((o) => <MarketCard key={o.publicId} item={o} like={likeOf(o.publicId)} />)}</div>
          ) : (
            <div className="hp-market-empty">Nenhuma obra com esses filtros. <Link href={href(EMPTY_SELECTION, '')}>Limpar filtros</Link></div>
          )}
        </div>
      </section>

      {featured.length ? (
        <section className="hp-market-featured" aria-labelledby="featured-title">
          <div className="hp-market-featured__inner">
            <div className="hp-market-featured__head">
              <div className="hp-market-hero__text">
                <span className="hp-market-featured__eyebrow">Seleção da curadoria</span>
                <h2 id="featured-title" className="hp-market-featured__title">Obras em destaque</h2>
              </div>
            </div>
            <div className="hp-market-featured__grid">
              {featured.map((d) => (
                <Link key={d.publicId} href={`/e/artwork/${d.publicId}`} className="hp-market-feat">
                  <span className="hp-market-feat__wall">
                    {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                    {d.cover ? <img src={d.cover} alt={d.title} loading="lazy" /> : null}
                  </span>
                  <span className="hp-market-feat__body">
                    <span className="hp-market-feat__artist">{d.artist}</span>
                    <span className="hp-market-feat__title">{d.title}{d.year ? `, ${d.year}` : ''}</span>
                    <span className="hp-market-feat__foot"><span className="hp-market-feat__seller">{d.seller} · {SELLER_LABELS[d.sellerKind]}</span><span className="hp-market-feat__price">{priceLabel(d.priceCents)}</span></span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {artists.length ? (
        <section className="hp-market-artists" aria-labelledby="market-artists-title">
          <div className="hp-market-artists__head">
            <h2 id="market-artists-title" className="hp-market-artists__title">Artistas</h2>
            <Link href="/e/artists" className="hp-market-artists__all">Ver todos os artistas</Link>
          </div>
          <div className="hp-market-artists__grid">{artists.map((a) => <ArtistCard key={a.slug} artist={a} />)}</div>
        </section>
      ) : null}
    </>
  )
}

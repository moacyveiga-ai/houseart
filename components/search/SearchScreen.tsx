// Busca (handoff "HouseArt App Colecionador" › Busca; no Web Colecionador a mesma
// tela abre como painel à direita — aqui ela ocupa o conteúdo do shell do
// painel). Sem termo: sugestões (categorias em alta, artistas em destaque e a
// porta da etiqueta). Com termo: o certificado encontrado, pessoas e galerias e
// a grade de obras; nada → "Nada encontrado para …". Tudo é link: a busca é a
// do servidor (`search()`), nunca do navegador.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'
import { initialsOf } from '@/lib/profiles/core'
import { formatBRL, ARTWORK_CATEGORIES, ARTWORK_CATEGORY_LABELS } from '@/lib/artworks/domain'
import { looksLikePublicId } from '@/lib/search/core'
import type { SearchResult } from '@/lib/search/server'
import type { PublicArtistCard } from '@/lib/public-content/server'
import { RecentSearches } from './RecentSearches'
import './search.css'

const CATEGORY_CHIPS = ARTWORK_CATEGORIES

/** `workPrefix`: the search URL ending in `work=` — the artwork opens in the side panel over the results. */
export function SearchScreen({ result, featured, workPrefix, before = null }: { result: SearchResult; featured: PublicArtistCard[]; workPrefix: string; before?: ReactNode }) {
  const q = result.q
  const cert = q && looksLikePublicId(q) ? result.artworks[0] ?? null : null
  const works = cert ? result.artworks.slice(1) : result.artworks
  const people = result.artists.length + result.galleries.length
  const nothing = !!q && !cert && !people && !works.length && !before
  return (
    <div className="ha-search">
      <form className="ha-search-box" role="search" action="/search">
        <Icon name="search" size={20} />
        <input name="q" className="ha-search-box__input" defaultValue={q} placeholder="Artista, obra, galeria ou certificado" aria-label="Buscar" autoFocus={!q} />
        {q ? <Link href="/search" className="ha-search-box__clear" aria-label="Limpar"><Icon name="cancel" size={20} /></Link> : null}
      </form>

      <RecentSearches q={q} />

      {!q ? (
        <>
          <section className="ha-search-sec" aria-label="Em alta na HouseArt">
            <span className="ha-search-sec__k">Em alta na HouseArt</span>
            <div className="ha-search-chips">
              {CATEGORY_CHIPS.map((c) => <Link key={c} href={`/e/marketplace?category=${c}`} className="ha-search-chip"><Icon name="trending_up" size={16} />{ARTWORK_CATEGORY_LABELS[c]}</Link>)}
            </div>
          </section>
          {featured.length ? (
            <section className="ha-search-sec" aria-label="Artistas em destaque">
              <span className="ha-search-sec__k">Artistas e galerias</span>
              <div className="ha-search-people">
                {featured.map((a) => (
                  <Link key={a.slug} href={`/e/artist/${a.slug}`} className="ha-search-person">
                    <span className="ha-search-person__av" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                      {a.photoUrl ? <img src={a.photoUrl} alt="" /> : initialsOf(a.name)}
                    </span>
                    <span className="ha-search-person__n">{a.name}</span>
                  </Link>
                ))}
                <Link href="/e/galleries" className="ha-search-person"><span className="ha-search-person__av" aria-hidden="true"><Icon name="storefront" size={26} /></span><span className="ha-search-person__n">Galerias</span></Link>
              </div>
            </section>
          ) : null}
          <Link href="/verify" className="ha-search-tag">
            <Icon name="contactless" size={26} />
            <span className="ha-search-tag__t"><span className="ha-search-tag__n">Encontrar pela etiqueta</span><span className="ha-search-tag__s">Encoste o celular no verso de uma obra ou digite o nº do certificado</span></span>
          </Link>
        </>
      ) : null}

      {before}

      {cert ? (
        <Link href={`${workPrefix}${encodeURIComponent(cert.publicId)}`} scroll={false} className="ha-search-cert">
          <Icon name="verified" size={24} filled />
          <span className="ha-search-cert__t"><span className="ha-search-cert__k">Certificado encontrado</span><span className="ha-search-cert__title">{cert.title} · {cert.artist}</span><span className="ha-search-cert__id">{cert.publicId}</span></span>
          <Icon name="chevron_right" size={20} className="ha-search-cert__arrow" />
        </Link>
      ) : null}

      {people ? (
        <section className="ha-search-sec" aria-label="Pessoas e galerias">
          <span className="ha-search-sec__k">Pessoas e galerias</span>
          <div>
            {result.artists.map((a) => (
              <Link key={`a${a.slug}`} href={`/e/artist/${a.slug}`} className="ha-search-row">
                <span className="ha-search-row__av" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {a.photoUrl ? <img src={a.photoUrl} alt="" /> : initialsOf(a.name)}
                </span>
                <span className="ha-search-row__t"><span className="ha-search-row__n">{a.name}</span><span className="ha-search-row__s">{['Artista', a.meta || null, `${a.count} ${a.count === 1 ? 'obra à venda' : 'obras à venda'}`].filter(Boolean).join(' · ')}</span></span>
                <Icon name="chevron_right" size={20} className="ha-search-row__arrow" />
              </Link>
            ))}
            {result.galleries.map((g) => (
              <Link key={`g${g.slug}`} href={`/e/gallery/${g.slug}`} className="ha-search-row">
                <span className="ha-search-row__av ha-search-row__av--gallery" aria-hidden="true">{initialsOf(g.name)}</span>
                <span className="ha-search-row__t"><span className="ha-search-row__n">{g.name}</span><span className="ha-search-row__s">{['Galeria', [g.city, g.uf].filter(Boolean).join('/'), `${g.works} ${g.works === 1 ? 'obra' : 'obras'}`].filter(Boolean).join(' · ')}</span></span>
                <Icon name="chevron_right" size={20} className="ha-search-row__arrow" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {works.length ? (
        <section className="ha-search-sec" aria-label="Obras">
          <span className="ha-search-sec__k">{works.length} {works.length === 1 ? 'obra' : 'obras'}</span>
          <div className="ha-search-works">
            {works.map((o) => (
              <Link key={o.publicId} href={`${workPrefix}${encodeURIComponent(o.publicId)}`} scroll={false} className="ha-search-work">
                <span className="ha-search-work__wall">
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {o.cover ? <img src={o.cover} alt={o.title} loading="lazy" /> : null}
                </span>
                <span className="ha-search-work__artist">{o.artist}</span>
                <span className="ha-search-work__title">{o.title}{o.year ? <em>, {o.year}</em> : null}</span>
                <span className="ha-search-work__price">{o.priceCents === null ? 'Sob consulta' : formatBRL(o.priceCents)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {nothing ? (
        <div className="ha-search-empty" role="status">
          <span className="ha-search-empty__t">Nada encontrado para “{q}”.</span>
          <span className="ha-search-empty__s">Tente o nome do artista, o título da obra ou o número do certificado (HA-AAAA-XXXX-XXXX).</span>
        </div>
      ) : null}
    </div>
  )
}

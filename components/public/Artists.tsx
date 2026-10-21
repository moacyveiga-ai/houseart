// Lista pública de artistas (/e/artists). Não há protótipo próprio: o molde é
// a seção "Artistas" do HouseArt Marketplace (grade de cards com foto ou
// iniciais, nome, meta e "N obras à venda") sobre a busca por nome (?q=).
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { initialsOf } from '@/lib/profiles/core'
import type { PublicArtistCard } from '@/lib/public-content/server'
import './artists.css'

export function ArtistCard({ artist: a }: { artist: PublicArtistCard }) {
  return (
    <Link href={`/e/artist/${a.slug}`} className="hp-artists-card">
      <span className="hp-artists-card__photo" aria-hidden={a.photoUrl ? undefined : true}>
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {a.photoUrl ? <img src={a.photoUrl} alt={`Foto de ${a.name}`} loading="lazy" /> : initialsOf(a.name)}
      </span>
      <span className="hp-artists-card__body">
        <span className="hp-artists-card__name">{a.name}</span>
        {a.meta ? <span className="hp-artists-card__meta">{a.meta}</span> : null}
        <span className="hp-artists-card__count">{a.count} {a.count === 1 ? 'obra à venda' : 'obras à venda'}</span>
      </span>
    </Link>
  )
}

export function Artists({ artists, q }: { artists: PublicArtistCard[]; q: string }) {
  return (
    <>
      <section className="hp-artists-hero" aria-labelledby="artists-title">
        <div className="hp-artists-hero__row">
          <div className="hp-artists-hero__text">
            <h1 id="artists-title" className="hp-artists-hero__title">Artistas</h1>
            <span className="hp-artists-hero__sub">Artistas com obras certificadas à venda, de galerias e colecionadores verificados.</span>
          </div>
          <form method="get" action="/e/artists" className="hp-artists-search" role="search">
            <Icon name="search" size={22} />
            <input name="q" defaultValue={q} placeholder="Buscar artista pelo nome" aria-label="Buscar artista" className="hp-artists-search__input" />
          </form>
        </div>
      </section>
      <section className="hp-artists-list" aria-label="Lista de artistas">
        <span className="hp-artists-list__count"><b>{artists.length}</b> {artists.length === 1 ? 'artista' : 'artistas'}{q ? <> para “{q}”</> : null}</span>
        {artists.length ? (
          <div className="hp-artists-grid">{artists.map((a) => <ArtistCard key={a.slug} artist={a} />)}</div>
        ) : (
          <div className="hp-artists-empty">{q ? <>Nenhum artista com esse nome. <Link href="/e/artists">Limpar busca</Link></> : 'Ainda não há artistas com obras à venda.'}</div>
        )}
      </section>
    </>
  )
}

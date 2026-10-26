// The public Home of the handoff (HouseArt Home.dc.html), section by section:
// Abertura · Manifesto · Destaque Marketplace · Linguagens · Pilares · Notícias
// · Agenda · Chamada final. The header and the footer come from app/e/layout.tsx.
// Everything is a Server Component; motion (HomeMotion) and the agenda filters
// (HomeAgenda) are the only islands.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { LanguageMark, type Language } from '@/components/layout/HouseArtLogo'
import { HomeAgenda, type HomeAgendaEvent } from './HomeAgenda'
import { HomeMotion } from './HomeMotion'
import type { MonthTab } from '@/lib/public-content/home-core'
import './home.css'

/** A listed work, already serialisable (price formatted on the server). */
export interface HomeWork { publicId: string; title: string; artist: string; seller: string; price: string; cover: string | null }
export interface HomeNews { slug: string; category: string; title: string; summary: string | null; imageUrl: string | null; date: string }

export interface HomeData {
  works: HomeWork[]
  news: { featured: HomeNews | null; others: HomeNews[] }
  agenda: { tabs: MonthTab[]; events: HomeAgendaEvent[]; savedIds?: number[]; signedIn?: boolean }
}

const LANGUAGES: { language: Language; label: string; category: string }[] = [
  { language: 'pintura', label: 'Pintura', category: 'PAINTING' },
  { language: 'escultura', label: 'Escultura', category: 'SCULPTURE' },
  { language: 'fotografia', label: 'Fotografia', category: 'PHOTOGRAPHY' },
  { language: 'literatura', label: 'Literatura', category: 'WORK_ON_PAPER' },
]

const PILLARS = [
  { n: '01', title: 'Certifique', text: 'Etiqueta física com chip, número único e certificado assinado pelo artista ou pela galeria.', cta: 'Como funciona', href: '/e/how-it-works' },
  { n: '02', title: 'Compre e venda', text: 'Pagamento em garantia, frete especializado e seguro na mesma compra, com o vendedor sempre identificado.', cta: 'Ir ao marketplace', href: '/e/marketplace' },
  { n: '03', title: 'Proteja', text: 'Escritura, laudo de valor e histórico de donos acessíveis por qualquer pessoa em segundos.', cta: 'Verificar uma obra', href: '/verify' },
]

function Cover({ work, className = '' }: { work: HomeWork | undefined; className?: string }) {
  if (!work?.cover) return null
  // eslint-disable-next-line @next/next/no-img-element -- derivada pública
  return <img src={work.cover} alt="" className={className} />
}

/** The n-th work, cycling when there are fewer than needed (and nothing when there are none). */
const pick = (works: HomeWork[], i: number): HomeWork | undefined => (works.length ? works[i % works.length] : undefined)

export function Home({ works, news, agenda }: HomeData) {
  const hero = pick(works, 0)
  const featured = works.slice(0, 4)
  const hasNews = news.featured !== null
  return (
    <div className="hp-home" data-home-motion>
      <HomeMotion />

      <section id="topo" className="hp-home-hero" aria-label="Abertura">
        <div className="hp-home-hero__bg" data-speed="0.35">
          <div className="hp-home-hero__photo" data-zoom="1">{hero?.cover ? <Cover work={hero} className="hp-home-hero__img" /> : null}</div>
        </div>
        <div className="hp-home-hero__scrim" />
        <div className="hp-home-hero__content" data-speed="0.5" data-out="1">
          <span className="hp-home-hero__eyebrow">Arte brasileira com origem</span>
          <h1 className="hp-home-hero__title">Toda obra tem<br /><i>uma história.</i></h1>
          <p className="hp-home-hero__lead">A HouseArt registra a de cada uma, do ateliê à parede de quem coleciona.</p>
          <div className="hp-home-hero__actions">
            <Link href="/e/how-it-works" className="hp-btn-sand">Como funciona<Icon name="arrow_forward" size={20} /></Link>
            <Link href="/e/marketplace" className="hp-btn-paper">Explorar obras</Link>
          </div>
        </div>
        <span className="hp-home-hero__caption"><i>Foto ilustrativa</i></span>
      </section>

      <section id="manifesto" className="hp-home-manifesto" aria-label="Manifesto">
        {pick(works, 1)?.cover ? <div className="hp-home-float hp-home-manifesto__float-a" data-speed="0.3"><Cover work={pick(works, 1)} /></div> : null}
        {pick(works, 2)?.cover ? <div className="hp-home-float hp-home-manifesto__float-b" data-speed="-0.35"><Cover work={pick(works, 2)} /></div> : null}
        <div className="hp-home-manifesto__inner">
          <p className="hp-home-manifesto__line" data-fade="1">O artista certifica.</p>
          <p className="hp-home-manifesto__line" data-fade="1">A galeria apresenta.</p>
          <p className="hp-home-manifesto__line" data-fade="1">O colecionador recebe a obra <i>e a escritura.</i></p>
          <p className="hp-home-manifesto__lead" data-fade="1">Cada revenda volta a pagar quem criou. Cada dono fica registrado. Nenhuma obra perde o próprio nome.</p>
        </div>
      </section>

      <section className="hp-home-market" aria-label="Destaque do marketplace">
        <div className="hp-container hp-home-market__top">
          <div className="hp-home-market__copy">
            <span className="hp-eyebrow">Em destaque</span>
            <h2 className="hp-home-market__title">O marketplace<br /><i>da arte certificada.</i></h2>
            <p className="hp-home-market__lead">Obras de galerias e colecionadores verificados, com procedência, frete e seguro resolvidos na compra.</p>
            <div className="hp-home-market__actions">
              <Link href="/e/marketplace" className="hp-btn-sand">Explorar o marketplace<Icon name="arrow_forward" size={20} /></Link>
              <Link href="/e/galleries" className="hp-btn-paper">Ver galerias</Link>
            </div>
          </div>
          <div className="hp-home-market__stage">
            {pick(works, 0)?.cover ? <Link href={`/e/artwork/${pick(works, 0)!.publicId}`} className="hp-home-float hp-home-market__float-a" data-speed="-0.15" aria-label={pick(works, 0)!.title}><Cover work={pick(works, 0)} /></Link> : null}
            {pick(works, 2)?.cover ? <Link href={`/e/artwork/${pick(works, 2)!.publicId}`} className="hp-home-float hp-home-market__float-b" data-speed="-0.45" aria-label={pick(works, 2)!.title}><Cover work={pick(works, 2)} /></Link> : null}
            {pick(works, 3)?.cover ? <Link href={`/e/artwork/${pick(works, 3)!.publicId}`} className="hp-home-float hp-home-market__float-c" data-speed="-0.7" aria-label={pick(works, 3)!.title}><Cover work={pick(works, 3)} /></Link> : null}
          </div>
        </div>
        {featured.length ? (
          <div className="hp-container hp-home-market__cards">
            {featured.map((w) => (
              <Link key={w.publicId} href={`/e/artwork/${w.publicId}`} className="hp-home-card">
                <div className="hp-home-card__wall"><Cover work={w} /></div>
                <span className="hp-home-card__artist">{w.artist}</span>
                <span className="hp-home-card__title">{w.title}</span>
                <span className="hp-home-card__meta">{w.seller} · <span className="hp-home-card__price">{w.price}</span></span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="hp-home-languages" aria-label="Linguagens">
        <div className="hp-container hp-home-languages__inner">
          <h2 className="hp-section-title">Explore por linguagem</h2>
          <div className="hp-home-languages__grid">
            {LANGUAGES.map((l) => (
              <Link key={l.language} href={`/e/marketplace?category=${l.category}`} className="hp-home-language">
                <div className="hp-home-language__tile"><LanguageMark language={l.language} tone="color" height={240} /></div>
                <div className="hp-home-language__row"><span className="hp-home-language__name">{l.label}</span><span className="hp-home-language__go">Ver obras →</span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-home-pillars" aria-label="Pilares">
        {PILLARS.map((p, i) => {
          const work = pick(works, 4 + i)
          return (
            <div key={p.n} className="hp-home-pillar">
              <div className="hp-container hp-home-pillar__inner">
                <div className={`hp-home-pillar__copy${i % 2 ? ' hp-home-pillar__copy--after' : ''}`} data-fade="1">
                  <span className="hp-home-pillar__n">{p.n}</span>
                  <h3 className="hp-home-pillar__title">{p.title}</h3>
                  <p className="hp-home-pillar__text">{p.text}</p>
                  <Link href={p.href} className="hp-home-pillar__cta">{p.cta}<Icon name="arrow_forward" size={20} /></Link>
                </div>
                <div className="hp-home-pillar__wall">
                  <div className="hp-home-pillar__art" data-speed="0.18"><Cover work={work} /></div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {hasNews ? (
        <section id="noticias" className="hp-container hp-home-news" aria-label="Notícias">
          <div className="hp-home-news__head">
            <h2 className="hp-section-title">Notícias do mundo da arte</h2>
            <Link href="/e/news" className="hp-home-news__all">Todas as notícias</Link>
          </div>
          <div className="hp-home-news__grid">
            <Link href={`/e/news/${news.featured!.slug}`} className="hp-home-news__featured">
              <div className="hp-home-news__cover">{news.featured!.imageUrl ? <NewsImage src={news.featured!.imageUrl} /> : null}</div>
              <span className="hp-home-news__cat">{news.featured!.category} · {news.featured!.date}</span>
              <span className="hp-home-news__headline">{news.featured!.title}</span>
              {news.featured!.summary ? <span className="hp-home-news__summary">{news.featured!.summary}</span> : null}
            </Link>
            {news.others.length ? (
              <div className="hp-home-news__list">
                {news.others.map((n) => (
                  <Link key={n.slug} href={`/e/news/${n.slug}`} className="hp-home-news__item">
                    <div className="hp-home-news__item-body">
                      <span className="hp-home-news__cat">{n.category} · {n.date}</span>
                      <span className="hp-home-news__item-title">{n.title}</span>
                    </div>
                    <div className="hp-home-news__thumb">{n.imageUrl ? <NewsImage src={n.imageUrl} /> : null}</div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <HomeAgenda tabs={agenda.tabs} events={agenda.events} savedIds={agenda.savedIds ?? []} signedIn={agenda.signedIn ?? false} />

      <section className="hp-home-final" aria-label="Chamada final">
        {pick(works, 5)?.cover ? <div className="hp-home-float hp-home-final__float-a" data-speed="-0.3"><Cover work={pick(works, 5)} /></div> : null}
        {pick(works, 6)?.cover ? <div className="hp-home-float hp-home-final__float-b" data-speed="-0.6"><Cover work={pick(works, 6)} /></div> : null}
        <div className="hp-home-final__inner">
          <h2 className="hp-home-final__title">Dê nome, data e dono <i>à sua obra.</i></h2>
          <div className="hp-home-final__actions">
            <Link href="/signup" className="hp-btn-sand">Criar conta grátis</Link>
            <Link href="/verify" className="hp-btn-paper">Verificar uma obra</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function NewsImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- derivada pública
  return <img src={src} alt="" className="hp-home-news__img" />
}

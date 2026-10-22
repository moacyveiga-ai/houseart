import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { GUIDE } from '@/components/public/guide-content'
import { listNews } from '@/lib/public-content/server'
import { newsDateLabel } from '@/lib/public-content/home-core'
import '@/components/public/news.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notícias — HouseArt', description: 'Mercado, feiras, museus, direito e artistas: as notícias da arte brasileira na HouseArt.' }

// Lista de notícias (sem protótipo próprio: o bloco "Notícias" da Home, inteiro) + a porta do guia.
export default async function NewsListPage() {
  const { featured, others } = await listNews(30)
  return (
    <section className="hp-container hp-news" aria-labelledby="news-title">
      <div className="hp-news__head">
        <span className="hp-eyebrow">Notícias</span>
        <h1 id="news-title" className="hp-section-title">O que está acontecendo na arte</h1>
        <p className="hp-news__sub">Mercado, feiras, museus, direito e artistas — e os guias da HouseArt para comprar com segurança.</p>
      </div>
      <Link href="/e/guide" className="hp-news__guide"><Icon name="school" size={26} /><span className="hp-news__guide-t"><span className="hp-news__guide-k">{GUIDE.kicker}</span><span className="hp-news__guide-n">{GUIDE.title}</span></span><Icon name="arrow_forward" size={22} /></Link>
      {featured ? (
        <div className="hp-news__grid">
          <Link href={`/e/news/${featured.slug}`} className="hp-news__featured">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem da notícia */}
            <span className="hp-news__cover">{featured.imageUrl ? <img src={featured.imageUrl} alt="" /> : null}</span>
            <span className="hp-news__cat">{featured.category} · {newsDateLabel(featured.publishedAt)}</span>
            <span className="hp-news__headline">{featured.title}</span>
            {featured.summary ? <span className="hp-news__summary">{featured.summary}</span> : null}
            <span className="hp-news__read">Ler<Icon name="arrow_forward" size={18} /></span>
          </Link>
          {others.length ? (
            <div className="hp-news__list">
              {others.map((n) => (
                <Link key={n.slug} href={`/e/news/${n.slug}`} className="hp-news__item">
                  <span className="hp-news__item-body"><span className="hp-news__cat">{n.category} · {newsDateLabel(n.publishedAt)}</span><span className="hp-news__item-title">{n.title}</span></span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem da notícia */}
                  <span className="hp-news__thumb">{n.imageUrl ? <img src={n.imageUrl} alt="" /> : null}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : <div className="hp-empty">Ainda não há notícias publicadas.</div>}
    </section>
  )
}

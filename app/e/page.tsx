// Public Home (/e) of the handoff: loads the listed works, the news and the
// agenda of the next four months and hands serialisable data to the page.
import type { Metadata } from 'next'
import { Home, type HomeWork } from '@/components/public/Home'
import { marketItems } from '@/lib/marketplace/public-server'
import { homeHeroPhoto, listAgenda, listNews } from '@/lib/public-content/server'
import { heroCaption, monthKeyOf, monthTabs, newsDateLabel } from '@/lib/public-content/home-core'
import { formatBRL } from '@/lib/artworks/domain'
import { getSession } from '@/lib/auth'
import { reactedIds } from '@/lib/community/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HouseArt — A escritura da obra de arte',
  description: 'O artista certifica. A galeria apresenta. O colecionador recebe a obra e a escritura. Cada revenda volta a pagar quem criou, cada dono fica registrado e nenhuma obra perde o próprio nome.',
}

export default async function PublicHomePage() {
  const fromMonth = monthKeyOf(new Date())
  const [items, news, agenda, user, heroPhoto] = await Promise.all([marketItems(12), listNews(5), listAgenda(fromMonth, 4), getSession(), homeHeroPhoto()])
  const saved = await reactedIds(user?.id ?? null, 'EVENT', 'SAVE', agenda.map((e) => e.id))
  const works: HomeWork[] = items.filter((i) => i.cover).map((i) => ({ publicId: i.publicId, title: i.title, artist: i.artist, seller: i.seller, price: i.priceCents === null ? 'Sob consulta' : formatBRL(i.priceCents), cover: i.cover }))
  const card = (n: NonNullable<typeof news.featured>) => ({ slug: n.slug, category: n.category, title: n.title, summary: n.summary, imageUrl: n.imageUrl, date: newsDateLabel(n.publishedAt) })
  return (
    <Home
      works={works}
      hero={heroPhoto ? { url: heroPhoto.url, caption: heroCaption(heroPhoto)! } : null}
      news={{ featured: news.featured ? card(news.featured) : null, others: news.others.map(card) }}
      agenda={{ tabs: monthTabs(fromMonth, 4), events: agenda.map((e) => ({ id: e.id, kind: e.kind, title: e.title, venue: e.venue, city: e.city, startsOn: e.startsOn, period: e.period })), savedIds: [...saved], signedIn: !!user }}
    />
  )
}

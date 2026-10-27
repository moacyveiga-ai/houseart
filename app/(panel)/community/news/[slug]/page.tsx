import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { Reader, type ReaderSocial } from '@/components/public/Reader'
import { paragraphBlocks, readMinutesLabel } from '@/components/public/reading-core'
import { newsArticle } from '@/lib/public-content/server'
import { newsDateLabel } from '@/lib/public-content/home-core'
import { newsSignals, type FeedItem } from '@/lib/community/server'
import { initialsOf } from '@/lib/profiles/core'
import '@/components/community/community.css'
import '@/components/public/news.css'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }
const SLUG = /^[a-z0-9-]{1,120}$/

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const n = SLUG.test(slug) ? await newsArticle(slug) : null
  return { title: n ? `${n.title} — Comunidade — HouseArt` : 'Notícia — HouseArt' }
}

// Ler notícia dentro do painel (auditoria colecionador §7): o mesmo leitor do site público, com a
// barra lateral, voltando à Comunidade; o compartilhar segue apontando para a página pública.
export default async function PanelNewsPage({ params }: Params) {
  const { slug } = await params
  const { user } = await requirePanelPage(`/community/news/${SLUG.test(slug) ? slug : ''}`)
  if (!SLUG.test(slug)) notFound()
  const n = await newsArticle(slug)
  if (!n) notFound()
  const sig = await newsSignals(user.id, n.id).catch(() => ({ likes: 0, liked: false, saved: false, comments: 0 }))
  const item: FeedItem = {
    key: `N${n.id}`, kind: 'NEWS', id: n.id, author: { name: 'HouseArt', initials: 'HA', sub: 'Redação', memberId: null, memberSlug: null, following: false }, when: '', body: n.summary ?? '', imageUrl: n.imageUrl, artwork: null,
    title: n.title, summary: n.summary, format: n.category, href: `/e/news/${n.slug}`, likes: sig.likes, liked: sig.liked, saved: sig.saved, comments: sig.comments, canComment: true,
  }
  const social: ReaderSocial = { id: n.id, likes: sig.likes, liked: sig.liked, saved: sig.saved, comments: sig.comments, feedItem: item }
  return (
    <Reader
      kicker={n.category} title={n.title} lead={n.summary} author="Redação HouseArt" meta={`${newsDateLabel(n.publishedAt)} · ${readMinutesLabel(n.readMinutes)}`}
      imageUrl={n.imageUrl} blocks={paragraphBlocks(n.body)} source={n.sourceName ? { name: n.sourceName, url: n.sourceUrl } : null}
      trail={null} next={null} related={n.related.map((r) => ({ kicker: r.category, title: r.title, href: `/community/news/${r.slug}` }))}
      backHref="/community" sharePath={`/e/news/${n.slug}`} social={social} viewer={{ signedIn: true, initials: initialsOf(user.name) }}
    />
  )
}

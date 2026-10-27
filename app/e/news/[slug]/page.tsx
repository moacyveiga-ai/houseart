import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Reader, type ReaderSocial } from '@/components/public/Reader'
import { paragraphBlocks, readMinutesLabel } from '@/components/public/reading-core'
import { newsArticle } from '@/lib/public-content/server'
import { newsDateLabel } from '@/lib/public-content/home-core'
import { newsSignals, type FeedItem } from '@/lib/community/server'
import { getSession } from '@/lib/auth'
import { initialsOf } from '@/lib/profiles/core'
import '@/components/community/community.css'
import '@/components/public/news.css'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }
const SLUG = /^[a-z0-9-]{1,120}$/

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const n = SLUG.test(slug) ? await newsArticle(slug) : null
  if (!n) return { title: 'Notícia — HouseArt' }
  const title = `${n.title} — HouseArt`
  return { title, description: n.summary ?? undefined, openGraph: { title, description: n.summary ?? undefined, type: 'article', publishedTime: n.publishedAt.toISOString(), ...(n.imageUrl ? { images: [{ url: n.imageUrl }] } : {}) } }
}

/** The article's reactions and comment count, with the feed item shape the reader expects. */
async function socialOf(viewer: number | null, n: { id: number; slug: string; title: string; summary: string | null; imageUrl: string | null; category: string; publishedAt: Date }): Promise<ReaderSocial> {
  const sig = await newsSignals(viewer, n.id).catch(() => ({ likes: 0, liked: false, saved: false, comments: 0 }))
  const item: FeedItem = {
    key: `N${n.id}`, kind: 'NEWS', id: n.id, author: { name: 'HouseArt', initials: 'HA', sub: 'Redação', memberId: null, memberSlug: null, following: false }, when: '', body: n.summary ?? '', imageUrl: n.imageUrl, artwork: null,
    title: n.title, summary: n.summary, format: n.category, href: `/e/news/${n.slug}`, likes: sig.likes, liked: sig.liked, saved: sig.saved, comments: sig.comments, canComment: true,
  }
  return { id: n.id, likes: sig.likes, liked: sig.liked, saved: sig.saved, comments: sig.comments, feedItem: item }
}

// Ler notícia (handoff "HouseArt App Colecionador" › Ler notícia) no site público.
export default async function NewsArticlePage({ params }: Params) {
  const { slug } = await params
  if (!SLUG.test(slug)) notFound()
  const n = await newsArticle(slug)
  if (!n) notFound()
  const session = await getSession()
  const social = await socialOf(session?.id ?? null, n)
  return (
    <Reader
      kicker={n.category} title={n.title} lead={n.summary} author="Redação HouseArt" meta={`${newsDateLabel(n.publishedAt)} · ${readMinutesLabel(n.readMinutes)}`}
      imageUrl={n.imageUrl} blocks={paragraphBlocks(n.body)} source={n.sourceName ? { name: n.sourceName, url: n.sourceUrl } : null}
      trail={null} next={null} related={n.related.map((r) => ({ kicker: r.category, title: r.title, href: `/e/news/${r.slug}` }))}
      backHref="/e/news" sharePath={`/e/news/${n.slug}`} social={social} viewer={{ signedIn: !!session, initials: session ? initialsOf(session.name) : '', avatarUrl: session?.avatarUrl ?? null }}
    />
  )
}

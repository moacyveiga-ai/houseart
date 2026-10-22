import type { Metadata } from 'next'
import { Reader } from '@/components/public/Reader'
import { GUIDE } from '@/components/public/guide-content'
import { readMinutesLabel } from '@/components/public/reading-core'
import { listNews } from '@/lib/public-content/server'
import { getSession } from '@/lib/auth'
import { initialsOf } from '@/lib/profiles/core'
import '@/components/public/news.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `${GUIDE.title} — Guia — HouseArt`, description: GUIDE.lead }

// Guia de educação (handoff "HouseArt App Colecionador" › Guia de educação) no site público.
export default async function GuidePage() {
  const [news, session] = await Promise.all([listNews(3), getSession()])
  const related = [news.featured, ...news.others].filter((n): n is NonNullable<typeof n> => !!n).slice(0, 2).map((n) => ({ kicker: n.category, title: n.title, href: `/e/news/${n.slug}` }))
  return (
    <Reader
      kicker={GUIDE.kicker} title={GUIDE.title} lead={GUIDE.lead} author={GUIDE.author} meta={`Guia · ${readMinutesLabel(GUIDE.readMinutes)}`}
      imageUrl={null} blocks={GUIDE.blocks} source={null} trail={GUIDE.trail} next={{ title: GUIDE.next, href: null }} related={related}
      backHref="/e/news" sharePath="/e/guide" social={null} viewer={{ signedIn: !!session, initials: session ? initialsOf(session.name) : '' }}
    />
  )
}

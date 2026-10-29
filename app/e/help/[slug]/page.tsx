import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Reader } from '@/components/public/Reader'
import { HELP_ARTICLES, helpArticle } from '@/components/public/help-content'
import { readMinutesLabel } from '@/components/public/reading-core'
import { getSession } from '@/lib/auth'
import { initialsOf } from '@/lib/profiles/core'
import '@/components/public/news.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = helpArticle((await params).slug)
  return a ? { title: `${a.title} — Ajuda — HouseArt`, description: a.lead } : { title: 'Ajuda — HouseArt' }
}

// One article of the Central de Ajuda, in the reader of the news and the guide (no reactions, no comments).
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpArticle((await params).slug)
  if (!a) notFound()
  const session = await getSession()
  const support = process.env.SUPPORT_EMAIL?.trim()
  const related = HELP_ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 2).map((x) => ({ kicker: 'Ajuda', title: x.title, href: `/e/help/${x.slug}` }))
  return (
    <Reader
      kicker="Ajuda" title={a.title} lead={a.lead} author="Equipe HouseArt" meta={readMinutesLabel(a.readMinutes)}
      imageUrl={null} blocks={a.blocks} source={null} trail={null}
      next={{ kicker: 'Ainda com dúvida?', title: 'Fale com a HouseArt', href: support ? `mailto:${support}?subject=${encodeURIComponent(`Ajuda — ${a.title}`)}` : '/e/how-it-works#suporte' }}
      related={related} backHref="/e/help" sharePath={`/e/help/${a.slug}`} social={null}
      viewer={{ signedIn: !!session, initials: session ? initialsOf(session.name) : '' }}
    />
  )
}

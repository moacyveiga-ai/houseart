import Link from 'next/link'
import { requirePanelPage } from './_session'
import { dashboardCounts } from '@/lib/dashboard/server'
import { dateLabel, greetingFor, kpisFor, nextActionsFor } from '@/lib/dashboard/core'
import { listArtworks } from '@/lib/artworks/server'
import { ARTWORK_STATUS_LABELS } from '@/lib/artworks/domain'
import { Kpis } from '@/components/ds/Kpi'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'
import { homeOf } from '@/lib/profiles/nav'
import { redirect } from 'next/navigation'
import { dayPanel } from '@/lib/gallery/panel-server'
import { listingsOf, reactionCountsOf } from '@/lib/gallery/listing-server'
import { initialsOf } from '@/lib/profiles/core'
import { DayPanel, type TopViewed } from '@/components/gallery/DayPanel'

export const metadata = { title: 'Início — HouseArt' }

/** "Galeria · painel do dia": the panel of the gallery (and of the advisor, the same desk). */
async function GalleryDay({ scope, userId, userName, now }: { scope: Parameters<typeof dayPanel>[0]; userId: number; userName: string; now: Date }) {
  const [data, listed] = await Promise.all([dayPanel(scope, now, userId), listArtworks(scope, { filter: 'listed' })])
  const ls = listed.items.filter((a) => a.status === 'LISTED')
  const [stats, reactions] = await Promise.all([listingsOf(scope, ls.map((a) => a.id), now), reactionCountsOf(ls.map((a) => a.id))])
  const top: TopViewed[] = []
  ls.forEach((a) => { const l = stats.get(a.id); if (l && l.stats.views7d > 0) top.push({ id: a.id, title: a.title, coverUrl: a.coverUrl, views7d: l.stats.views7d, openOffers: l.stats.openOffers, ...(reactions.get(a.id) ?? { likes: 0, saves: 0 }) }) })
  top.sort((x, y) => y.views7d - x.views7d)
  return <DayPanel data={data} who={{ initials: initialsOf(userName), name: userName, dateLabel: dateLabel(now) }} top={top.slice(0, 3)} />
}

export default async function DashboardPage() {
  const { user, scope, nav } = await requirePanelPage('/')
  // the house team opens on its review queue (audit 2026-10-25), never on a gallery dashboard
  if (nav !== 'artist' && nav !== 'gallery' && nav !== 'advisor') redirect(homeOf(nav))
  const now = new Date()
  if (nav === 'gallery' || nav === 'advisor') return <GalleryDay scope={scope} userId={user.id} userName={user.name} now={now} />
  const [counts, recent] = await Promise.all([dashboardCounts(scope, now), listArtworks(scope, { take: 6 })])
  const profile = nav === 'artist' ? 'artist' : 'gallery'
  const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/Bahia' }).format(now))
  const actions = nextActionsFor(counts)
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <div>
          <div className="ha-eyebrow">{dateLabel(now)}</div>
          <h1 className="ha-h1">{greetingFor(user.name, now)}</h1>
        </div>
        <div className="ha-row" style={{ gap: 'var(--ha-space-3)' }}>
          {nav === 'artist' ? <Link href="/profile/public" className="ha-btn ha-btn--outline ha-btn--md"><Icon name="badge" size={18} />Perfil público</Link> : null}
          <Link href="/artworks/new" className="ha-btn ha-btn--primary ha-btn--md"><Icon name="add" size={18} />Nova obra</Link>
        </div>
      </div>
      <Kpis items={kpisFor(profile, counts, year)} />
      <div className="ha-split">
        <section className="ha-card ha-card--pad">
          <h2 className="ha-h3">Próximas ações</h2>
          {actions.length === 0 ? <p className="ha-muted">Nada pendente por agora.</p> : (
            <ul className="ha-list">
              {actions.map((a) => (
                <li key={a.title}><Link href={a.href} className="ha-list__row"><Icon name={a.icon} size={20} /><span><b>{a.title}</b><br /><span className="ha-muted ha-sm">{a.subtitle}</span></span><Icon name="chevron_right" size={18} /></Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="ha-card ha-card--pad">
          <div className="ha-row"><h2 className="ha-h3">Obras recentes</h2><Link href="/artworks" className="ha-link">Ver todas</Link></div>
          {recent.items.length === 0 ? <p className="ha-muted">Cadastre a primeira obra para começar.</p> : (
            <ul className="ha-list">
              {recent.items.map((a) => (
                <li key={a.id}><Link href={`/artworks/${a.id}/edit`} className="ha-list__row">
                  <span className="ha-wall ha-wall--40">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                  {a.coverUrl ? <img src={a.coverUrl} alt="" /> : null}</span>
                  <span><b>{a.title}{a.year ? `, ${a.year}` : ''}</b><br /><span className="ha-muted ha-sm">{a.artistName}</span></span>
                  <Badge tone={a.status === 'AUTHENTICATED' || a.status === 'LISTED' ? 'verified' : a.status === 'IN_CERTIFICATION' ? 'pending' : 'neutral'}>{ARTWORK_STATUS_LABELS[a.status]}</Badge>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

import { requirePanelPage } from '../_session'
import { feed } from '@/lib/community/server'
import { listArtworks } from '@/lib/artworks/server'
import { heldArtworks } from '@/lib/ownership/server'
import { initialsOf } from '@/lib/profiles/core'
import { CommunityScreen } from '@/components/community/CommunityScreen'
import { COMMUNITY_TABS, filterTab, tabOf } from '@/components/community/community-core'
import type { ComposerArtwork } from '@/components/community/Composer'
import '@/components/community/community.css'

export const metadata = { title: 'Comunidade — HouseArt' }

/** The artworks the person can tag in a post: the member's listed/authenticated ones, or the collector's held deeds. */
async function taggable(user: { id: number; memberId: number | null }, scope: Parameters<typeof listArtworks>[0]): Promise<ComposerArtwork[]> {
  try {
    if (user.memberId) {
      const [listed, authenticated] = await Promise.all([listArtworks(scope, { filter: 'listed', take: 30 }), listArtworks(scope, { filter: 'authenticated', take: 30 })])
      const seen = new Set<number>()
      return [...listed.items, ...authenticated.items].filter((a) => a.publicId && !seen.has(a.id) && seen.add(a.id)).slice(0, 30).map((a) => ({ id: a.id, title: a.title, coverUrl: a.coverUrl }))
    }
    const held = await heldArtworks(user.id)
    return held.map((v) => v.certificate.artwork).filter((a) => a.publicId).slice(0, 30).map((a) => ({ id: a.id, title: a.title, coverUrl: a.media[0]?.publicUrl ?? null }))
  } catch { return [] }
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, scope, nav } = await requirePanelPage('/community')
  const tab = tabOf((await searchParams).tab)
  const api = COMMUNITY_TABS.find((t) => t.key === tab)!.api
  const [items, artworks] = await Promise.all([feed(user.id, { tab: api }), taggable(user, scope)])
  const compose = nav === 'gallery' || nav === 'advisor' ? 'Publique uma obra, abertura ou novidade…' : nav === 'artist' ? 'Mostre o ateliê, uma obra nova ou uma abertura…' : 'Mostre uma obra da sua coleção…'
  return (
    <div className="ha-page">
      <CommunityScreen key={tab} items={filterTab(items, tab)} tab={tab} me={{ initials: initialsOf(user.name), name: user.name, memberId: user.memberId }} artworks={artworks} compose={compose} />
    </div>
  )
}

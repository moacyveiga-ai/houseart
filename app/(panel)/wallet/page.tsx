import { requirePanelPage } from '../_session'
import { walletOf } from '@/lib/collector-wallet/server'
import { heldArtworks } from '@/lib/ownership/server'
import { WalletScreen } from '@/components/wallet/WalletScreen'
import { collectionSummary } from '@/lib/collector-wallet/collection-server'
import { CollectionHeader } from '@/components/collector/CollectionHeader'
import { collectorPanel } from '@/lib/collector-wallet/panel-server'
import { initialsOf } from '@/lib/profiles/core'
import { CollectorArtworkPanel } from '@/components/collector/CollectorArtworkPanel'
import { collectorDrafts } from '@/lib/collectors/server'
import { arrivingPurchases } from '@/lib/deals/server'

export const metadata = { title: 'Minha coleção — HouseArt' }

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ own?: string }> }) {
  const { user, nav } = await requirePanelPage('/wallet')
  const sp = await searchParams
  const summary = nav === 'collector' ? await collectionSummary(user) : null
  const [w, held, drafts, arriving] = await Promise.all([walletOf(user.id), heldArtworks(user.id), collectorDrafts(user.id), arrivingPurchases(user.id)])
  // What "Vender" and "Serviços" need beyond the deed: the seal, the status and the registered value of each held artwork.
  const byArtwork = new Map(held.map((v) => [v.certificate.artwork.id, v.certificate.artwork]))
  const items = w.items.map((it) => {
    const a = byArtwork.get(it.artworkId)
    return { ...it, status: a?.status ?? 'AUTHENTICATED', sealGreen: a?.seal === 'GREEN', registeredCents: a?.listPriceCents?.toString() ?? null }
  })
  // the work opens in the side panel with the deed and the owner's actions (only a deed of this person)
  const panel = sp.own ? await collectorPanel(user, { own: sp.own }) : null
  return (
    <div className="ha-page">
      {summary ? <CollectionHeader s={summary} active="works" /> : null}
      <WalletScreen items={items} totalCents={w.totalCents.toString()} holderName={user.name} inCollection={!!summary} openId={panel?.id ?? null} drafts={drafts} arriving={arriving} />
      {panel ? <CollectorArtworkPanel key={panel.id} a={panel} meInitials={initialsOf(user.name)} closeHref="/wallet" /> : null}
    </div>
  )
}

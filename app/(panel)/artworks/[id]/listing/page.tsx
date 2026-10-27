import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { getArtwork } from '@/lib/artworks/server'
import { listingOf } from '@/lib/gallery/listing-server'
import { rulesOf } from '@/lib/gallery/rules-server'
import { Icon } from '@/components/ds/Icon'
import { ListingManager } from '@/components/gallery/ListingManager'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'
import { holdsArtwork } from '@/lib/ownership/server'
import { flagOn } from '@/lib/flags'
import { unlistedState } from '@/components/gallery/unlisted-core'
import { UnlistedCard } from '@/components/gallery/UnlistedCard'
import { ArtworkRecord, ArtworkSummary } from '@/components/gallery/ArtworkPanel'
import { artworkPanelData } from '../../_panel-data'

export const metadata = { title: 'Gestão do anúncio — HouseArt' }

/** "Gestão do anúncio" (handoff "HouseArt Web Galeria" › obra): the listing of ONE artwork for sale,
 * beside the work itself — photos, ficha, certificate and provenance, as in the Acervo side panel. */
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const { scope, user } = await requirePanelPage(`/artworks/${id}/listing`)
  const a = Number.isInteger(id) && id > 0 ? await getArtwork(scope, id) : null
  if (!a) notFound()
  const listing = await listingOf(scope, a.id)
  const data = await artworkPanelData(a, listing)
  // Acervo reads the listing; price, offers and pause are for Vendas and Admin (the API refuses the rest).
  const canManage = sellerPermissions(await galleryRoleOf(scope)).manageListing
  const canTransfer = !!listing && flagOn('FLAG_OWNERSHIP_TRANSFER') && await holdsArtwork(user.id, a.id)
  const rules = await rulesOf(scope).then((r) => ({ refuseBelowBps: r.refuseBelowBps, responseHours: r.responseHours })).catch(() => null)
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <div>
          <Link href="/artworks" className="ha-link ha-link--quiet"><Icon name="arrow_back" size={16} /> Acervo</Link>
          <h1 className="ha-h1"><span className="ha-title">{a.title}</span>{a.year ? `, ${a.year}` : ''}</h1>
          <p className="ha-muted ha-sm">{a.artist.name}{a.publicId ? ` · ${a.publicId}` : ''}</p>
        </div>
        <Link href={`/artworks/${a.id}/edit`} className="ha-btn ha-btn--outline ha-btn--sm"><Icon name="edit" size={18} />Editar cadastro</Link>
      </div>
      <div className="ha-split ha-lp">
        <div className="ha-stack ha-lp__work">
          <ArtworkSummary a={data} />
          <ArtworkRecord a={data} />
        </div>
        <div className="ha-stack">
          {listing ? (
            <ListingManager canManage={canManage} canTransfer={canTransfer} blockedReason={ROLE_REASONS.listing} artworkId={a.id} title={a.title} artistName={a.artist.name} publicId={a.publicId} year={a.year} cover={a.media.find((m) => m.kind === 'FRONT_COLOR_CARD')?.publicUrl ?? null} rules={rules}
              initial={{ listPriceCents: listing.listPriceCents.toString(), acceptsOffers: listing.acceptsOffers, paused: listing.paused, stats: { views7d: listing.stats.views7d, openOffers: listing.stats.openOffers, saves: listing.stats.saves, likes: listing.stats.likes } }} />
          ) : (
            <UnlistedCard artworkId={a.id} title={a.title} listPriceCents={a.listPriceCents} state={unlistedState({ id: a.id, status: a.status, seal: a.seal, publicId: a.publicId }, { manage: canManage && scope.kind !== 'total', edit: true })} />
          )}
        </div>
      </div>
    </div>
  )
}

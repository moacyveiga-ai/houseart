import { requirePanelPage } from '../_session'
import { negotiatorOf, sellerOffers } from '@/lib/offers/server'
import { negotiatorLabel } from '@/lib/offers/mandate-core'
import { Tabs } from '@/components/ds/Tabs'
import { OffersTable } from '@/components/offers/OffersTable'
import { OfferCards } from '@/components/offers/OfferCards'
import { collectionSummary } from '@/lib/collector-wallet/collection-server'
import { CollectionHeader } from '@/components/collector/CollectionHeader'
import { ActiveListings } from '@/components/collector/ActiveListings'
import { activeListings } from '@/lib/collectors/listings-server'
import { sellerDeals } from '@/lib/deals/server'
import { SaleRows } from '@/components/sales/SaleRows'
import { SaleDetail } from '@/components/sales/SaleDetail'
import { saleFinance } from '@/lib/deals/sale-progress-core'
import type { DealView } from '@/lib/deals/server'
import { serializeDeal } from '@/components/deals/deal-view'
import { flagOn } from '@/lib/flags'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'

export const metadata = { title: 'Negócios — HouseArt' }

/** "Financeiro" of the sale panel and the payout note (what the seller's lines say now). */
function financeOf(d: DealView) {
  const finance = saleFinance({ amountCents: d.amountCents, market: d.market, sellerKind: d.sellerKind, artistName: d.artist, split: d.split })
  const mine = d.split.filter((s) => (s.party === 'GALLERY' || s.party === 'ARTIST') && s.payoutLabel)
  const payoutNote = mine.length ? mine.map((s) => `${s.party === 'ARTIST' && d.sellerKind !== 'ARTIST' ? d.artist : d.sellerKind === 'GALLERY_STAFF' ? 'Galeria' : 'Seu repasse'}: ${s.payoutLabel}`).join(' · ') + '.' : null
  return { finance: finance.map((l) => ({ label: l.label, cents: l.cents.toString(), sign: l.sign, strong: l.strong })), payoutNote }
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string; sale?: string; artwork?: string }> }) {
  const { scope, user, nav } = await requirePanelPage('/sales')
  // A collector without a member (no artwork in their name yet) has nothing to sell: the
  // scope is NONE, every list is empty and the page says so instead of erroring.
  const collector = nav === 'collector'
  if (collector && !user.memberId) {
    return (
      <div className="ha-page">
        <div className="ha-page__head"><h1 className="ha-h1">Vendas</h1></div>
        <div className="ha-callout"><Icon name="storefront" /><span className="ha-stack" style={{ gap: 4 }}><b>Você ainda não tem obras à venda</b><span className="ha-sm">As ofertas das obras que você anunciar chegam aqui. Comece pela sua <Link href="/wallet" className="ha-link">carteira de escrituras</Link>: cadastre uma obra ou escolha uma no seu nome e toque em Vender.</span></span></div>
      </div>
    )
  }
  const sp = await searchParams
  const tab = sp.tab === 'deals' ? 'deals' : 'offers'
  const saleId = Number(sp.sale)
  const allOffers = await sellerOffers(scope)
  // "Ofertas desta obra" (Gestão do anúncio): ?artwork= narrows the list to ONE work; the chip leads back to all
  const artworkFilter = Number(sp.artwork)
  const onlyWork = Number.isInteger(artworkFilter) && artworkFilter > 0 ? allOffers.find((o) => o.artworkId === artworkFilter) ?? null : null
  const offers = onlyWork ? allOffers.filter((o) => o.artworkId === artworkFilter) : allOffers
  const deals = tab === 'deals' && flagOn('FLAG_DEALS') ? await sellerDeals(scope) : []
  // the sale named by ?sale= among the seller's own deals (scope-limited list: another seller's id opens nothing)
  const open1 = Number.isInteger(saleId) && saleId > 0 ? deals.find((d) => d.id === saleId) ?? null : null
  const mandate = await negotiatorOf(scope)
  const open = allOffers.filter((o) => o.open).length
  // The gallery team role: Acervo does not answer proposals, only Admin changes the rules (the API refuses the rest).
  const can = sellerPermissions(await galleryRoleOf(scope))
  const live = flagOn('FLAG_DEALS') ? (await sellerDeals(scope)).filter((d) => d.phase !== 'COMPLETED').length : allOffers.filter((o) => o.status === 'ACCEPTED' || o.status === 'IN_DEAL').length
  // The gallery desk and the collector use the prototype's offer cards (Web Galeria › Negócios; App Colecionador › Vendas).
  const desk = nav === 'gallery' || nav === 'advisor'
  const cards = desk || collector
  const negotiatorLine = mandate ? negotiatorLabel(mandate) : 'Negociador automático: nenhuma obra listada.'
  const summary = collector ? await collectionSummary(user) : null
  // Web Colecionador › Vendas: the works on the marketplace, under the offers (audit colecionador §12)
  const listings = collector && tab === 'offers' ? await activeListings(scope) : null
  return (
    <div className="ha-page">
      {summary ? <CollectionHeader s={summary} active="sales" /> : <div className="ha-page__head"><h1 className="ha-h1">{desk ? 'Negócios' : 'Vendas e ofertas'}</h1></div>}
      <Tabs active={tab} items={[{ key: 'offers', label: desk ? 'Ofertas' : 'Ofertas recebidas', href: '/sales', count: open }, { key: 'deals', label: desk ? 'Vendas' : 'Em andamento', href: '/sales?tab=deals', count: live }, ...(collector || !can.manageRules ? [] : [{ key: 'rules', label: 'Regras', href: '/sales/rules' }])]} />
      {tab === 'offers' && onlyWork ? (
        <div className="ha-row" style={{ gap: 8, alignItems: 'center' }}><span className="ha-chip ha-chip--on">Ofertas de <i>{onlyWork.artworkTitle}</i></span><Link href={tab === 'offers' ? '/sales' : '/sales?tab=offers'} className="ha-link ha-sm">Ver todas as ofertas</Link></div>
      ) : null}
      {tab === 'offers' && cards ? (
        <OfferCards canAnswer={can.answerOffers} blockedReason={ROLE_REASONS.offers} negotiatorLine={negotiatorLine} offers={offers.map((o) => ({
          id: o.id, code: o.code, artworkId: o.artworkId, artworkTitle: o.artworkTitle, artworkCover: o.artworkCover, listPriceCents: o.listPriceCents?.toString() ?? null, currentCents: o.currentCents.toString(),
          status: o.status, statusLabel: o.statusLabel, buyer: o.buyer, buyerFirstName: o.buyerFirstName, buyerInitials: o.buyerInitials,
          expiresIn: o.expiresIn, open: o.open, lastAuthor: o.rounds[o.rounds.length - 1]?.author ?? null, pctOfPrice: o.pctOfPrice, buyerMessage: o.buyerMessage,
        }))} />
      ) : tab === 'offers' ? (
        <OffersTable canAnswer={can.answerOffers} blockedReason={ROLE_REASONS.offers} negotiatorLine={mandate ? negotiatorLabel(mandate) : 'Negociador automático: nenhuma obra listada.'} offers={offers.map((o) => ({
          id: o.id, code: o.code, artworkTitle: o.artworkTitle, artworkCover: o.artworkCover, listPriceCents: o.listPriceCents?.toString() ?? null, currentCents: o.currentCents.toString(),
          status: o.status, statusLabel: o.statusLabel, buyer: o.buyer, expiresIn: o.expiresIn, differenceLabel: o.differenceLabel, open: o.open, lastAuthor: o.rounds[o.rounds.length - 1]?.author ?? null,
        }))} />
      ) : (
        deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma venda em andamento.</p></div> : (
          // "Vendas até o repasse": compact rows; the sale opens in the side panel (?sale=), the list stays behind.
          <>
            <SaleRows deals={deals.map(serializeDeal)} openId={open1?.id ?? null} hrefOf={(id) => `/sales?tab=deals&sale=${id}`} />
            {open1 ? <SaleDetail key={open1.id} deal={serializeDeal(open1)} {...financeOf(open1)} canAnswer={can.answerOffers} closeHref="/sales?tab=deals" workHref={desk && open1.phase !== 'COMPLETED' ? `/artworks?open=${open1.artworkId}` : null} /> : null}
          </>
        )
      )}
      {listings ? <ActiveListings rows={listings} /> : null}
    </div>
  )
}

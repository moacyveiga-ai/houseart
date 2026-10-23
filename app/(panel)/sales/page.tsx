import { requirePanelPage } from '../_session'
import { negotiatorOf, sellerOffers } from '@/lib/offers/server'
import { negotiatorLabel } from '@/lib/offers/mandate-core'
import { Tabs } from '@/components/ds/Tabs'
import { OffersTable } from '@/components/offers/OffersTable'
import { sellerDeals } from '@/lib/deals/server'
import { DealTimeline } from '@/components/deals/DealTimeline'
import { serializeDeal } from '@/components/deals/deal-view'
import { flagOn } from '@/lib/flags'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'

export const metadata = { title: 'Vendas e ofertas — HouseArt' }

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
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
  const tab = (await searchParams).tab === 'deals' ? 'deals' : 'offers'
  const offers = await sellerOffers(scope)
  const deals = tab === 'deals' && flagOn('FLAG_DEALS') ? await sellerDeals(scope) : []
  const mandate = await negotiatorOf(scope)
  const open = offers.filter((o) => o.open).length
  // The gallery team role: Acervo does not answer proposals, only Admin changes the rules (the API refuses the rest).
  const can = sellerPermissions(await galleryRoleOf(scope))
  const live = flagOn('FLAG_DEALS') ? (await sellerDeals(scope)).filter((d) => d.phase !== 'COMPLETED').length : offers.filter((o) => o.status === 'ACCEPTED' || o.status === 'IN_DEAL').length
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">{collector ? 'Vendas' : 'Vendas e ofertas'}</h1></div>
      <Tabs active={tab} items={[{ key: 'offers', label: 'Ofertas recebidas', href: '/sales', count: open }, { key: 'deals', label: 'Em andamento', href: '/sales?tab=deals', count: live }, ...(collector || !can.manageRules ? [] : [{ key: 'rules', label: 'Regras', href: '/sales/rules' }])]} />
      {tab === 'offers' ? (
        <OffersTable canAnswer={can.answerOffers} blockedReason={ROLE_REASONS.offers} negotiatorLine={mandate ? negotiatorLabel(mandate) : 'Negociador automático: nenhuma obra listada.'} offers={offers.map((o) => ({
          id: o.id, code: o.code, artworkTitle: o.artworkTitle, artworkCover: o.artworkCover, listPriceCents: o.listPriceCents?.toString() ?? null, currentCents: o.currentCents.toString(),
          status: o.status, statusLabel: o.statusLabel, buyer: o.buyer, expiresIn: o.expiresIn, differenceLabel: o.differenceLabel, open: o.open, lastAuthor: o.rounds[o.rounds.length - 1]?.author ?? null,
        }))} />
      ) : (
        deals.length === 0 ? <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma venda em andamento.</p></div> : deals.map((d) => <DealTimeline key={d.id} deal={serializeDeal(d)} side="seller" />)
      )}
    </div>
  )
}

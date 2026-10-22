import { requirePanelPage } from '../../_session'
import { listPaymentMethods, payoutAccountOf } from '@/lib/payment-methods/server'
import { CardsScreen } from '@/components/wallet/CardsScreen'
import '@/components/wallet/cards.css'

export const metadata = { title: 'Carteira e cartões — HouseArt' }

export default async function WalletCardsPage() {
  const { user } = await requirePanelPage('/wallet/cards')
  const methods = await listPaymentMethods(user.id)
  // Members who sell see the shortcut to the Pix for receiving (prototype "Recebimentos das vendas").
  const payout = user.memberId ? { href: '/sales/payout', registered: !!(await payoutAccountOf(user.memberId)) } : null
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Carteira e cartões</h1></div>
      <CardsScreen methods={methods} holderName={user.name} payout={payout} />
    </div>
  )
}

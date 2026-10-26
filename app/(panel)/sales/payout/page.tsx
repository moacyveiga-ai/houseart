import { requirePanelPage } from '../../_session'
import { payoutAccountOf } from '@/lib/payment-methods/server'
import { cpfMaskOf } from '@/lib/payment-methods/domain'
import { PayoutAccountScreen } from '@/components/sales/PayoutAccountScreen'
import { ConnectAccountCard } from '@/components/sales/ConnectAccountCard'
import { connectAccountView, connectAvailable } from '@/lib/stripe/connect-server'
import { Icon } from '@/components/ds/Icon'
import '@/components/sales/payout.css'

export const metadata = { title: 'Pix para receber vendas — HouseArt' }

/** Only the digits 4–9 of the CPF show (same mask the prototype prints). */
export default async function SalesPayoutPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const { user } = await requirePanelPage('/sales/payout')
  const connectRaw = (await searchParams).connect
  const connectParam = connectRaw === 'return' || connectRaw === 'refresh' ? connectRaw : null
  if (!user.memberId) {
    return (
      <div className="ha-page">
        <div className="ha-page__head"><h1 className="ha-h1">Pix para receber vendas</h1></div>
        <div className="ha-callout"><Icon name="info" size={20} /><p className="ha-sm" style={{ margin: 0 }}>Só membros que vendem (artista ou galeria) cadastram uma chave Pix. Esta conta não tem um perfil de vendedor.</p></div>
      </div>
    )
  }
  const account = await payoutAccountOf(user.memberId)
  // Connect only exists in test/live: in mock mode the Pix screen is exactly the one of before.
  const connect = connectAvailable() ? await connectAccountView(user.memberId) : null
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">{connect ? 'Receber vendas' : 'Pix para receber vendas'}</h1></div>
      {connect ? <ConnectAccountCard account={connect} connectParam={connectParam} /> : null}
      <PayoutAccountScreen account={account} holderName={user.name} cpfMask={cpfMaskOf(user.cpf)} />
    </div>
  )
}

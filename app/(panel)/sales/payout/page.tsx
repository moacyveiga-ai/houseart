import { requirePanelPage } from '../../_session'
import { payoutAccountOf } from '@/lib/payment-methods/server'
import { PayoutAccountScreen } from '@/components/sales/PayoutAccountScreen'
import { Icon } from '@/components/ds/Icon'
import '@/components/sales/payout.css'

export const metadata = { title: 'Pix para receber vendas — HouseArt' }

/** Only the digits 4–9 of the CPF show (same mask the prototype prints). */
function cpfMaskOf(cpf: string | null): string | null {
  const d = (cpf ?? '').replace(/\D/g, '')
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null
}

export default async function SalesPayoutPage() {
  const { user } = await requirePanelPage('/sales/payout')
  if (!user.memberId) {
    return (
      <div className="ha-page">
        <div className="ha-page__head"><h1 className="ha-h1">Pix para receber vendas</h1></div>
        <div className="ha-callout"><Icon name="info" size={20} /><p className="ha-sm" style={{ margin: 0 }}>Só membros que vendem (artista ou galeria) cadastram uma chave Pix. Esta conta não tem um perfil de vendedor.</p></div>
      </div>
    )
  }
  const account = await payoutAccountOf(user.memberId)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Pix para receber vendas</h1></div>
      <PayoutAccountScreen account={account} holderName={user.name} cpfMask={cpfMaskOf(user.cpf)} />
    </div>
  )
}

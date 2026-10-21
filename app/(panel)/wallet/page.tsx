import { requirePanelPage } from '../_session'
import { walletOf } from '@/lib/collector-wallet/server'
import { WalletScreen } from '@/components/wallet/WalletScreen'
import { flagOn } from '@/lib/flags'

export const metadata = { title: 'Carteira de escrituras — HouseArt' }

export default async function WalletPage() {
  const { user } = await requirePanelPage('/wallet')
  const w = await walletOf(user.id)
  return <div className="ha-page"><WalletScreen items={w.items} totalCents={w.totalCents.toString()} holderName={user.name} transferOn={flagOn('FLAG_OWNERSHIP_TRANSFER')} /></div>
}

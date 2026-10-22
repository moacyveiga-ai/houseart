import { requirePanelPage } from '../_session'
import { walletOf } from '@/lib/collector-wallet/server'
import { heldArtworks } from '@/lib/ownership/server'
import { WalletScreen } from '@/components/wallet/WalletScreen'
import { flagOn } from '@/lib/flags'

export const metadata = { title: 'Carteira de escrituras — HouseArt' }

export default async function WalletPage() {
  const { user } = await requirePanelPage('/wallet')
  const [w, held] = await Promise.all([walletOf(user.id), heldArtworks(user.id)])
  // What "Vender" and "Serviços" need beyond the deed: the seal, the status and the registered value of each held artwork.
  const byArtwork = new Map(held.map((v) => [v.certificate.artwork.id, v.certificate.artwork]))
  const items = w.items.map((it) => {
    const a = byArtwork.get(it.artworkId)
    return { ...it, status: a?.status ?? 'AUTHENTICATED', sealGreen: a?.seal === 'GREEN', registeredCents: a?.listPriceCents?.toString() ?? null }
  })
  return <div className="ha-page"><WalletScreen items={items} totalCents={w.totalCents.toString()} holderName={user.name} transferOn={flagOn('FLAG_OWNERSHIP_TRANSFER')} /></div>
}

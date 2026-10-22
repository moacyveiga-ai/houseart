import { requirePanelPage } from '../../_session'
import { RegisterArtworkScreen } from '@/components/collector/RegisterArtworkScreen'

export const metadata = { title: 'Cadastrar obra — HouseArt' }

/** Cadastrar obra do colecionador (handoff "HouseArt App Colecionador" › Cadastrar obra): origin → artist → acquisition; the draft opens in the wizard. */
export default async function RegisterArtworkPage() {
  await requirePanelPage('/wallet/register')
  return <div className="ha-page"><RegisterArtworkScreen /></div>
}

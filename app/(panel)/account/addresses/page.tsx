import { requirePanelPage } from '../../_session'
import { addressesOf } from '@/lib/addresses/server'
import { AddressesScreen } from '@/components/collector/AddressesScreen'
import '@/components/gallery/account.css'

export const metadata = { title: 'Endereços de entrega — HouseArt' }

/** Endereços de entrega (Perfil › Cadastro): only the person's own. */
export default async function AddressesPage() {
  const { user } = await requirePanelPage('/account/addresses')
  return <div className="ha-page"><AddressesScreen items={await addressesOf(user.id)} recipient={user.name} /></div>
}

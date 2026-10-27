import Link from 'next/link'
import { requirePanelPage } from '../../_session'
import { accountHrefOf } from '@/lib/profiles/nav'
import { devicesOf } from '@/lib/auth/devices-server'
import { DevicesList } from '@/components/account/DevicesList'
import { Icon } from '@/components/ds/Icon'
import '@/components/gallery/account.css'
import '@/components/collector/collector-account.css'

export const metadata = { title: 'Aparelhos conectados — HouseArt' }

/** Perfil › Segurança e privacidade › Aparelhos conectados: the person's live sessions. */
export default async function DevicesPage() {
  const { user, nav } = await requirePanelPage('/account/devices')
  const devices = await devicesOf(user.id, user.sessionId)
  return (
    <div className="ha-page">
      <div className="ha-account ha-cacct">
        <div className="ha-cacct__bar"><Link href={accountHrefOf(nav)} className="ha-iconbtn ha-cacct__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link><span className="ha-cacct__bar-t">Aparelhos conectados</span></div>
        <p className="ha-sm ha-muted">Onde sua conta está aberta. Se não reconhecer um aparelho, saia dele e troque a senha.</p>
        <DevicesList initial={devices} />
      </div>
    </div>
  )
}

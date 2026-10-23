import { requirePanelPage } from '../../_session'
import { rulesOf } from '@/lib/gallery/rules-server'
import { Tabs } from '@/components/ds/Tabs'
import { Icon } from '@/components/ds/Icon'
import { OfferRulesScreen } from '@/components/gallery/OfferRulesScreen'
import '@/components/gallery/offer-rules.css'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { ROLE_REASONS, sellerPermissions } from '@/lib/offers/seller-role-core'

export const metadata = { title: 'Regras de ofertas — HouseArt' }

const TABS = [{ key: 'offers', label: 'Ofertas recebidas', href: '/sales' }, { key: 'deals', label: 'Em andamento', href: '/sales?tab=deals' }, { key: 'rules', label: 'Regras', href: '/sales/rules' }]

export default async function SalesRulesPage() {
  const { user, scope } = await requirePanelPage('/sales/rules')
  const rules = user.memberId ? await rulesOf(scope) : null
  // Only the gallery's Admin changes the rules: the rest of the team reads them.
  const canManage = sellerPermissions(await galleryRoleOf(scope)).manageRules
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Regras de ofertas</h1></div>
      <Tabs active="rules" items={TABS} />
      {rules && !canManage ? <div className="ha-callout"><Icon name="lock" size={20} /><p className="ha-sm" style={{ margin: 0 }}>{ROLE_REASONS.rules}</p></div> : null}
      {rules ? <OfferRulesScreen rules={rules} readOnly={!canManage} /> : (
        <div className="ha-callout"><Icon name="info" size={20} /><p className="ha-sm" style={{ margin: 0 }}>Só quem vende (artista ou galeria) tem regras de ofertas. Esta conta não tem um perfil de vendedor.</p></div>
      )}
    </div>
  )
}

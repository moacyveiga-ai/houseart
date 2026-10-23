import { requirePanelPage } from '../../_session'
import { teamOf } from '@/lib/gallery/team-server'
import { TeamScreen } from '@/components/gallery/TeamScreen'
import '@/components/gallery/team.css'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { sellerPermissions } from '@/lib/offers/seller-role-core'

export const metadata = { title: 'Equipe — HouseArt' }

export default async function GalleryTeamPage() {
  const { user, scope } = await requirePanelPage('/gallery/team')
  const people = await teamOf(scope, user.id)
  // The tenant ADMIN manages the team (the API answers 403 to the others); the rest only reads.
  // Every gallery staff member has the tenant scope: the team ROLE decides (Vendas and Acervo read).
  const canManage = (scope.kind === 'tenant' || scope.kind === 'total') && sellerPermissions(await galleryRoleOf(scope)).manageTeam
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Equipe</h1></div>
      <TeamScreen people={people} canManage={canManage} />
    </div>
  )
}

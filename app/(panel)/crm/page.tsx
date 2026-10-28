import { requirePanelPage } from '../_session'
import { kanban } from '@/lib/crm/server'
import { Kanban } from '@/components/crm/Kanban'

export const metadata = { title: 'Colecionadores — HouseArt' }

export default async function CrmPage() {
  const { scope } = await requirePanelPage('/crm')
  const { columns } = await kanban(scope)
  return (
    <div className="ha-page">
      <Kanban columns={columns} />
    </div>
  )
}

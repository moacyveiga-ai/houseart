import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { galleryAccount } from '@/lib/gallery/account-server'
import { GalleryDataForm } from '@/components/gallery/GalleryDataForm'
import '@/components/gallery/account.css'

export const metadata = { title: 'Dados da galeria — HouseArt' }

export default async function GalleryDataPage() {
  const { user, scope } = await requirePanelPage('/gallery/account/data')
  const account = await galleryAccount(user, scope)
  if (!account) notFound()
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Dados da galeria</h1></div>
      <GalleryDataForm account={account} />
    </div>
  )
}

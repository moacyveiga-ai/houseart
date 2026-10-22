// Perfil público da galeria (só o ADMIN da galeria).
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { ContentError } from '@/lib/public-content/editor-core'
import { galleryAdminTenant, galleryProfileView } from '@/lib/public-content/editor-server'
import { GalleryProfileEditor } from '@/components/content-editor/GalleryProfileEditor'
import '@/components/content-editor/content-editor.css'

export const metadata = { title: 'Perfil público da galeria — HouseArt' }

export default async function GalleryPublicProfilePage() {
  const { scope } = await requirePanelPage('/gallery/public')
  const tenantId = await galleryAdminTenant(scope).catch((e) => { if (e instanceof ContentError) return null; throw e })
  if (!tenantId) notFound()
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Perfil público da galeria</h1></div>
      <GalleryProfileEditor initial={await galleryProfileView(tenantId)} />
    </div>
  )
}

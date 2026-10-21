import { redirect } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { createDraft } from '@/lib/artworks/server'

// "Nova obra" creates the DRAFT and opens the 6-step wizard on step 1.
export default async function NewArtworkPage() {
  const { scope } = await requirePanelPage('/artworks/new')
  const a = await createDraft(scope)
  redirect(`/artworks/${a.id}/edit`)
}

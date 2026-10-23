import { redirect } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { openBlankDraft } from '@/lib/artworks/server'

// "Nova obra" opens the blank DRAFT (reused, never one per visit) in the 6-step wizard on step 1.
export default async function NewArtworkPage() {
  const { scope } = await requirePanelPage('/artworks/new')
  const a = await openBlankDraft(scope)
  redirect(`/artworks/${a.id}/edit`)
}

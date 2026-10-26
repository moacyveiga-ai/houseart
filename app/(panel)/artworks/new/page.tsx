import { redirect } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { openBlankDraft } from '@/lib/artworks/server'

// "Nova obra": a gallery (or advisor) goes to its five-step register (handoff "Web Galeria" › Cadastrar
// obra); an artist opens the blank DRAFT (reused, never one per visit) in the 6-step wizard on step 1.
export default async function NewArtworkPage() {
  const { scope, nav } = await requirePanelPage('/artworks/new')
  if (nav === 'gallery' || nav === 'advisor') redirect('/artworks/register')
  const a = await openBlankDraft(scope)
  redirect(`/artworks/${a.id}/edit`)
}

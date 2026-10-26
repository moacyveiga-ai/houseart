import { requirePanelPage } from '../_session'
import { instagramView } from '@/lib/instagram/server'
import { accountHrefOf } from '@/lib/profiles/nav'
import { InstagramScreen } from '@/components/instagram/InstagramScreen'
import '@/components/instagram/instagram.css'

export const metadata = { title: 'Instagram — HouseArt' }

const OUTCOMES: Record<string, string> = {
  conectado: 'Instagram conectado',
  cancelado: 'Conexão cancelada no Instagram',
  expirado: 'O pedido expirou. Tente de novo.',
  recusado: 'O Instagram não aceitou a conexão. Confira se a conta é profissional ou de criador.',
  indisponivel: 'A conexão com o Instagram ainda não está disponível.',
}

/** Instagram · conectar e postar (handoff Web Galeria and App Colecionador): the person's own account. */
export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ ig?: string }> }) {
  const { user, nav } = await requirePanelPage('/instagram')
  const view = await instagramView(user.id)
  const outcome = OUTCOMES[(await searchParams).ig ?? ''] ?? null
  return (
    <div className="ha-page">
      <InstagramScreen view={view} back={accountHrefOf(nav)} outcome={outcome} />
    </div>
  )
}

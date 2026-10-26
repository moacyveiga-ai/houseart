import { requirePanelPage } from '../../_session'
import { teamOf } from '@/lib/gallery/team-server'
import { representedArtists } from '@/lib/gallery/artists-server'
import { payoutAccountOf } from '@/lib/payment-methods/server'
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import { initialsOf } from '@/lib/profiles/core'
import { composerInstagram } from '@/lib/instagram/server'
import { AccountScreen, type AccountSection } from '@/components/gallery/AccountScreen'
import '@/components/gallery/account.css'

export const metadata = { title: 'Conta da galeria — HouseArt' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default async function GalleryAccountPage() {
  const { user, scope } = await requirePanelPage('/gallery/account')
  const [people, artists, payout, ig] = await Promise.all([
    teamOf(scope, user.id),
    representedArtists(scope).catch(() => []),
    user.memberId ? payoutAccountOf(user.memberId) : null,
    composerInstagram(user.id),
  ])
  const members = people.filter((p) => p.kind === 'MEMBER').length
  const invites = people.length - members
  const sections: AccountSection[] = [
    { name: 'Galeria', items: [
      { icon: 'groups', name: 'Equipe', sub: `${plural(members, 'pessoa', 'pessoas')}${invites ? ` · ${plural(invites, 'convite pendente', 'convites pendentes')}` : ''}`, href: '/gallery/team' },
      { icon: 'palette', name: 'Artistas representados', sub: `${plural(artists.length, 'artista', 'artistas')} · ${plural(artists.filter((a) => a.contract).length, 'contrato ativo', 'contratos ativos')}`, href: '/gallery/artists' },
      { icon: 'public', name: 'Perfil público', sub: 'Página da galeria no site: sobre, endereço, equipe, fotos e publicações', href: '/gallery/public' },
    ] },
    // the desk screens that left the menu (audit 2026-10-25: five entries, as in Web Galeria)
    { name: 'Operação', items: [
      { icon: 'verified', name: 'Certificação', sub: 'Etiquetas, assinatura e emissão dos certificados', href: '/certification' },
      { icon: 'rule', name: 'Regras de ofertas', sub: 'Recusa automática, avisos e prazo de resposta', href: '/sales/rules' },
      { icon: 'view_kanban', name: 'Colecionadores', sub: 'Interessados e conversas em andamento', href: '/crm' },
      { icon: 'autorenew', name: 'Direito de sequência', sub: 'Repasses aos artistas nas revendas', href: '/royalty' },
    ] },
    { name: 'Recebimentos', items: [
      { icon: 'account_balance', name: 'Pix para repasses', sub: payout ? `${PIX_KEY_TYPE_LABELS[payout.pixKeyType as PixKeyType] ?? payout.pixKeyType} · ${payout.pixKeyMask}` : 'Não cadastrado', href: '/sales/payout' },
    ] },
    { name: 'Plano e pagamentos', items: [
      { icon: 'workspace_premium', name: 'Plano e cobrança', sub: 'Plano, uso do mês e faturas', href: '/billing' },
      { icon: 'account_balance_wallet', name: 'Carteira e cartões', sub: 'Cartão para plano e serviços', href: '/wallet/cards' },
    ] },
    { name: 'Redes sociais', items: [
      { icon: 'photo_camera', name: 'Instagram', sub: ig.mode === 'OFF' ? 'Em breve: postar também no Instagram da galeria' : ig.handle ? `${ig.handle} · conectado` : 'Conecte para postar também fora da HouseArt', href: '/instagram' },
    ] },
    { name: 'Segurança', items: [
      { icon: 'password', name: 'Alterar senha', sub: 'Enviamos um link para o seu e-mail', href: '/recover-password' },
    ] },
    { name: 'Ajuda', items: [
      { icon: 'help', name: 'Central de ajuda', sub: 'Consignação, certificação, frete e repasses', href: '/e/how-it-works' },
    ] },
  ]
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Conta da galeria</h1></div>
      <AccountScreen initials={initialsOf(user.name)} name={user.name} email={user.email} sections={sections} />
    </div>
  )
}

import { requirePanelPage } from '../../_session'
import { teamOf } from '@/lib/gallery/team-server'
import { representedArtists } from '@/lib/gallery/artists-server'
import { payoutAccountOf } from '@/lib/payment-methods/server'
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import { initialsOf } from '@/lib/profiles/core'
import { composerInstagram } from '@/lib/instagram/server'
import { galleryAccount } from '@/lib/gallery/account-server'
import { addressLine, planLine, splitLine } from '@/lib/gallery/account-core'
import { usageOf } from '@/lib/plans/server'
import { priceLabel } from '@/lib/plans/core'
import { ScopeNotApplied } from '@/lib/scope/extension-core'
import { AccountScreen, type AccountSection } from '@/components/gallery/AccountScreen'
import '@/components/gallery/account.css'
import { SidePanel } from '@/components/ds/SidePanel'
import { TeamScreen } from '@/components/gallery/TeamScreen'
import '@/components/gallery/team.css'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'
import { sellerPermissions } from '@/lib/offers/seller-role-core'

export const metadata = { title: 'Conta da galeria — HouseArt' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default async function GalleryAccountPage({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const { user, scope } = await requirePanelPage('/gallery/account')
  // Conta › Equipe opens in the side panel over the account (Web Galeria); /gallery/team stays as the full page
  const teamOpen = (await searchParams).panel === 'team'
  const [people, artists, payout, ig, account, usage, role] = await Promise.all([
    teamOf(scope, user.id),
    representedArtists(scope).catch(() => []),
    user.memberId ? payoutAccountOf(user.memberId) : null,
    composerInstagram(user.id),
    galleryAccount(user, scope),
    // the plan line is decoration: a failure zeroes it, but a query without owner is never swallowed
    usageOf(scope).catch((e: unknown) => { if (e instanceof ScopeNotApplied) throw e; return null }),
    teamOpen ? galleryRoleOf(scope) : null,
  ])
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || null
  const members = people.filter((p) => p.kind === 'MEMBER').length
  const invites = people.length - members
  const sections: AccountSection[] = [
    { name: 'Galeria', items: [
      { icon: 'storefront', name: 'Dados da galeria', sub: account ? [account.cnpjMask ? `CNPJ ${account.cnpjMask}` : null, account.data.city || null].filter(Boolean).join(' · ') || 'Nome, CNPJ, contato e cidade' : 'Nome, CNPJ, contato e cidade', href: '/gallery/account/data' },
      { icon: 'groups', name: 'Equipe', sub: `${plural(members, 'pessoa', 'pessoas')}${invites ? ` · ${plural(invites, 'convite pendente', 'convites pendentes')}` : ''}`, href: '/gallery/account?panel=team', current: teamOpen },
      { icon: 'palette', name: 'Artistas representados', sub: `${plural(artists.length, 'artista', 'artistas')} · ${plural(artists.filter((a) => a.contract).length, 'contrato ativo', 'contratos ativos')}`, href: '/gallery/artists' },
      { icon: 'location_on', name: 'Endereço e horários', sub: addressLine(account?.address ?? null), href: '/gallery/public' },
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
      { icon: 'call_split', name: 'Divisão com artistas', sub: splitLine(artists.flatMap((a) => (a.contract ? [a.contract] : []))), href: '/gallery/artists' },
      { icon: 'receipt_long', name: 'Notas e comprovantes', sub: 'Serviços, etiquetas e taxas pagas pela galeria', href: '/account/receipts' },
    ] },
    { name: 'Plano e pagamentos', items: [
      { icon: 'workspace_premium', name: 'Plano e cobrança', sub: planLine(usage ? { name: usage.plan.name, priceLabel: priceLabel(usage.plan.priceCents) } : null, usage?.bars ?? []), href: '/billing' },
      { icon: 'account_balance_wallet', name: 'Carteira e cartões', sub: 'Cartão para plano e serviços', href: '/wallet/cards' },
    ] },
    { name: 'Redes sociais', items: [
      { icon: 'photo_camera', name: 'Instagram', sub: ig.mode === 'OFF' ? 'Em breve: postar também no Instagram da galeria' : ig.handle ? `${ig.handle} · conectado` : 'Conecte para postar também fora da HouseArt', href: '/instagram' },
    ] },
    { name: 'Segurança', items: [
      { icon: 'password', name: 'Alterar senha', sub: 'Enviamos um link para o seu e-mail', href: '/recover-password' },
      { icon: 'devices', name: 'Aparelhos conectados', sub: 'Onde sua conta está aberta', href: '/account/devices' },
    ] },
    { name: 'Ajuda', items: [
      { icon: 'support_agent', name: 'Falar com a HouseArt', sub: supportEmail ? `Atendimento por e-mail · ${supportEmail}` : 'Como chegar ao atendimento', href: supportEmail ? `mailto:${supportEmail}` : '/e/how-it-works#suporte' },
      { icon: 'help', name: 'Central de ajuda', sub: 'Consignação, certificação, frete e repasses', href: '/e/how-it-works' },
    ] },
  ]
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Conta da galeria</h1></div>
      <AccountScreen initials={initialsOf(account?.galleryName ?? user.name)} name={account?.galleryName ?? user.name} email={user.email} verification={account?.verified ?? null} sections={sections} supportEmail={supportEmail} />
      {teamOpen ? (
        <SidePanel title="Equipe" closeHref="/gallery/account">
          <TeamScreen people={people} canManage={(scope.kind === 'tenant' || scope.kind === 'total') && sellerPermissions(role).manageTeam} />
        </SidePanel>
      ) : null}
    </div>
  )
}

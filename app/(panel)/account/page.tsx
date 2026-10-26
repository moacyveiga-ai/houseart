import { requirePanelPage } from '../_session'
import { identityOf } from '@/lib/accounts/identity-server'
import { readPreferences } from '@/lib/accounts/preferences-server'
import { favoritesOf } from '@/lib/community/server'
import { listPaymentMethods, payoutAccountOf } from '@/lib/payment-methods/server'
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import { initialsOf } from '@/lib/profiles/core'
import { CollectorAccount, type CollectorAccountSection } from '@/components/collector/CollectorAccount'
import '@/components/gallery/account.css'

export const metadata = { title: 'Minha conta — HouseArt' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default async function CollectorAccountPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user } = await requirePanelPage('/account')
  const view = (await searchParams).view === 'data' ? 'data' : 'menu'
  const [identity, prefs, favorites, cards, payout] = await Promise.all([
    identityOf(user.id),
    readPreferences(user.id),
    favoritesOf(user.id).catch(() => []),
    listPaymentMethods(user.id).catch(() => []),
    user.memberId ? payoutAccountOf(user.memberId).catch(() => null) : null,
  ])
  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0]
  const me = { name: user.name, email: user.email, emailVerified: identity.emailVerified, phoneMask: identity.phoneMask, phoneVerified: identity.phoneVerified, cpfMask: identity.cpfMask, city: identity.city }
  const sections: CollectorAccountSection[] = [
    { name: 'Cadastro', items: [
      { kind: 'link', icon: 'person', name: 'Dados pessoais', sub: [user.email, identity.phoneMask].filter(Boolean).join(' · '), href: '/account?view=data' },
      { kind: 'link', icon: 'verified_user', name: 'E-mail e celular', sub: `${identity.emailVerified ? 'E-mail verificado' : 'E-mail não verificado'}${identity.phoneMask ? ` · celular ${identity.phoneVerified ? 'verificado' : 'não verificado'}` : ''}`, href: '/account?view=data' },
    ] },
    { name: 'Coleção', items: [
      { kind: 'link', icon: 'collections', name: 'Minha coleção', sub: 'As obras e escrituras no seu nome', href: '/wallet' },
      { kind: 'link', icon: 'add_photo_alternate', name: 'Cadastrar obra', sub: 'Uma obra que já é sua, para certificar e vender', href: '/wallet/register' },
      { kind: 'link', icon: 'favorite', name: 'Favoritos e curtidos', sub: `${plural(favorites.filter((f) => f.saved).length, 'favorito', 'favoritos')} · ${plural(favorites.filter((f) => f.liked).length, 'curtida', 'curtidas')}`, href: '/favorites' },
      { kind: 'link', icon: 'local_shipping', name: 'Compras', sub: 'Ofertas, pagamentos e entregas', href: '/purchases' },
      { kind: 'link', icon: 'swap_horiz', name: 'Transferir uma obra', sub: 'Venda feita fora da HouseArt, registrada na escritura', href: '/transfer' },
    ] },
    { name: 'Pagamentos', items: [
      { kind: 'link', icon: 'credit_card', name: 'Carteira e cartões', sub: cards.length ? `${plural(cards.length, 'cartão', 'cartões')}${defaultCard ? ` · padrão ${defaultCard.brandLabel} •••• ${defaultCard.last4}` : ''}` : 'Nenhum cartão salvo', href: '/wallet/cards' },
      { kind: 'link', icon: 'account_balance', name: 'Pix para receber vendas', sub: payout ? `Cadastrado · ${PIX_KEY_TYPE_LABELS[payout.pixKeyType as PixKeyType] ?? payout.pixKeyType}` : 'Não cadastrado', href: '/sales/payout' },
    ] },
    { name: 'Segurança e privacidade', items: [
      { kind: 'link', icon: 'password', name: 'Alterar senha', sub: 'Enviamos um link para o seu e-mail', href: '/recover-password' },
    ] },
    { name: 'Notificações', items: [
      { kind: 'link', icon: 'notifications', name: 'Avisos', sub: 'Ofertas, mensagens e entregas', href: '/notifications' },
      { kind: 'switch', icon: 'mail', name: 'Novidades por e-mail', sub: 'Aberturas e obras de quem você segue', key: 'marketingOptIn', on: prefs.marketingOptIn },
    ] },
    { name: 'Ajuda', items: [
      { kind: 'link', icon: 'help', name: 'Perguntas frequentes', sub: 'Garantia, escritura, frete e seguro', href: '/e/how-it-works' },
    ] },
  ]
  return (
    <div className="ha-page">
      {view === 'menu' ? <div className="ha-page__head"><h1 className="ha-h1">Perfil</h1></div> : null}
      <CollectorAccount key={view} initials={initialsOf(user.name)} me={me} sections={sections} view={view} />
    </div>
  )
}

import { requirePanelPage } from '../_session'
import { identityOf } from '@/lib/accounts/identity-server'
import { readPreferences } from '@/lib/accounts/preferences-server'
import { favoritesOf } from '@/lib/community/server'
import { listPaymentMethods, payoutAccountOf } from '@/lib/payment-methods/server'
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import { initialsOf } from '@/lib/profiles/core'
import { devicesOf } from '@/lib/auth/devices-server'
import { addressesOf } from '@/lib/addresses/server'
import { composerInstagram } from '@/lib/instagram/server'
import { CollectorAccount, type CollectorAccountSection } from '@/components/collector/CollectorAccount'
import { accountShapeOf } from '@/lib/profiles/account-core'
import '@/components/gallery/account.css'

export const metadata = { title: 'Minha conta — HouseArt' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default async function CollectorAccountPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, nav } = await requirePanelPage('/account')
  // each profile its own blocks: the artist never meets the collector register, the desk no wallet
  const shape = accountShapeOf(nav)
  const view = (await searchParams).view === 'data' ? 'data' : 'menu'
  const [identity, prefs, favorites, cards, payout, ig, addresses, devices] = await Promise.all([
    identityOf(user.id),
    readPreferences(user.id),
    shape.work?.items.some((i) => i.href === '/favorites') ? favoritesOf(user.id).catch(() => []) : [],
    shape.payments ? listPaymentMethods(user.id).catch(() => []) : [],
    shape.payout && user.memberId ? payoutAccountOf(user.memberId).catch(() => null) : null,
    shape.social ? composerInstagram(user.id) : null,
    shape.addresses ? addressesOf(user.id).catch(() => []) : [],
    devicesOf(user.id, user.sessionId).then((d) => d.length).catch(() => 1),
  ])
  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0]
  const me = { name: user.name, email: user.email, emailVerified: identity.emailVerified, phoneMask: identity.phoneMask, phoneVerified: identity.phoneVerified, cpfMask: identity.cpfMask, city: identity.city, about: identity.about, avatarUrl: identity.avatarUrl }
  const favoritesSub = `${plural(favorites.filter((f) => f.saved).length, 'favorito', 'favoritos')} · ${plural(favorites.filter((f) => f.liked).length, 'curtida', 'curtidas')}`
  const cadastro: CollectorAccountSection = { name: 'Cadastro', items: [
    { kind: 'link', icon: 'person', name: 'Dados pessoais', sub: [user.email, identity.phoneMask].filter(Boolean).join(' · '), href: '/account?view=data' },
    ...(shape.addresses ? [{ kind: 'link' as const, icon: 'local_shipping', name: 'Endereços de entrega', sub: addresses.length ? `${addresses.find((a) => a.isDefault)?.label ?? addresses[0]!.label} · ${addresses.length === 1 ? '1 endereço' : `${addresses.length} endereços`}` : 'Nenhum endereço salvo', href: '/account/addresses' }] : []),
    { kind: 'link', icon: 'verified_user', name: 'E-mail e celular', sub: `${identity.emailVerified ? 'E-mail verificado' : 'E-mail não verificado'}${identity.phoneMask ? ` · celular ${identity.phoneVerified ? 'verificado' : 'não verificado'}` : ''}`, href: '/account?view=data' },
  ] }
  const payments: CollectorAccountSection = { name: 'Pagamentos', items: [
    ...(shape.payments ? [
      { kind: 'link' as const, icon: 'credit_card', name: 'Carteira e cartões', sub: cards.length ? `${plural(cards.length, 'cartão', 'cartões')}${defaultCard ? ` · padrão ${defaultCard.brandLabel} •••• ${defaultCard.last4}` : ''}` : 'Nenhum cartão salvo', href: '/wallet/cards' },
      { kind: 'link' as const, icon: 'receipt_long', name: 'Notas e comprovantes', sub: 'Compras, serviços e taxas pagas', href: '/account/receipts' },
    ] : []),
    ...(shape.payout ? [{ kind: 'link' as const, icon: 'account_balance', name: 'Pix para receber vendas', sub: payout ? `Cadastrado · ${PIX_KEY_TYPE_LABELS[payout.pixKeyType as PixKeyType] ?? payout.pixKeyType}` : 'Não cadastrado', href: '/sales/payout' }] : []),
  ] }
  const sections: CollectorAccountSection[] = [
    cadastro,
    ...(shape.work ? [{ name: shape.work.name, items: shape.work.items.map((i) => ({ kind: 'link' as const, ...i, sub: i.href === '/favorites' ? favoritesSub : i.sub })) }] : []),
    ...(payments.items.length ? [payments] : []),
    ...(shape.social ? [{ name: 'Redes sociais', items: [
      { kind: 'link' as const, icon: 'photo_camera', name: 'Instagram', sub: !ig || ig.mode === 'OFF' ? 'Em breve: postar também no seu Instagram' : ig.handle ? `${ig.handle} · conectado` : 'Conecte para postar também fora da HouseArt', href: '/instagram' },
    ] }] : []),
    { name: 'Segurança e privacidade', items: [
      { kind: 'link', icon: 'password', name: 'Alterar senha', sub: 'Enviamos um link para o seu e-mail', href: '/recover-password' },
      { kind: 'link', icon: 'devices', name: 'Aparelhos conectados', sub: devices === 1 ? 'Só este aparelho' : `${devices} aparelhos com a conta aberta`, href: '/account/devices' },
    ] },
    { name: 'Notificações', items: [
      { kind: 'link', icon: 'notifications', name: 'Avisos', sub: 'Ofertas, mensagens e entregas', href: '/notifications' },
      { kind: 'switch', icon: 'mail', name: 'Novidades por e-mail', sub: 'Aberturas e obras de quem você segue', key: 'marketingOptIn', on: prefs.marketingOptIn },
    ] },
    { name: 'Ajuda', items: [
      { kind: 'link', icon: 'support_agent', name: 'Falar com a HouseArt', sub: process.env.SUPPORT_EMAIL?.trim() ? `Atendimento por e-mail · ${process.env.SUPPORT_EMAIL.trim()}` : 'Como chegar ao atendimento', href: process.env.SUPPORT_EMAIL?.trim() ? `mailto:${process.env.SUPPORT_EMAIL.trim()}` : '/e/how-it-works#suporte' },
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

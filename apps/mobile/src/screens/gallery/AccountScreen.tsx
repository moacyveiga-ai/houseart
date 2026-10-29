// Conta, equipe e repasses (handoff "HouseArt App Galeria" › conta › menu):
// the sections Galeria · Recebimentos · Plano e pagamentos · Segurança · Ajuda,
// each row with icon, name, sub-line and chevron. Equipe and Artistas are
// native; the rest opens the site. Counts: GET /api/gallery/team and
// GET /api/gallery/artists (the artists route is 404 without a gallery tenant).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import type { RepresentedArtist, TeamPerson } from '@/api/gallery'
import { useSession } from '@/auth/session'
import { theme } from '@/theme'
import { Avatar, Icon, TopBar, type IconName } from '@/ui/kit'
import { avatarTint, initialsOf } from '@/ui/format'
import { plural } from './gallery-core'
import { rolePermissions } from './role-core'

interface Item { icon: IconName; name: string; sub: string; go: () => void }

export function AccountScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const can = rolePermissions(me?.teamRole)
  const team = useApi<{ ok: boolean; people: TeamPerson[] }>(can.manageTeam ? '/api/gallery/team' : null)
  const artists = useApi<{ ok: boolean; artists: RepresentedArtist[] }>('/api/gallery/artists')
  const people = team.data?.people ?? []
  const members = people.filter((p) => p.kind === 'MEMBER').length
  const invites = people.length - members
  const list = artists.data?.artists ?? []
  const web = (path: string, title: string) => () => router.push({ pathname: '/web', params: { path, title } })

  const sections: { name: string; items: Item[] }[] = [
    { name: 'Galeria', items: [
      { icon: 'person', name: 'Perfil', sub: me ? `${me.name} · ${me.email}` : 'Dados da conta e perfis', go: () => router.push('/settings') },
      ...(!can.manageTeam ? [] : [{ icon: 'groups' as IconName, name: 'Equipe', sub: team.data ? `${plural(members, 'pessoa', 'pessoas')}${invites ? ` · ${plural(invites, 'convite pendente', 'convites pendentes')}` : ''}` : 'Papéis e convites', go: () => router.push('/gallery/team') }]),
      { icon: 'palette', name: 'Artistas representados', sub: artists.data ? `${plural(list.length, 'artista', 'artistas')} · ${plural(list.filter((a) => a.contract).length, 'contrato ativo', 'contratos ativos')}` : 'Contratos e divisão das vendas', go: () => router.push('/gallery/artists') },
    ] },
    { name: 'Recebimentos', items: [{ icon: 'account-balance', name: 'Pix para repasses', sub: 'A chave que recebe cada venda', go: () => router.push('/sales/payout' as never) }] },
    { name: 'Plano e pagamentos', items: [
      { icon: 'workspace-premium', name: 'Plano e cobrança', sub: 'Plano, uso do mês e faturas', go: web('/billing', 'Plano e cobrança') },
      { icon: 'account-balance-wallet', name: 'Carteira e cartões', sub: 'Cartão para plano e serviços', go: () => router.push('/wallet/cards' as never) },
    ] },
    { name: 'Segurança', items: [{ icon: 'password', name: 'Alterar senha', sub: 'Enviamos um link para o seu e-mail', go: web('/recover-password', 'Alterar senha') }] },
    { name: 'Ajuda', items: [{ icon: 'help', name: 'Central de ajuda', sub: 'Certificado, propostas, garantia e repasses', go: web('/e/help', 'Ajuda') }] },
  ]

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Conta da galeria" />
      <ScrollView contentContainerStyle={styles.body}>
        {me ? (
          <View style={styles.who}>
            <Avatar initials={initialsOf(me.name)} bg={avatarTint(me.name).bg} fg={avatarTint(me.name).fg} size={48} />
            <View style={{ flex: 1 }}><Text style={styles.whoName}>{me.name}</Text><Text style={styles.sub}>{me.email}</Text></View>
          </View>
        ) : null}
        {sections.map((s) => (
          <View key={s.name} style={styles.section}>
            <Text style={styles.sectionName}>{s.name}</Text>
            {s.items.map((it) => (
              <Pressable key={it.name} accessibilityRole="button" onPress={it.go} style={styles.row}>
                <Icon name={it.icon} size={22} />
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name}>{it.name}</Text><Text style={styles.sub} numberOfLines={1}>{it.sub}</Text></View>
                <Icon name="chevron-right" size={20} color={theme.fgMuted} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 18 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  whoName: { fontSize: 16, fontWeight: '600', color: theme.fg },
  section: { gap: 2 },
  sectionName: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.fgMuted, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
})

// Equipe (handoff "HouseArt App Galeria" › lista › Equipe): the intro line, a
// row per person (avatar · name · role line · pill Admin/Vendas/Acervo/Pendente)
// and "Convidar pessoa" (e-mail + role). Tapping a member opens the sheet to
// change the role or remove; a pending invite can be revoked. Only the
// gallery admin manages: the API answers 403 to the rest and the app shows
// that message. Routes: GET/POST /api/gallery/team, PATCH/DELETE
// /api/gallery/team/[id], DELETE /api/gallery/team/invites/[id].
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { inviteToTeam, removeFromTeam, revokeInvite, setTeamRole, TEAM_ROLES, type TeamPerson, type TeamRole } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { BottomSheet, Input, Label, OptionCard } from '@/ui/forms'
import { Avatar, ErrorState, Icon, Loading, Toast, TopBar } from '@/ui/kit'
import { Button } from '@/ui/primitives'
import { initialsOf } from '@/ui/format'

const roleTint = (p: TeamPerson): { bg: string; fg: string } => (p.kind === 'INVITE' ? { bg: colors.paper100, fg: colors.ink500 } : p.role === 'ADMIN' ? { bg: colors.ink900, fg: colors.paper50 } : { bg: colors.paper200, fg: colors.ink900 })
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

export function TeamScreen() {
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ ok: boolean; people: TeamPerson[] }>('/api/gallery/team')
  const [people, setPeople] = useState<TeamPerson[]>([])
  useEffect(() => { if (data) setPeople(data.people) }, [data])
  const [sheet, setSheet] = useState<'invite' | 'person' | null>(null)
  const [picked, setPicked] = useState<TeamPerson | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('SALES')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  async function run(fn: () => Promise<TeamPerson[]>, done: string) {
    if (busy) return
    setBusy(true)
    try { setPeople(await fn()); setSheet(null); setToast(done) } catch (e) { setToast((e as Error).message || 'Não foi possível concluir.') } finally { setBusy(false) }
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Equipe" />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>Cada pessoa vê só o que o papel permite.</Text>
          {people.map((p) => {
            const tint = roleTint(p)
            return (
              <Pressable key={`${p.kind}-${p.id}`} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => { setPicked(p); setRole(p.role); setSheet('person') }} style={styles.row}>
                <Avatar initials={p.kind === 'INVITE' ? initialsOf(p.name.replace(/@.*/, '').replace(/[._-]/g, ' ')) : initialsOf(p.name)} bg={tint.bg} fg={tint.fg} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name} numberOfLines={1}>{p.name}{p.isSelf ? ' · você' : ''}</Text><Text style={styles.sub} numberOfLines={1}>{p.sub}</Text></View>
                <View style={[styles.pill, { backgroundColor: p.kind === 'INVITE' ? colors.pending100 : colors.paper200 }]}><Text style={styles.pillText}>{p.roleLabel}</Text></View>
              </Pressable>
            )
          })}
          {people.length === 0 ? <Text style={styles.sub}>Só você por enquanto. Convide a equipe da galeria.</Text> : null}
        </ScrollView>
      )}
      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable accessibilityRole="button" onPress={() => { setEmail(''); setRole('SALES'); setSheet('invite') }} style={styles.cta}><Icon name="add" size={20} color={theme.bg} /><Text style={styles.ctaText}>Convidar pessoa</Text></Pressable>
      </View>

      <BottomSheet open={sheet === 'invite'} title="Convidar pessoa" onClose={() => setSheet(null)} height="70%"
        footer={<Button title="Enviar convite" loading={busy} disabled={!validEmail(email)} onPress={() => void run(() => inviteToTeam(email.trim(), role), 'Convite enviado por e-mail')} />}>
        <Label>E-mail</Label>
        <Input value={email} onChangeText={setEmail} placeholder="pessoa@galeria.com.br" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoFocus />
        <Label>Papel</Label>
        {TEAM_ROLES.map((r) => <OptionCard key={r.key} on={role === r.key} name={r.name} sub={r.sub} onPress={() => setRole(r.key)} />)}
        <Text style={styles.sub}>A pessoa entra (ou cria a conta com este e-mail) e aceita o convite em até 7 dias.</Text>
      </BottomSheet>

      <BottomSheet open={sheet === 'person' && !!picked} title={picked?.name ?? ''} onClose={() => setSheet(null)} height="70%"
        footer={picked?.kind === 'INVITE'
          ? <Button title="Cancelar convite" variant="danger" loading={busy} onPress={() => picked && void run(() => revokeInvite(picked.id), 'Convite cancelado')} />
          : picked && !picked.isSelf ? (
            <>
              <Button title="Salvar papel" loading={busy} disabled={role === picked.role} onPress={() => void run(() => setTeamRole(picked.id, role), `Papel de ${picked.name.split(' ')[0]}: ${TEAM_ROLES.find((r) => r.key === role)?.name ?? role}`)} />
              <Button title="Remover da equipe" variant="danger" loading={busy} onPress={() => void run(() => removeFromTeam(picked.id), `${picked.name.split(' ')[0]} saiu da equipe`)} />
            </>
          ) : null}>
        {picked?.kind === 'INVITE' ? <Text style={styles.sub}>{picked.sub}. O convite vale 7 dias; cancelar não avisa a pessoa.</Text> : picked ? (
          <>
            <Text style={styles.sub}>{picked.isSelf ? 'Você não pode mudar o próprio papel nem sair da própria galeria.' : 'Escolha o que a pessoa vê e faz.'}</Text>
            {TEAM_ROLES.map((r) => <OptionCard key={r.key} on={role === r.key} name={r.name} sub={r.sub} disabled={picked.isSelf} onPress={() => setRole(r.key)} />)}
          </>
        ) : null}
      </BottomSheet>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 24, gap: 4 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.fgMuted, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.fg },
  foot: { padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  cta: { height: 50, borderRadius: theme.radiusMd, backgroundColor: theme.fg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ctaText: { color: theme.bg, fontWeight: '600', fontSize: 15 },
})

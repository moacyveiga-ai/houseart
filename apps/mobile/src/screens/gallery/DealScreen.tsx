// Venda até o repasse (handoff "HouseArt App Galeria" › venda): the artwork,
// the buyer, the current stage and its text, the six steps, the split of the
// values and the action of the stage — sign the transfer agreement (ESCROW) or
// register the shipping (DOCUMENTS, carrier · tracking · insurer). Data: the
// deal of GET /api/gallery/deals by id; writes: POST /api/deals/[id]/{sign,shipping}.
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { bookShipping, signDeal, type DealView } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { Input, Label } from '@/ui/forms'
import { Avatar, Display, ErrorState, Icon, Loading, Toast, TopBar, Wall, type IconName } from '@/ui/kit'
import { Button } from '@/ui/primitives'
import { avatarTint, brl, initialsOf } from '@/ui/format'
import { dealStageTitle, marketShare, symbolIcon } from './gallery-core'

export function DealScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const dealId = Number(id)
  const { data, error, loading, reload } = useApi<{ ok: boolean; deals: DealView[] }>('/api/gallery/deals')
  const d = data?.deals.find((x) => x.id === dealId) ?? null
  const [ship, setShip] = useState({ carrier: '', tracking: '', insurer: '' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  async function run(fn: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(true)
    try { await fn(); setToast(done); await reload() } catch (e) { setToast((e as Error).message || 'Não foi possível concluir.') } finally { setBusy(false) }
  }

  const stageText = (x: DealView): string => {
    if (x.phase === 'COMPLETED') { const g = x.split.find((s) => s.party === 'GALLERY') ?? x.split.find((s) => s.party === 'ARTIST' || s.party === 'ADVISOR' || s.party === 'COLLECTOR'); return `Venda concluída. ${g ? `Repasse de ${brl(g.amountCents)} liberado.` : 'Repasses liberados.'}` }
    const on = x.steps.find((s) => s.state === 'on')
    return on ? `${on.description}.` : ''
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title={d ? `Venda · ${d.code}` : 'Venda'} />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : !d ? <ErrorState message="Negócio não encontrado." onRetry={() => router.back()} /> : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Wall uri={d.cover} padding={8} style={styles.headWall} square={false} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display italic size={18} line={24} numberOfLines={2}>{d.artworkTitle}</Display>
              <Text style={styles.muted}>{d.artist} · {d.market === 'PRIMARY' ? 'Venda' : 'Revenda'} · {brl(d.amountCents)}</Text>
            </View>
          </View>
          <View style={styles.buyer}>
            <Avatar initials={initialsOf(d.buyerName)} bg={avatarTint(d.buyerName).bg} fg={avatarTint(d.buyerName).fg} size={40} />
            <View style={{ flex: 1 }}><Text style={styles.buyerName}>{d.buyerName}</Text><Text style={styles.muted}>Comprador{d.shipping ? ` · ${d.shipping.carrier}${d.shipping.tracking ? ` · rastreio ${d.shipping.tracking}` : ''}` : ''}</Text></View>
          </View>
          <View style={styles.stage}>
            <Text style={styles.stageTitle}>{dealStageTitle(d)}</Text>
            <Text style={styles.stageText}>{stageText(d)}</Text>
          </View>

          <View style={styles.steps}>
            {d.steps.map((s, i) => {
              const done = s.state === 'done'; const on = s.state === 'on'
              return (
                <View key={s.phase} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.dot, done ? { backgroundColor: theme.success } : on ? { backgroundColor: theme.accent } : { borderWidth: 1, borderColor: theme.fgDisabled }]}><Icon name={done ? 'check' : (symbolIcon(s.icon) as IconName)} size={16} color={done ? theme.bg : theme.fg} /></View>
                    {i < d.steps.length - 1 ? <View style={[styles.line, { backgroundColor: done ? theme.success : theme.border }]} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}><Text style={[styles.stepName, on && { fontWeight: '600' }]}>{s.title}</Text><Text style={styles.muted}>{s.description}{s.date ? ` · ${s.date}` : ''}</Text></View>
                </View>
              )
            })}
          </View>

          <View style={styles.fin}>
            <View style={styles.finRow}><Text style={styles.finK}>Valor da venda</Text><Text style={[styles.finV, { fontWeight: '600' }]}>{brl(d.amountCents)}</Text></View>
            {d.split.map((s) => (
              <View key={s.party} style={styles.finRow}><Text style={styles.finK}>{s.label}{s.party === 'PLATFORM' ? ` · ${marketShare(d.market)}` : ''}</Text><Text style={styles.finV}>{brl(s.amountCents)} · {s.status === 'RELEASED' ? 'liberado' : 'em garantia'}</Text></View>
            ))}
          </View>

          {d.phase === 'ESCROW' && !d.sellerSigned ? <Button title="Assinar o termo de transferência" loading={busy} onPress={() => void run(() => signDeal(d.id), 'Termo assinado')} /> : null}
          {d.phase === 'ESCROW' && d.sellerSigned && !d.buyerSigned ? <Text style={styles.muted}>Aguardando a assinatura do comprador.</Text> : null}
          {d.phase === 'DOCUMENTS' ? (
            <View style={styles.form}>
              <Label>Transportadora</Label><Input value={ship.carrier} onChangeText={(v) => setShip({ ...ship, carrier: v })} placeholder="Nome da transportadora" />
              <Label>Rastreio</Label><Input value={ship.tracking} onChangeText={(v) => setShip({ ...ship, tracking: v })} placeholder="Código de rastreio" autoCapitalize="characters" />
              <Label hint="opcional">Seguradora</Label><Input value={ship.insurer} onChangeText={(v) => setShip({ ...ship, insurer: v })} placeholder="Seguro de trânsito" />
              <Button title="Registrar envio" loading={busy} disabled={ship.carrier.trim().length < 2 || ship.tracking.trim().length < 2} onPress={() => void run(() => bookShipping(d.id, { carrier: ship.carrier.trim(), tracking: ship.tracking.trim(), insurer: ship.insurer.trim() || undefined }), 'Envio registrado · o comprador recebeu o rastreio')} />
            </View>
          ) : null}
          {d.phase === 'DELIVERY' ? <View style={styles.note}><Icon name="contactless" size={20} color={colors.pending500} /><Text style={styles.noteText}>Aguardando o toque do comprador na etiqueta para liberar o repasse.</Text></View> : null}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headWall: { width: 72, height: 72 },
  muted: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  buyer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyerName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  stage: { padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.surface, gap: 4 },
  stageTitle: { fontSize: 15, fontWeight: '600', color: theme.fg },
  stageText: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  steps: {},
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { width: 28, alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  line: { flex: 1, width: 2, marginVertical: 2 },
  stepName: { fontSize: 14, color: theme.fg },
  fin: { borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  finK: { flex: 1, fontSize: 13, color: theme.fgMuted },
  finV: { fontSize: 13, color: theme.fg, fontVariant: ['tabular-nums'] },
  form: { gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radiusMd, backgroundColor: colors.pending100 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fg },
})

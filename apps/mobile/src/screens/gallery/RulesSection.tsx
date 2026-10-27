// Regras de ofertas (handoff "HouseArt App Galeria" › Negócios › Regras,
// `rgItens`): four items with a toggle; the first and the third open chips.
// Every change is a partial PUT /api/gallery/rules; the server's answer is
// the state (a refused change rolls back with the server's message).
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useApi } from '@/api/hooks'
import { REFUSE_BELOW_OPTIONS, RESPONSE_HOURS_OPTIONS, saveOfferRules, type OfferRules } from '@/api/gallery'
import { theme } from '@/theme'
import { Toggle } from '@/ui/forms'
import { Chip, ErrorState, Loading } from '@/ui/kit'

const pct = (bps: number) => `${Math.round(bps / 100)}%`

/** `onToast` receives the confirmation lines; the screen that hosts the section draws the toast. */
export function RulesSection({ onToast }: { onToast: (message: string) => void }) {
  const { data, error, loading, reload } = useApi<{ ok: boolean; rules: OfferRules }>('/api/gallery/rules')
  const [rules, setRules] = useState<OfferRules | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setRules(data.rules) }, [data])

  async function save(patch: Partial<OfferRules>, done: string) {
    if (!rules || busy) return
    const before = rules
    setRules({ ...rules, ...patch })
    setBusy(true)
    try { setRules(await saveOfferRules(patch)); onToast(done) } catch (e) { setRules(before); onToast((e as Error).message || 'Não foi possível salvar a regra.') } finally { setBusy(false) }
  }

  if (loading && !rules) return <Loading />
  if (error && !rules) return <ErrorState message={error} onRetry={reload} />
  if (!rules) return null

  const items: { key: string; name: string; sub: string; on: boolean; locked?: boolean; toggle?: () => void; ops?: { label: string; on: boolean; go: () => void }[] }[] = [
    {
      key: 'refuse', name: 'Recusar ofertas baixas', sub: `Abaixo de ${pct(rules.refuseBelowBps)} do preço, recusamos com uma mensagem gentil`, on: rules.refuseLow,
      toggle: () => save({ refuseLow: !rules.refuseLow }, rules.refuseLow ? 'Ofertas baixas passam a chegar para você responder' : `Ofertas abaixo de ${pct(rules.refuseBelowBps)} são recusadas automaticamente`),
      ops: rules.refuseLow ? REFUSE_BELOW_OPTIONS.map((bps) => ({ label: pct(bps), on: rules.refuseBelowBps === bps, go: () => save({ refuseBelowBps: bps }, `Mínimo para recusar: ${pct(bps)} do preço`) })) : undefined,
    },
    {
      key: 'auto', name: 'Aceitar automaticamente', sub: `Ofertas a partir de ${pct(rules.autoAcceptMinBps)} do preço são aceitas na hora`, on: rules.autoAcceptOn,
      toggle: () => save({ autoAcceptOn: !rules.autoAcceptOn }, rules.autoAcceptOn ? 'Nenhuma oferta é aceita sem você' : `Ofertas a partir de ${pct(rules.autoAcceptMinBps)} do preço são aceitas na hora`),
    },
    {
      key: 'hours', name: 'Prazo para responder', sub: 'Depois disso, a oferta expira e o comprador é avisado', on: true, locked: true,
      ops: RESPONSE_HOURS_OPTIONS.map((h) => ({ label: `${h} h`, on: rules.responseHours === h, go: () => save({ responseHours: h }, `Prazo para responder: ${h} h`) })),
    },
    {
      key: 'team', name: 'Avisar a equipe de vendas', sub: 'Quem tem o papel Vendas recebe as ofertas junto com você', on: rules.notifyTeam,
      toggle: () => save({ notifyTeam: !rules.notifyTeam }, rules.notifyTeam ? 'Só você recebe as ofertas' : 'A equipe de vendas recebe as ofertas junto com você'),
    },
  ]

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>Regras valem para todas as obras da galeria que aceitam ofertas. Na página da obra você escolhe se ela aceita ofertas.</Text>
      {items.map((it) => (
        <View key={it.key} style={styles.item}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.name}>{it.name}</Text><Text style={styles.sub}>{it.sub}</Text></View>
            <View style={it.locked ? { opacity: 0.6 } : undefined}><Toggle on={it.on} label={it.name} onPress={() => { if (!it.locked) it.toggle?.() }} /></View>
          </View>
          {it.ops ? <View style={styles.ops}>{it.ops.map((o) => <Chip key={o.label} label={o.label} on={o.on} onPress={o.go} />)}</View> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.fgMuted },
  item: { gap: 10, padding: 14, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  ops: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})

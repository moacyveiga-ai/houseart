// Novo post (handoff "HouseArt App Colecionador" › sheet `post`): the text
// "Conte a história de uma obra…", "Marcar uma obra da sua coleção · opcional"
// (the wallet), the kinds the API accepts (texto · foto · enquete · evento)
// and "Publicar na comunidade". POST /api/community/posts.
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api } from '@/api/client'
import type { WalletItem } from '@/api/types'
import { theme } from '@/theme'
import { BottomSheet, Input, Label } from '@/ui/forms'
import { Chip, Display, Icon, Wall } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { COMPOSER_KINDS, CONTACT_LINE, EMPTY_DRAFT, draftPayload, draftReady, formatDateInput, hasContact, isoDateOf, type ComposerDraft } from './community-core'

export function Composer({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const [d, setD] = useState<ComposerDraft>(EMPTY_DRAFT)
  const [dateText, setDateText] = useState('')
  const [works, setWorks] = useState<WalletItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<ComposerDraft>) => { setD((x) => ({ ...x, ...p })); setError(null) }

  useEffect(() => { if (open) { setD(EMPTY_DRAFT); setDateText(''); setError(null); api<{ items: WalletItem[] }>('/api/collector/wallet').then((r) => setWorks(r.items)).catch(() => setWorks([])) } }, [open])

  async function publish() {
    if (!draftReady(d) || busy) return
    if (hasContact(d.body) || d.pollOptions.some(hasContact)) { setError('Tire telefones, e-mails e links para publicar. ' + CONTACT_LINE); return }
    setBusy(true); setError(null)
    try { await api('/api/community/posts', { body: draftPayload(d) }); onPosted() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} title="Novo post" onClose={onClose} height="86%" footer={<Button title="Publicar na comunidade" loading={busy} disabled={!draftReady(d)} onPress={() => void publish()} />}>
      <View style={styles.kinds}>{COMPOSER_KINDS.map((k) => <Chip key={k.key} label={k.label} icon={k.icon} on={d.kind === k.key} onPress={() => set({ kind: k.key })} />)}</View>
      <Input value={d.body} onChangeText={(v) => set({ body: v })} multiline maxLength={1500} placeholder={d.kind === 'POLL' ? 'Qual é a pergunta da enquete?' : 'Conte a história de uma obra, mostre a parede de casa, pergunte à comunidade…'} />
      {d.kind === 'TEXT' || d.kind === 'PHOTO' ? (<>
        <Label hint="opcional">Marcar uma obra da sua coleção</Label>
        {works.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {works.map((w) => (
              <Pressable key={w.artworkId} accessibilityRole="button" accessibilityState={{ selected: d.artworkId === w.artworkId }} onPress={() => set({ artworkId: d.artworkId === w.artworkId ? null : w.artworkId })} style={[styles.work, d.artworkId === w.artworkId && { borderColor: theme.fg }]}>
                <Wall uri={w.cover} padding={6} style={styles.workWall} />
                <Display italic size={12} line={15} numberOfLines={1}>{w.title}</Display>
              </Pressable>
            ))}
          </ScrollView>
        ) : <Text style={styles.note}>Você ainda não tem obras na coleção.</Text>}
        <Text style={styles.note}>Obras marcadas mostram o certificado. Se estiver à venda, o post leva direto à página da obra.</Text>
        {d.kind === 'PHOTO' ? (<><Label hint="ou a obra marcada">Endereço da imagem</Label><Input value={d.imageUrl} onChangeText={(v) => set({ imageUrl: v })} autoCapitalize="none" placeholder="https://…" /></>) : null}
      </>) : null}
      {d.kind === 'POLL' ? (<>
        <Label>Opções · 2 a 4</Label>
        {d.pollOptions.map((o, i) => <Input key={i} value={o} onChangeText={(v) => set({ pollOptions: d.pollOptions.map((x, j) => (j === i ? v : x)) })} maxLength={40} placeholder={`Opção ${i + 1}`} />)}
        {d.pollOptions.length < 4 ? <Pressable accessibilityRole="button" onPress={() => set({ pollOptions: [...d.pollOptions, ''] })} style={styles.add}><Icon name="add" size={18} /><Text style={styles.addText}>Mais uma opção</Text></Pressable> : null}
      </>) : null}
      {d.kind === 'EVENT' ? (<>
        <Label>Título do evento</Label><Input value={d.event.title} onChangeText={(v) => set({ event: { ...d.event, title: v } })} maxLength={120} placeholder="Abertura · Construções" />
        <Label>Local</Label><Input value={d.event.venue} onChangeText={(v) => set({ event: { ...d.event, venue: v } })} maxLength={160} placeholder="Galeria Ladeira, Santo Antônio Além do Carmo" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Label>Data</Label><Input value={dateText} onChangeText={(v) => { const t = formatDateInput(v); setDateText(t); set({ event: { ...d.event, startsOn: isoDateOf(t) } }) }} inputMode="numeric" placeholder="dd/mm/aaaa" /></View>
          <View style={{ flex: 1 }}><Label hint="opcional">Hora</Label><Input value={d.event.startsAt} onChangeText={(v) => set({ event: { ...d.event, startsAt: v.slice(0, 10) } })} placeholder="19h" /></View>
        </View>
      </>) : null}
      <ErrorText>{error}</ErrorText>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  work: { width: 96, gap: 4, padding: 4, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: 'transparent' },
  workWall: { width: 88, height: 88 },
  note: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  row: { flexDirection: 'row', gap: 10 },
})

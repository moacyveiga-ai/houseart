// Cadastrar obra do colecionador (handoff "HouseArt App Colecionador" ›
// Cadastrar obra, `cadobra`): three steps — the origin (the three cards of
// ACQUISITION_KIND_CARDS), the artist (public search with suggestions, or
// "Não está na lista: escrever o nome") and the acquisition (title, year, from
// whom, what was paid — it stays with the person —, a note). POST
// /api/collector/artworks creates the draft; the guided camera of the App
// Artista (/artworks/new?id=…&owner=collector) takes the photos and the quick
// sheet, and sends the artwork to certification.
import { useEffect, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { registerArtwork } from '@/api/collector'
import type { SearchResult } from '@/api/types'
import { theme } from '@/theme'
import { Input, Label, OptionCard, Segments } from '@/ui/forms'
import { Avatar, Display, Icon, IconButton } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { absUrl, avatarTint, initialsOf } from '@/ui/format'
import { priceMask } from '../gallery/gallery-core'
import { ACQUISITION_CARDS, REGISTER_STEPS, registerBody, type RegisterForm } from './collector-core'

type ArtistHit = SearchResult['artists'][number]

export function RegisterArtworkScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const [f, setF] = useState<RegisterForm>({ kind: null, artistName: '', title: '', year: '', from: '', paid: '', note: '' })
  const set = (p: Partial<RegisterForm>) => { setF((x) => ({ ...x, ...p })); setError(null) }
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<{ term: string; hits: ArtistHit[] }>({ term: '', hits: [] })
  const [picked, setPicked] = useState('')
  const [free, setFree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let gone = false
    const t = setTimeout(() => {
      api<SearchResult>(`/api/public/search?q=${encodeURIComponent(term)}`, { anonymous: true })
        .then((d) => { if (!gone) setAnswer({ term, hits: (d.artists ?? []).slice(0, 8) }) })
        .catch(() => { if (!gone) setAnswer({ term, hits: [] }) })
    }, 250)
    return () => { gone = true; clearTimeout(t) }
  }, [q])
  const term = q.trim()
  const searching = term.length >= 2 && answer.term !== term
  const hits = answer.term === term ? answer.hits : []

  const artistName = free ? f.artistName.trim() : picked
  const ok = step === 0 ? !!f.kind : step === 1 ? artistName.length >= 2 : true

  async function submit() {
    const b = registerBody({ ...f, artistName })
    if (!b.ok) { setError(b.error); return }
    setBusy(true); setError(null)
    try {
      const r = await registerArtwork(b.body)
      router.replace({ pathname: '/artworks/new', params: { id: String(r.id), owner: 'collector' } })
    } catch (e) { setError((e as Error).message || 'Não foi possível cadastrar agora.') } finally { setBusy(false) }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton name={step === 0 ? 'close' : 'arrow-back'} label={step === 0 ? 'Fechar' : 'Voltar'} onPress={() => (step === 0 ? router.back() : setStep(step - 1))} />
        <Text style={styles.step}>Passo {step + 1} de 3</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.headPad}>
        <Segments total={3} current={step + 1} />
        <Display size={24} line={31} style={{ marginTop: 14 }}>{REGISTER_STEPS[step]![0]}</Display>
        <Text style={styles.lead}>{REGISTER_STEPS[step]![1]}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? ACQUISITION_CARDS.map((c) => (
          <OptionCard key={c.key} on={f.kind === c.key} icon={c.icon} name={c.name} sub={c.description} onPress={() => set({ kind: c.key })} />
        )) : null}

        {step === 1 ? (<>
          {!free ? (
            <View style={styles.field}>
              <Label>Artista</Label>
              <View style={styles.search}>
                <Icon name="search" size={20} color={theme.fgMuted} />
                <Input value={q} onChangeText={(t) => { setQ(t); setPicked('') }} placeholder="Nome do artista" autoCorrect={false} style={styles.searchInput} />
              </View>
            </View>
          ) : null}
          {picked && !free ? (
            <View style={styles.picked}><Icon name="check-circle" size={18} color={theme.success} /><Text style={styles.pickedText}>{picked}</Text><Pressable accessibilityRole="button" onPress={() => { setPicked(''); setQ('') }}><Text style={styles.link}>Trocar</Text></Pressable></View>
          ) : null}
          {!free && !picked && term.length >= 2 ? (
            <View style={styles.sugg} accessibilityRole="list">
              {searching && hits.length === 0 ? <Text style={styles.suggMuted}>Buscando…</Text> : null}
              {!searching && hits.length === 0 ? <Text style={styles.suggMuted}>Nenhum artista com esse nome na HouseArt.</Text> : null}
              {hits.map((h) => {
                const tint = avatarTint(h.name)
                const photo = absUrl(h.photoUrl)
                return (
                  <Pressable key={h.slug} accessibilityRole="button" onPress={() => { setPicked(h.name); setQ(h.name) }} style={styles.suggRow}>
                    {photo ? <Image source={{ uri: photo }} style={styles.av} /> : <Avatar initials={initialsOf(h.name)} bg={tint.bg} fg={tint.fg} size={36} />}
                    <View style={{ flex: 1 }}><Text style={styles.suggName}>{h.name}</Text>{h.meta ? <Text style={styles.suggMeta}>{h.meta}</Text> : null}</View>
                    <Icon name="chevron-right" size={22} color={theme.fgMuted} />
                  </Pressable>
                )
              })}
            </View>
          ) : null}
          <OptionCard on={free} icon="edit" name="Não está na lista: escrever o nome" sub="O artista nasce sem verificação e a equipe confere na certificação." onPress={() => { setFree(!free); setPicked('') }} />
          {free ? <View style={styles.field}><Label>Nome do artista</Label><Input value={f.artistName} maxLength={120} placeholder="Como aparece na assinatura" onChangeText={(t) => set({ artistName: t })} /></View> : null}
        </>) : null}

        {step === 2 ? (<>
          <View style={styles.field}><Label hint="opcional, dá para completar depois">Título da obra</Label><Input value={f.title} maxLength={200} placeholder="Ex.: Sem título" onChangeText={(t) => set({ title: t })} /></View>
          <View style={styles.two}>
            <View style={[styles.field, { flex: 1 }]}><Label>Ano da aquisição</Label><Input value={f.year} keyboardType="number-pad" maxLength={4} placeholder="Ex.: 2019" onChangeText={(t) => set({ year: t.replace(/\D/g, '').slice(0, 4) })} /></View>
            <View style={[styles.field, { flex: 1 }]}><Label hint="fica só com você">Valor pago</Label>
              <View style={styles.money}><Text style={styles.moneyPre}>R$</Text><Input value={f.paid} keyboardType="number-pad" placeholder="0" onChangeText={(t) => set({ paid: priceMask(t) })} style={styles.moneyInput} /></View>
            </View>
          </View>
          <View style={styles.field}><Label>De quem você adquiriu</Label><Input value={f.from} maxLength={160} placeholder="Galeria, feira, pessoa ou família" onChangeText={(t) => set({ from: t })} /></View>
          <View style={styles.field}><Label hint="opcional">Observações</Label><Input value={f.note} maxLength={500} multiline placeholder="História da obra, exposições, restauros anteriores…" onChangeText={(t) => set({ note: t })} /></View>
          <Text style={styles.next}>Depois: as fotos guiadas e a ficha rápida. A obra vai para a certificação e a escritura sai no seu nome.</Text>
        </>) : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {step < 2
          ? <Button title="Continuar" disabled={!ok} onPress={() => setStep(step + 1)} />
          : <Button title="Cadastrar obra e tirar as fotos" loading={busy} onPress={() => void submit()} />}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  bar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  step: { fontSize: 13, fontWeight: '600', color: theme.fgMuted },
  headPad: { paddingHorizontal: 16, paddingBottom: 6 },
  lead: { marginTop: 4, fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  field: { gap: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingLeft: 10 },
  searchInput: { flex: 1, borderWidth: 0 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickedText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.fg },
  link: { fontSize: 13, fontWeight: '600', color: theme.fg, textDecorationLine: 'underline' },
  sugg: { borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, overflow: 'hidden' },
  suggMuted: { padding: 12, fontSize: 13, color: theme.fgMuted },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  av: { width: 36, height: 36, borderRadius: 18 },
  suggName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  suggMeta: { fontSize: 12, color: theme.fgMuted },
  two: { flexDirection: 'row', gap: 10 },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingLeft: 12 },
  moneyPre: { fontSize: 15, color: theme.fgMuted },
  moneyInput: { flex: 1, borderWidth: 0 },
  next: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  foot: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
})

// Nova obra · câmera guiada (handoff "HouseArt App Artista" › nova + ficha):
// the dark capture screen — close · "Foto N de 6" · the 4:5 frame with the
// sand guide, the corner marks, the colour card on the front shot and the
// focus point on the macros, the shot's name and tip, the strips and the
// shutter — then "Ficha rápida" (thumbnails, Título · Ano · Técnica ·
// Dimensões (cm), "Enviar e vincular etiqueta").
//
// The ten slots are the web "Mídia" step's (`MEDIA_SLOTS`): the prototype's
// six required shots first, then four optional ones that can be skipped.
// Each photo goes up as soon as it is taken (POST /api/artworks/[id]/media,
// multipart); the draft is created on the first photo, or continued with
// `?id=`. The server says the quality (blurry → retake), the similar works
// (duplicate check) and what is missing to submit. After the submit, the
// screen hands over to "Vincular etiqueta".
//
// `owner=collector` (Cadastrar obra do colecionador, App Colecionador): the
// draft comes from POST /api/collector/artworks with `?id=`; after the submit
// the artwork goes to certification and the screen returns to Minha coleção —
// the tag is linked by the certification service, not by the owner.
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { createDraft, decideDuplicate, loadDraft, patchDraft, readPhotos, submitDraft, uploadPhoto, type DraftArtwork } from '@/api/artist'
import { colors, theme } from '@/theme'
import { Display, Icon, IconButton, Toast } from '@/ui/kit'
import { Input, Label } from '@/ui/forms'
import { Button, ErrorText } from '@/ui/primitives'
import { absUrl } from '@/ui/format'
import { CAPTURE_SLOTS, REQUIRED_COUNT, captureCounter, dimensionsText, missingRequired, nextSlot, photoPart, sheetPatch, sheetProblems, type QuickSheet } from './artist-core'

type Phase = 'loading' | 'capture' | 'sheet'
interface Shot { uri: string; quality: string | null }

export function NewArtworkScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string; owner?: string }>()
  const initialId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null
  const collector = params.owner === 'collector'
  const toCollection = useCallback((message?: string) => {
    if (message) Alert.alert('Obra cadastrada', message)
    router.navigate('/wallet' as never)
  }, [router])

  const [phase, setPhase] = useState<Phase>(initialId ? 'loading' : 'capture')
  const [artworkId, setArtworkId] = useState<number | null>(initialId)
  const [shots, setShots] = useState<Record<string, Shot>>({})
  const [index, setIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<QuickSheet>({ title: '', year: '', technique: '', dimensions: '' })
  const [dups, setDups] = useState<DraftArtwork['duplicateChecks']>([])
  const [busy, setBusy] = useState<null | 'save' | 'read' | 'dup'>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const done = new Set(Object.keys(shots))
  const slot = CAPTURE_SLOTS[Math.min(index, CAPTURE_SLOTS.length - 1)]!
  const shot = shots[slot.kind]

  const absorb = useCallback((d: DraftArtwork) => {
    const s: Record<string, Shot> = {}
    for (const m of d.media) { const u = absUrl(m.publicUrl); if (u) s[m.kind] = { uri: u, quality: m.quality } }
    setShots(s)
    setSheet({ title: d.title === 'Nova obra' ? '' : d.title, year: d.year ? String(d.year) : '', technique: d.technique ?? '', dimensions: dimensionsText(d) })
    setDups(d.duplicateChecks ?? [])
    return s
  }, [])

  // Continuing a draft: what is already there, and the first missing shot (or the sheet when the six are done).
  useEffect(() => {
    if (!initialId) return
    let alive = true
    loadDraft(initialId).then((d) => {
      if (!alive) return
      if (d.status !== 'DRAFT') {
        if (collector) { toCollection('Esta obra já foi enviada para certificação.'); return }
        Alert.alert('Nova obra', 'Esta obra já foi enviada para certificação.'); router.replace({ pathname: '/certification/link/[artworkId]', params: { artworkId: String(initialId) } }); return
      }
      const s = absorb(d)
      const missing = missingRequired(new Set(Object.keys(s)))
      if (missing.length === 0) setPhase('sheet')
      else { setIndex(CAPTURE_SLOTS.findIndex((x) => x.kind === missing[0]!.kind)); setPhase('capture') }
    }).catch((e: Error) => { if (alive) { Alert.alert('Nova obra', e.message); router.back() } })
    return () => { alive = false }
  }, [initialId, absorb, router, collector, toCollection])

  async function ensureDraft(): Promise<number> {
    if (artworkId) return artworkId
    const id = await createDraft()
    setArtworkId(id)
    return id
  }

  async function pick(source: 'camera' | 'library') {
    if (uploading) return
    setCaptureError(null)
    let result: ImagePicker.ImagePickerResult
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) { setCaptureError('Permita o uso da câmera nas configurações do aparelho, ou escolha da galeria.'); return }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false })
      }
    } catch {
      setCaptureError(source === 'camera' ? 'A câmera não está disponível neste aparelho. Escolha da galeria.' : 'Não foi possível abrir a galeria.')
      return
    }
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setUploading(true)
    try {
      const id = await ensureDraft()
      const r = await uploadPhoto(id, slot.kind, photoPart(asset, slot.kind))
      const next = { ...shots, [slot.kind]: { uri: absUrl(r.media.publicUrl) ?? asset.uri, quality: r.media.quality } }
      setShots(next)
      if (r.duplicates.length) setDups((cur) => [...cur.filter((c) => !r.duplicates.some((x) => x.id === c.id)), ...r.duplicates.map((x) => ({ id: x.id, similarityBps: x.similarityBps, candidate: { id: x.candidateArtworkId, title: 'Obra já cadastrada', year: null, publicId: null } }))])
      if (r.media.quality === 'BLURRY') { setCaptureError('A foto saiu desfocada. Refaça com o celular firme e mais luz.'); return }
      advance(new Set(Object.keys(next)), index + 1)
    } catch (e) {
      setCaptureError((e as Error).message || 'Não foi possível enviar a foto.')
    } finally { setUploading(false) }
  }

  function advance(have: ReadonlySet<string>, from: number) {
    const n = nextSlot(have, from)
    if (n < CAPTURE_SLOTS.length) { setIndex(n); return }
    const missing = missingRequired(have)
    if (missing.length) { setIndex(CAPTURE_SLOTS.findIndex((x) => x.kind === missing[0]!.kind)); return }
    void goSheet()
  }

  async function goSheet() {
    setPhase('sheet')
    if (!artworkId) return
    try { const d = await loadDraft(artworkId); setDups(d.duplicateChecks ?? []) } catch { /* the sheet still works; the submit says what is missing */ }
  }

  function close() {
    if (!artworkId) { router.back(); return }
    Alert.alert('Sair da câmera', collector ? 'As fotos enviadas ficam salvas no rascunho da obra.' : 'As fotos enviadas ficam salvas no rascunho. Você continua depois em Obras.', [
      { text: 'Continuar fotografando', style: 'cancel' },
      { text: 'Sair', onPress: () => router.back() },
    ])
  }

  async function fillFromPhotos() {
    if (!artworkId || busy) return
    setBusy('read'); setSheetError(null)
    try {
      await patchDraft(artworkId, sheetPatch({ ...sheet, title: sheet.title.trim() || 'Nova obra' }))
      const r = await readPhotos(artworkId)
      if (r.filled.length) { const d = await loadDraft(artworkId); absorb(d) }
      setToast(r.toast)
    } catch (e) { setSheetError((e as Error).message) } finally { setBusy(null) }
  }

  async function decide(checkId: number, decision: 'DIFFERENT' | 'SAME') {
    if (!artworkId || busy) return
    setBusy('dup'); setSheetError(null)
    try {
      await decideDuplicate(artworkId, checkId, decision)
      if (decision === 'SAME') { Alert.alert('Nova obra', 'Rascunho arquivado: a obra já está cadastrada.'); router.back(); return }
      setDups((cur) => cur.filter((c) => c.id !== checkId))
    } catch (e) { setSheetError((e as Error).message) } finally { setBusy(null) }
  }

  async function send() {
    if (!artworkId || busy) return
    const problems = sheetProblems(sheet)
    if (problems.length) { setSheetError(problems.join(' ')); return }
    if (dups.length) { setSheetError('Decida sobre a obra parecida antes de enviar.'); return }
    setBusy('save'); setSheetError(null)
    try {
      await patchDraft(artworkId, sheetPatch(sheet))
      await submitDraft(artworkId)
      if (collector) { toCollection(`${sheet.title.trim() || 'Sua obra'} foi enviada para certificação. A escritura sai no seu nome quando a equipe concluir.`); return }
      router.replace({ pathname: '/certification/link/[artworkId]', params: { artworkId: String(artworkId) } })
    } catch (e) { setSheetError((e as Error).message) } finally { setBusy(null) }
  }

  if (phase === 'loading') return <View style={[styles.dark, styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.sand500} /></View>

  if (phase === 'capture') {
    const optional = !slot.required
    const requiredDone = missingRequired(done).length === 0
    return (
      <View style={[styles.dark, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.capTop}>
          <IconButton name="close" label="Fechar" color={colors.paper50} size={26} onPress={close} />
          <Text style={styles.capCounter}>{captureCounter(index)}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.frame}>
          {shot ? <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : (
            <View style={[StyleSheet.absoluteFill, styles.center]}><Icon name={slot.kind === 'BACK' ? 'flip' : slot.focus ? 'center-focus-weak' : 'crop-portrait'} size={48} color={colors.ink500} /></View>
          )}
          <View pointerEvents="none" style={styles.guide} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />
          {slot.focus ? <View pointerEvents="none" style={[styles.focus, { left: `${slot.focus.x * 100}%`, top: `${slot.focus.y * 100}%` }]} /> : null}
          {slot.colorCard ? (
            <View pointerEvents="none" style={styles.card}>
              {[colors.alert500, colors.verified500, colors.info500, colors.ink900, colors.ink500, colors.paper50].map((c) => <View key={c} style={[styles.cardCell, { backgroundColor: c }, c === colors.paper50 && styles.cardWhite]} />)}
            </View>
          ) : null}
          {shot ? (
            <View pointerEvents="none" style={styles.quality}>
              <View style={[styles.qualityDot, { backgroundColor: shot.quality === 'BLURRY' ? colors.alert500 : colors.verified500 }]} />
              <Text style={styles.qualityText}>{shot.quality === 'BLURRY' ? 'Desfocada · refaça' : 'Foco e luz bons'}</Text>
            </View>
          ) : null}
          {uploading ? <View style={[StyleSheet.absoluteFill, styles.center, styles.veil]}><ActivityIndicator color={colors.sand500} /><Text style={styles.veilText}>Enviando a foto…</Text></View> : null}
        </View>

        <View style={styles.capText}>
          <Text style={styles.capName}>{slot.name}{optional ? ' · opcional' : ''}</Text>
          <Text style={styles.capHint}>{slot.hint}</Text>
          {captureError ? <Text style={styles.capError} accessibilityRole="alert">{captureError}</Text> : null}
        </View>

        <View style={styles.strips}>
          {CAPTURE_SLOTS.map((s, i) => (
            <Pressable key={s.kind} accessibilityRole="button" accessibilityLabel={s.name} onPress={() => !uploading && setIndex(i)} hitSlop={{ top: 10, bottom: 10 }}
              style={[styles.strip, !s.required && styles.stripOptional, { backgroundColor: i === index ? colors.sand500 : done.has(s.kind) ? colors.paper50 : colors.ink700 }]} />
          ))}
        </View>

        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Escolher da galeria" onPress={() => void pick('library')} disabled={uploading} style={styles.sideBtn}>
            <Icon name="photo-library" size={24} color={colors.paper50} /><Text style={styles.sideText}>Galeria</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Fotografar" onPress={() => void pick('camera')} disabled={uploading} style={[styles.shutter, uploading && { opacity: 0.5 }]}>
            <View style={styles.shutterCore} />
          </Pressable>
          {optional ? (
            <Pressable accessibilityRole="button" onPress={() => (index + 1 < CAPTURE_SLOTS.length ? setIndex(index + 1) : advance(done, CAPTURE_SLOTS.length))} disabled={uploading} style={styles.sideBtn}>
              <Icon name="skip-next" size={24} color={colors.paper50} /><Text style={styles.sideText}>Pular</Text>
            </Pressable>
          ) : requiredDone ? (
            <Pressable accessibilityRole="button" onPress={() => void goSheet()} disabled={uploading} style={styles.sideBtn}>
              <Icon name="arrow-forward" size={24} color={colors.paper50} /><Text style={styles.sideText}>Ficha</Text>
            </Pressable>
          ) : <View style={styles.sideBtn} />}
        </View>
        {requiredDone && optional ? (
          <Pressable accessibilityRole="button" onPress={() => void goSheet()} style={styles.toSheet}><Text style={styles.toSheetText}>Ir para a ficha rápida</Text></Pressable>
        ) : null}
      </View>
    )
  }

  // ── Ficha rápida ──
  const thumbs = CAPTURE_SLOTS.filter((s) => shots[s.kind])
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.sheetTop}>
        <IconButton name="arrow-back" label="Voltar às fotos" onPress={() => setPhase('capture')} />
      </View>
      <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} keyboardShouldPersistTaps="handled">
        <Display size={28} line={36}>Ficha rápida</Display>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {thumbs.map((s) => (
            <Pressable key={s.kind} accessibilityRole="button" accessibilityLabel={`Refazer ${s.name}`} onPress={() => { setIndex(CAPTURE_SLOTS.indexOf(s)); setPhase('capture') }} style={styles.thumb}>
              <Image source={{ uri: shots[s.kind]!.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.field}><Label>Título</Label><Input value={sheet.title} onChangeText={(t) => setSheet((f) => ({ ...f, title: t }))} placeholder="Maré de março" maxLength={200} /></View>
        <View style={styles.field}><Label>Ano</Label><Input value={sheet.year} onChangeText={(t) => setSheet((f) => ({ ...f, year: t.replace(/\D/g, '').slice(0, 4) }))} placeholder="2026" keyboardType="number-pad" /></View>
        <View style={styles.field}><Label>Técnica</Label><Input value={sheet.technique} onChangeText={(t) => setSheet((f) => ({ ...f, technique: t }))} placeholder="Têmpera sobre tela" maxLength={120} /></View>
        <View style={styles.field}><Label>Dimensões (cm)</Label><Input value={sheet.dimensions} onChangeText={(t) => setSheet((f) => ({ ...f, dimensions: t }))} placeholder="90 × 90 × 3,5" keyboardType="numbers-and-punctuation" /></View>

        <Pressable accessibilityRole="button" onPress={() => void fillFromPhotos()} disabled={!!busy} style={styles.readBtn}>
          {busy === 'read' ? <ActivityIndicator color={theme.fg} /> : <Icon name="auto-awesome" size={18} />}
          <Text style={styles.readText}>Preencher com as fotos</Text>
        </Pressable>

        {dups.map((d) => (
          <View key={d.id} style={styles.dup}>
            <View style={styles.dupHead}><Icon name="content-copy" size={20} color={colors.pending500} /><Text style={styles.dupTitle}>Parece com uma obra já cadastrada</Text></View>
            <Text style={styles.dupSub}>{d.candidate.title}{d.candidate.year ? `, ${d.candidate.year}` : ''} · {Math.round(d.similarityBps / 100)}% parecida</Text>
            <View style={styles.dupBtns}>
              <View style={{ flex: 1 }}><Button title="É outra obra" variant="ghost" disabled={!!busy} onPress={() => void decide(d.id, 'DIFFERENT')} /></View>
              <View style={{ flex: 1 }}><Button title="É a mesma obra" variant="danger" disabled={!!busy} onPress={() => void decide(d.id, 'SAME')} /></View>
            </View>
          </View>
        ))}

        <Text style={styles.note}>Você completa preço, histórico e condition report depois, no celular ou no computador.</Text>
        <ErrorText>{sheetError}</ErrorText>
        <Button title={collector ? 'Enviar para certificação' : 'Enviar e vincular etiqueta'} loading={busy === 'save'} disabled={!!busy && busy !== 'save'} onPress={() => void send()} />
        {missingRequired(done).length ? <Text style={styles.note}>Faltam {missingRequired(done).length} de {REQUIRED_COUNT} fotos obrigatórias.</Text> : null}
      </ScrollView>
      <Toast message={toast} onDone={() => setToast('')} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  dark: { flex: 1, backgroundColor: colors.ink900 },
  center: { alignItems: 'center', justifyContent: 'center' },
  capTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  capCounter: { fontSize: 14, fontWeight: '600', color: colors.paper50 },
  frame: { marginHorizontal: 20, aspectRatio: 4 / 5, backgroundColor: '#000', overflow: 'hidden' },
  guide: { position: 'absolute', left: '12%', top: '12%', right: '12%', bottom: '12%', borderWidth: 2, borderColor: colors.sand500 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: colors.paper50 },
  cornerTL: { left: '12%', top: '12%', borderLeftWidth: 4, borderTopWidth: 4 },
  cornerBR: { right: '12%', bottom: '12%', borderRightWidth: 4, borderBottomWidth: 4 },
  focus: { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, borderRadius: 22, borderWidth: 2, borderColor: colors.sand500 },
  card: { position: 'absolute', right: 12, bottom: 12, width: 50, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 4, backgroundColor: colors.paper50 },
  cardCell: { width: 12, height: 12 },
  cardWhite: { borderWidth: 1, borderColor: colors.ink300 },
  quality: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusSm, backgroundColor: 'rgba(17,17,17,.7)' },
  qualityDot: { width: 8, height: 8, borderRadius: 4 },
  qualityText: { fontSize: 12, fontWeight: '600', color: colors.paper50 },
  veil: { backgroundColor: 'rgba(17,17,17,.6)', gap: 8 },
  veilText: { fontSize: 13, color: colors.paper50 },
  capText: { paddingHorizontal: 20, paddingTop: 16, gap: 4 },
  capName: { fontSize: 16, fontWeight: '600', color: colors.paper50 },
  capHint: { fontSize: 14, color: colors.ink300 },
  capError: { fontSize: 13, color: colors.sand100, marginTop: 4 },
  strips: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 16 },
  strip: { flex: 1, height: 4, borderRadius: 2 },
  stripOptional: { opacity: 0.6 },
  controls: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 },
  sideBtn: { width: 64, alignItems: 'center', gap: 2 },
  sideText: { fontSize: 11, fontWeight: '600', color: colors.paper50 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.paper50, padding: 5 },
  shutterCore: { flex: 1, borderRadius: 33, backgroundColor: colors.paper50 },
  toSheet: { alignSelf: 'center', paddingVertical: 10 },
  toSheetText: { fontSize: 14, fontWeight: '600', color: colors.sand500 },
  sheetTop: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  sheetBody: { paddingHorizontal: 20, gap: 16 },
  thumb: { width: 56, height: 56, backgroundColor: theme.wall, overflow: 'hidden' },
  field: { gap: 4 },
  readBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.fgDisabled },
  readText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  dup: { gap: 8, padding: 12, borderRadius: theme.radiusMd, backgroundColor: colors.pending100 },
  dupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dupTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  dupSub: { fontSize: 13, color: theme.fgBody },
  dupBtns: { flexDirection: 'row', gap: 8 },
  note: { fontSize: 12, color: theme.fgMuted },
})

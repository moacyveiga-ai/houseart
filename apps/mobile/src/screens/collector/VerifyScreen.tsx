// Verificar obra (handoff "HouseArt Verificar" + "Verificacao", and the reader
// "Verificar obra" of the App Artista): "Consulta pública e gratuita" — search
// by the number (or the serial of the tag, or the URL the tag opens) or by
// artist · title · year; then the result in its three states (autenticada ·
// contestada · roubada), the tag line, the sheet, the chain of ownership and
// the sale. A pasted tag URL is recorded as a reading (POST …/read) and the
// banner says whether the tag was confirmed now.
// GET /api/public/certificates (search), GET /api/v1/certificates/[publicId]
// (the page), POST /api/public/certificates/[publicId]/read (the tag).
// `?id=HA-…` opens a certificate straight away.
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { publicCertificate, readTag, searchCertificates, type CertificateHit, type PublicCertificate, type TagReadResult } from '@/api/collector'
import { colors, theme } from '@/theme'
import { Input, KeyValue, Label } from '@/ui/forms'
import { Display, Icon, Loading, TopBar, Wall, type IconName } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import { tagReader } from '@/nfc/reader'
import { VERDICT, dataBR, markerLine, parseVerifyInput, verdictText } from './collector-core'

type Mode = 'id' | 'name'
const EVENT_ICON: Record<string, IconName> = { CREATED: 'brush', CERTIFIED: 'verified', LISTED: 'storefront', TRANSFERRED: 'swap-horiz', LOANED: 'museum', RESTORED: 'build', STOLEN: 'gpp-bad', DISPUTED: 'report', INSURED: 'shield' }

export function VerifyScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const reader = tagReader()
  const params = useLocalSearchParams<{ id?: string }>()
  const [mode, setMode] = useState<Mode>('id')
  const [text, setText] = useState('')
  const [name, setName] = useState({ artist: '', title: '', year: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hits, setHits] = useState<CertificateHit[] | null>(null)
  const [cert, setCert] = useState<PublicCertificate | null>(null)
  const [read, setRead] = useState<TagReadResult | null>(null)

  async function open(publicId: string, tagRead: TagReadResult | null) {
    setBusy(true); setError(null)
    try { setCert(await publicCertificate(publicId)); setRead(tagRead) } catch (e) { setError((e as Error).message || 'Não foi possível abrir o certificado.') } finally { setBusy(false) }
  }

  async function search() {
    if (busy) return
    setError(null); setHits(null)
    if (mode === 'name') {
      if (!name.artist.trim() && !name.title.trim() && !name.year.trim()) { setError('Informe o artista, o título ou o ano.'); return }
      setBusy(true)
      try { setHits(await searchCertificates({ artist: name.artist.trim(), title: name.title.trim(), year: name.year.trim() })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      return
    }
    const p = parseVerifyInput(text)
    if (!p) { setError('Digite o número da obra ou cole a URL da etiqueta.'); return }
    setBusy(true)
    try {
      if (p.kind === 'tag') {
        // The tag knows its number; a bare `?uid&ctr&cmac` finds it by the serial.
        const publicId = p.publicId ?? (await searchCertificates({ id: p.sun.uid }))[0]?.publicId ?? null
        if (!publicId) { setHits([]); return }
        const r = await readTag(publicId, p.sun)
        setBusy(false)
        await open(publicId, r)
        return
      }
      const found = await searchCertificates({ id: p.id })
      if (found.length === 1 && found[0]!.publicId === p.id) { setBusy(false); await open(p.id, null); return }
      setHits(found)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  // `/verify?id=HA-…` (the certificate link of the artwork page and of the deeds) opens the result at once.
  useEffect(() => {
    const id = typeof params.id === 'string' ? params.id.toUpperCase() : ''
    if (/^HA-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(id)) { setText(id); void open(id, null) }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setCert(null); setRead(null); setHits(null); setError(null) }

  if (cert) {
    const v = VERDICT[cert.verdict]
    const alert = cert.verdict !== 'authenticated'
    const meta = [cert.artwork.technique, cert.artwork.dimensions, cert.artwork.edition ?? 'obra única'].filter(Boolean).join(' · ')
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        <TopBar title="Verificação pública" onBack={reset} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.banner, { backgroundColor: v.bg }]}>
            <Icon name={v.icon} size={34} color={v.fg} />
            <View style={{ flex: 1, gap: 4 }}><Text style={[styles.bannerTitle, { color: v.fg }]}>{v.title}</Text><Text style={styles.bannerText}>{verdictText(cert, read)}</Text></View>
          </View>
          {!read ? <View style={styles.note}><Icon name="contactless" size={16} color={theme.fgMuted} /><Text style={styles.noteText}>Leitura não autenticada (sem etiqueta)</Text></View> : null}
          {read && !read.authenticated && !read.tamper ? <View style={styles.note}><Icon name="error-outline" size={16} color={colors.pending500} /><Text style={styles.noteText}>A etiqueta não foi confirmada nesta leitura. Leia de novo ou fale com o suporte.</Text></View> : null}
          <Wall uri={cert.artwork.cover} padding={28} style={cert.verdict === 'stolen' ? { opacity: 0.5 } : undefined} />
          <View style={{ gap: 2 }}>
            <Text style={styles.artist}>{cert.artist}{cert.artistMeta ? ` ${cert.artistMeta}` : ''}</Text>
            <Display italic size={24} line={30}>{cert.artwork.title}{cert.artwork.year ? `, ${cert.artwork.year}` : ''}</Display>
            <Text style={styles.muted}>{meta}</Text>
          </View>
          <View>
            <KeyValue k="ID da obra" v={cert.publicId} bold />
            <KeyValue k="Certificada em" v={dataBR(cert.issuedAt)} />
            <KeyValue k="Titular atual" v={cert.holder ?? '—'} />
            <KeyValue k="Etiqueta de autenticação" v={markerLine(cert, read)} />
            <KeyValue k="Laudo de valor" v={cert.appraisalIssuedAt ? `Sim · emitido em ${new Date(cert.appraisalIssuedAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Bahia' })}` : 'Não'} />
            <KeyValue k="Titulares" v={`${cert.holders} ${cert.holders === 1 ? 'titular' : 'titulares'} desde a emissão`} />
          </View>
          <Display size={20} line={26}>Cadeia de titularidade</Display>
          {cert.events.length === 0 ? <Text style={styles.muted}>Nenhum evento registrado.</Text> : cert.events.map((e, i) => (
            <View key={e.seq} style={styles.ev}>
              <View style={styles.evRail}><View style={styles.evDot}><Icon name={EVENT_ICON[e.kind] ?? 'history'} size={16} /></View>{i < cert.events.length - 1 ? <View style={styles.evLine} /> : null}</View>
              <View style={{ flex: 1, paddingBottom: 14 }}><Text style={styles.evName}>{e.label}</Text><Text style={styles.muted}>{dataBR(e.at)}</Text></View>
            </View>
          ))}
          {cert.sale && !alert ? (
            <View style={styles.sale}>
              <View style={styles.saleRow}><Text style={styles.saleText}>À venda na <Text style={{ fontWeight: '700' }}>{cert.sale.seller}</Text></Text><Text style={styles.salePrice}>{cert.sale.priceCents ? brl(cert.sale.priceCents) : 'Sob consulta'}</Text></View>
              <Button title="Ver a obra" onPress={() => router.push({ pathname: '/artwork/[publicId]', params: { publicId: cert.publicId } })} />
            </View>
          ) : null}
          {alert ? <Button title="Falar com o suporte" variant="ghost" onPress={() => router.push({ pathname: '/web', params: { path: '/e/how-it-works', title: 'Suporte' } })} /> : null}
          <Text style={styles.foot}>Esta página não mostra valores de aquisição nem documentos. Sem login · dados do titular protegidos.</Text>
          <Button title="Nova busca" variant="ghost" onPress={reset} />
        </ScrollView>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Verificar obra" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.eyebrow}><Icon name="verified" size={16} color={theme.accentStrong} /><Text style={styles.eyebrowText}>Consulta pública e gratuita</Text></View>
        <Display size={26} line={33}>Verificar uma obra</Display>
        <Text style={styles.lead}>Confira se a obra tem certificado HouseArt, quem é o titular registrado e se há alguma contestação.</Text>
        <View style={styles.modes}>
          {([['id', 'Pelo número'], ['name', 'Pelo artista']] as const).map(([k, n]) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: mode === k }} onPress={() => { setMode(k); setError(null); setHits(null) }} style={[styles.mode, mode === k && styles.modeOn]}><Text style={[styles.modeText, mode === k && { color: theme.bg }]}>{n}</Text></Pressable>
          ))}
        </View>
        {mode === 'id' ? (<>
          <Label>Número da obra</Label>
          <Input value={text} onChangeText={(t) => { setText(t); setError(null) }} placeholder="HA-2026-0000-0000" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={() => void search()} returnKeyType="search" />
          <Text style={styles.muted}>Impresso no certificado e na etiqueta do verso. Também aceita o número de série da etiqueta ou a URL que ela abre.</Text>
          <View style={styles.tap}><Icon name="contactless" size={22} /><Text style={styles.tapText}>{reader.canScan ? 'Tem a obra em mãos? Encoste o celular na etiqueta do verso.' : 'Tem a obra em mãos? Encoste o celular na etiqueta do verso: ele abre a URL no navegador. Copie a URL e cole acima.'}</Text></View>
        </>) : (<>
          <Label>Artista</Label>
          <Input value={name.artist} onChangeText={(t) => setName((x) => ({ ...x, artist: t }))} placeholder="Nome do artista" />
          <View style={styles.two}>
            <View style={{ flex: 2, gap: 6 }}><Label>Título</Label><Input value={name.title} onChangeText={(t) => setName((x) => ({ ...x, title: t }))} placeholder="Nome da obra" /></View>
            <View style={{ flex: 1, gap: 6 }}><Label>Ano</Label><Input value={name.year} onChangeText={(t) => setName((x) => ({ ...x, year: t.replace(/\D/g, '').slice(0, 4) }))} placeholder="2024" keyboardType="number-pad" /></View>
          </View>
          <Text style={styles.muted}>Sem o número? Busque pelo artista e pelo nome da obra. Compare a imagem e as medidas antes de confiar no resultado.</Text>
        </>)}
        <ErrorText>{error}</ErrorText>
        <Button title="Verificar" loading={busy} onPress={() => void search()} />

        {busy && !hits ? <Loading /> : null}
        {hits && hits.length === 0 ? (
          <View style={styles.none}><Icon name="search-off" size={28} color={theme.fgMuted} /><Text style={styles.noneTitle}>Nenhuma obra certificada encontrada</Text><Text style={styles.muted}>O número fica no certificado impresso e na etiqueta colada no verso da obra, no formato HA-ano-0000-0000.</Text></View>
        ) : null}
        {hits?.map((h) => {
          const v = VERDICT[h.verdict]
          return (
            <Pressable key={h.publicId} accessibilityRole="button" accessibilityLabel={`Ver certificado de ${h.title}`} onPress={() => void open(h.publicId, null)} style={styles.hit}>
              <Wall uri={h.cover} padding={6} style={styles.hitWall} square={false} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Display italic size={15} line={20} numberOfLines={1}>{h.title}{h.year ? `, ${h.year}` : ''}</Display>
                <Text style={styles.muted} numberOfLines={1}>{h.artist}{h.technique ? ` · ${h.technique}` : ''}</Text>
                <View style={styles.hitFoot}><Icon name={v.icon} size={14} color={v.fg} /><Text style={[styles.hitVerdict, { color: v.fg }]}>{v.title}</Text><Text style={styles.hitId}>{h.publicId}</Text></View>
              </View>
              <Icon name="chevron-right" size={22} color={theme.fgMuted} />
            </Pressable>
          )
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: { fontSize: 12, fontWeight: '600', color: theme.accentStrong, textTransform: 'uppercase', letterSpacing: 0.6 },
  lead: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { height: 34, paddingHorizontal: 14, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.fgDisabled, justifyContent: 'center' },
  modeOn: { backgroundColor: theme.fg, borderColor: theme.fg },
  modeText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  muted: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  tap: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: theme.radiusMd, backgroundColor: colors.sand100 },
  tapText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fg },
  two: { flexDirection: 'row', gap: 10 },
  none: { alignItems: 'center', gap: 6, padding: 20 },
  noneTitle: { fontSize: 15, fontWeight: '600', color: theme.fg },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd },
  hitWall: { width: 60, height: 60 },
  hitFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hitVerdict: { fontSize: 11, fontWeight: '600' },
  hitId: { marginLeft: 'auto', fontSize: 11, color: theme.fgMuted, fontVariant: ['tabular-nums'] },
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: theme.radiusMd, alignItems: 'flex-start' },
  bannerTitle: { fontSize: 18, fontWeight: '700' },
  bannerText: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  note: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  artist: { fontSize: 13, fontWeight: '600', color: theme.fg },
  ev: { flexDirection: 'row', gap: 10 },
  evRail: { width: 30, alignItems: 'center' },
  evDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  evLine: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
  evName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sale: { gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  saleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  saleText: { flex: 1, fontSize: 13, color: theme.fg },
  salePrice: { fontSize: 16, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  foot: { fontSize: 12, lineHeight: 17, color: theme.fgMuted, textAlign: 'center' },
})

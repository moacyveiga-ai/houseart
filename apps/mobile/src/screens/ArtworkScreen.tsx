// Página da obra (handoff "HouseArt App Colecionador" › Página da obra): top bar
// with share · salvar · curtir, the wall (tap to enlarge), thumbnails by media
// kind, artist › title › sheet, price box, "Certificado HouseArt" card,
// Proveniência, the seller card with "Conversar", the two guarantees and the
// footer: "Fazer oferta" / "Comprar agora" (native flows of fase 2),
// "Reservada · em negociação", or "Vender esta obra" for a held one.
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { useApi } from '@/api/hooks'
import { reactionToast, toggleArtworkReaction, type ReactionKind } from '@/api/reactions'
import type { ArtworkPage } from '@/api/types'
import { colors, theme } from '@/theme'
import { Avatar, Display, ErrorState, Icon, IconButton, Loading, Toast, TopBar, Wall } from '@/ui/kit'
import { avatarTint, brl, initialsOf, installmentLine, sheetLine } from '@/ui/format'
import { shareArtwork } from '@/ui/share'

const MEDIA_NAME: Record<string, string> = { FRONT_COLOR_CARD: 'Frente', DETAIL: 'Detalhe', BACK: 'Verso' }
const dayBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })

/** The chain of the prototype: certificate events + exhibitions of the history, by date. */
function provenance(a: ArtworkPage): { k: string; v: string }[] {
  const ev = a.events.map((e) => ({ at: e.at, k: e.label, v: e.kind === 'CREATED' ? `${a.artist}${a.year ? ` · ${a.year}` : ''}` : e.kind === 'CERTIFIED' ? `Assinatura digital do artista · carimbo do tempo · ${dayBR(e.at)}` : dayBR(e.at) }))
  const shows = a.history.filter((h) => h.kind === 'EXHIBITION').map((h) => ({ at: `${h.occurredOn}-15T12:00:00.000Z`, k: 'Exposta', v: h.description }))
  const holder = { at: '9999', k: 'Titular atual', v: `${a.seller.name}${a.seller.kind === 'GALLERY' ? (a.seller.representsArtist ? ' · consignação do artista' : '') : ' · colecionador verificado'}` }
  return [...ev, ...shows].sort((x, y) => x.at.localeCompare(y.at)).concat(holder).map(({ k, v }) => ({ k, v }))
}

function certText(a: ArtworkPage): string {
  if (a.certificateStatus === 'PENDING') return 'Certificado em emissão. A etiqueta NFC é colada no verso na visita do especialista.'
  if (a.certificateStatus === 'CONTESTED') return 'Certificado contestado. A equipe HouseArt está apurando antes de qualquer venda.'
  if (a.certificateStatus === 'REVOKED') return 'Certificado revogado pela HouseArt.'
  return `Etiqueta NFC no verso, assinada por ${a.artist} digitalmente. A escritura passa para o seu nome no toque da entrega.`
}

export function ArtworkScreen({ publicId, mine }: { publicId: string; mine: boolean }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<ArtworkPage>(`/api/public/artworks/${encodeURIComponent(publicId)}`)
  const [flags, setFlags] = useState<{ liked?: boolean; saved?: boolean }>({})
  const [photo, setPhoto] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [toast, setToast] = useState('')
  const [opening, setOpening] = useState(false)
  const clearToast = useCallback(() => setToast(''), [])

  if (loading && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar /><Loading /></View>
  if (!data) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar /><ErrorState message={error ?? 'Obra não encontrada.'} onRetry={reload} /></View>
  const a = { ...data, ...flags }
  const media = a.media.filter((m) => MEDIA_NAME[m.kind]).length ? a.media.filter((m) => MEDIA_NAME[m.kind]) : a.cover ? [{ kind: 'FRONT_COLOR_CARD', url: a.cover }] : []
  const current = media[photo] ?? media[0]
  const listed = a.status === 'LISTED'
  const tint = avatarTint(a.seller.name)
  const priceLabel = mine ? 'Valor registrado' : a.priceCents === null ? 'Sob consulta' : a.acceptsOffers && !a.fixedPrice ? 'Preço pedido · aceita ofertas' : 'Preço fixo'

  async function react(kind: ReactionKind) {
    const key = kind === 'LIKE' ? 'liked' : 'saved'
    const before = a[key]
    setFlags((f) => ({ ...f, [key]: !before }))
    try { const on = await toggleArtworkReaction(a.id, kind); setFlags((f) => ({ ...f, [key]: on })); setToast(reactionToast(kind, on)) } catch { setFlags((f) => ({ ...f, [key]: before })); setToast('Não foi possível registrar agora.') }
  }
  async function talk() {
    if (opening) return
    setOpening(true)
    try {
      const r = await api<{ ok: boolean; id: number }>('/api/messages', { body: { artworkId: a.id } })
      router.push(`/messages/${r.id}`)
    } catch (e) { setToast((e as Error).message) } finally { setOpening(false) }
  }
  const web = (path: string, title: string) => router.push({ pathname: '/web', params: { path, title } })

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar right={<>
        <IconButton name="ios-share" label="Compartilhar" onPress={() => void shareArtwork(a)} />
        <IconButton name={a.saved ? 'bookmark' : 'bookmark-border'} label="Salvar" onPress={() => void react('SAVE')} />
        <IconButton name={a.liked ? 'favorite' : 'favorite-border'} label="Curtir" color={a.liked ? theme.error : theme.fg} onPress={() => void react('LIKE')} />
      </>} />
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={zoom ? 'Toque para afastar' : 'Toque no ponto para ampliar'} onPress={() => setZoom((z) => !z)}>
          <Wall uri={current?.url ?? null} padding={zoom ? 0 : 40} />
          <View style={styles.zoomChip}><Icon name={zoom ? 'zoom-out' : 'zoom-in'} size={16} color={colors.paper50} /><Text style={styles.zoomText}>{zoom ? 'Toque para afastar' : 'Toque no ponto para ampliar'}</Text></View>
        </Pressable>
        {media.length > 1 ? (
          <View style={styles.thumbs}>
            {media.map((m, i) => (
              <Pressable key={`${m.kind}-${i}`} accessibilityRole="button" accessibilityLabel={MEDIA_NAME[m.kind] ?? m.kind} onPress={() => { setPhoto(i); setZoom(false) }} style={styles.thumb}>
                <Wall uri={m.url} padding={0} style={[styles.thumbWall, { borderColor: photo === i ? theme.fg : 'transparent' }]} />
                <Text style={styles.thumbName}>{MEDIA_NAME[m.kind] ?? m.kind}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.titleBlock}>
          <Pressable accessibilityRole="link" onPress={() => web(`/e/artist/${a.artistSlug}`, a.artist)} style={styles.artistRow}><Text style={styles.artist}>{a.artist}</Text><Icon name="chevron-right" size={18} /></Pressable>
          <Display italic size={28} line={34}>{a.title}</Display>
          <Text style={styles.sheet}>{sheetLine(a)}</Text>
        </View>
        <View style={styles.priceBox}>
          <View>
            <Text style={styles.small}>{priceLabel}</Text>
            <Text style={styles.priceBig}>{brl(a.priceCents)}</Text>
            {listed && a.priceCents !== null ? <Text style={styles.small}>{installmentLine(a.priceCents)}</Text> : null}
          </View>
        </View>
        <View style={styles.certCard}>
          <View style={styles.certHead}><Icon name="verified" size={20} color={theme.success} /><Text style={styles.certTitle}>Certificado HouseArt</Text></View>
          <Text style={styles.certBody}>{certText(a)}</Text>
          <Text style={styles.certId}>{a.publicId}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/verify', params: { id: a.publicId } })}><Text style={styles.certLink}>Ver certificado público →</Text></Pressable>
        </View>
        <View style={styles.section}>
          <Text style={styles.h}>Proveniência</Text>
          {provenance(a).map((v, i) => (
            <View key={i} style={styles.provRow}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={styles.provK}>{v.k}</Text><Text style={styles.provV}>{v.v}</Text></View></View>
          ))}
        </View>
        {!mine ? (
          <View style={styles.seller}>
            <Avatar initials={initialsOf(a.seller.name)} bg={tint.bg} fg={tint.fg} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.seller.name}</Text>
              <Text style={styles.sub}>{a.seller.kind === 'GALLERY' ? 'Galeria' : 'Colecionador'}{a.seller.city ? ` · ${a.seller.city}` : ''}{a.seller.uf ? `, ${a.seller.uf}` : ''}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void talk()} disabled={opening} style={[styles.talk, opening && { opacity: 0.5 }]}><Icon name="chat-bubble-outline" size={18} /><Text style={styles.talkText}>Conversar</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.notes}>
          <View style={styles.note}><Icon name="lock" size={16} /><Text style={styles.noteText}>Pagamento em garantia: o vendedor só recebe quando você confirma a entrega.</Text></View>
          <View style={styles.note}><Icon name="contactless" size={16} /><Text style={styles.noteText}>Na entrega, o toque na etiqueta transfere a escritura para o seu nome.</Text></View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {mine ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/wallet/sell/[id]', params: { id: String(a.id) } })} style={styles.btnInk}><Text style={styles.btnInkText}>Vender esta obra</Text></Pressable>
        ) : listed ? (<>
          {a.acceptsOffers ? <Pressable accessibilityRole="button" onPress={() => router.push(`/artwork/${a.publicId}/offer`)} style={styles.btnOutline}><Text style={styles.btnOutlineText}>Fazer oferta</Text></Pressable> : null}
          {a.priceCents !== null ? <Pressable accessibilityRole="button" onPress={() => router.push(`/artwork/${a.publicId}/buy`)} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Comprar agora</Text></Pressable> : null}
        </>) : a.status === 'IN_DEAL' ? (
          <View style={styles.reserved}><Text style={styles.reservedText}>Reservada · em negociação</Text></View>
        ) : a.status === 'SOLD' ? (
          <View style={styles.reserved}><Text style={styles.reservedText}>Vendida · escritura emitida</Text></View>
        ) : null}
      </View>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { gap: 16, paddingBottom: 24 },
  zoomChip: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: theme.radiusFull, backgroundColor: 'rgba(17,17,17,.72)' },
  zoomText: { color: colors.paper50, fontSize: 11, fontWeight: '600' },
  thumbs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  thumb: { alignItems: 'center', gap: 4 },
  thumbWall: { width: 56, height: 56, borderWidth: 2 },
  thumbName: { fontSize: 11, color: theme.fgMuted },
  titleBlock: { paddingHorizontal: 16, gap: 4 },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  artist: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sheet: { fontSize: 13, lineHeight: 18, color: theme.fgMuted },
  priceBox: { marginHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  small: { fontSize: 12, color: theme.fgMuted },
  priceBig: { fontSize: 24, lineHeight: 30, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  certCard: { marginHorizontal: 16, padding: 14, borderRadius: theme.radiusMd, backgroundColor: colors.verified100, gap: 8 },
  certHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  certTitle: { fontSize: 14, fontWeight: '600', color: theme.success },
  certBody: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  certId: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: theme.fg, fontVariant: ['tabular-nums'] },
  certLink: { fontSize: 13, fontWeight: '600', color: theme.fg },
  section: { paddingHorizontal: 16 },
  h: { fontSize: 14, fontWeight: '600', color: theme.fg, marginBottom: 6 },
  provRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 9, height: 9, marginTop: 6, borderRadius: 5, backgroundColor: theme.fg },
  provK: { fontSize: 13, fontWeight: '600', color: theme.fg },
  provV: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  seller: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  talk: { height: 36, paddingHorizontal: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.fg, flexDirection: 'row', alignItems: 'center', gap: 4 },
  talkText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  notes: { marginHorizontal: 16, gap: 6 },
  note: { flexDirection: 'row', gap: 6 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
  btnOutline: { flex: 1, height: 50, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontWeight: '600', color: theme.fg },
  btnPrimary: { flex: 1, height: 50, borderRadius: theme.radiusMd, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontWeight: '600', color: theme.fg },
  btnInk: { flex: 1, height: 50, borderRadius: theme.radiusMd, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  btnInkText: { fontWeight: '600', color: theme.bg },
  reserved: { flex: 1, height: 50, borderRadius: theme.radiusMd, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  reservedText: { fontWeight: '600', color: theme.fgMuted },
})

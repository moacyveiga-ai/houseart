// Artistas representados (handoff "HouseArt App Galeria" › lista › Artistas):
// the intro line, a row per artist (avatar · name · "N obras no acervo ·
// contrato até …" · pill Representado/Consignação) opening the public page,
// and "Convidar artista" (name, kind, share, invite e-mail). Routes:
// GET/POST /api/gallery/artists.
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { useApi } from '@/api/hooks'
import type { RepresentedArtist } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { BottomSheet, Input, Label, OptionCard } from '@/ui/forms'
import { Avatar, ErrorState, Icon, Loading, Toast, TopBar } from '@/ui/kit'
import { Button } from '@/ui/primitives'
import { avatarTint, initialsOf } from '@/ui/format'

const KINDS = [{ key: 'REPRESENTED', name: 'Representado', sub: 'Contrato de representação' }, { key: 'CONSIGNMENT', name: 'Consignação', sub: 'Obras consignadas por prazo' }] as const

export function ArtistsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ ok: boolean; artists: RepresentedArtist[] }>('/api/gallery/artists')
  const [artists, setArtists] = useState<RepresentedArtist[]>([])
  useEffect(() => { if (data) setArtists(data.artists) }, [data])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'REPRESENTED' as 'REPRESENTED' | 'CONSIGNMENT', galleryPct: '50', inviteEmail: '' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const pct = parseInt(form.galleryPct.replace(/\D/g, ''), 10)
  const valid = form.name.trim().length >= 2 && Number.isInteger(pct) && pct >= 0 && pct <= 100

  async function add() {
    if (busy || !valid) return
    setBusy(true)
    try {
      const r = await api<{ ok: boolean; artists: RepresentedArtist[] }>('/api/gallery/artists', { body: { name: form.name.trim(), kind: form.kind, galleryBps: pct * 100, inviteEmail: form.inviteEmail.trim() || null } })
      setArtists(r.artists); setOpen(false); setToast(form.inviteEmail.trim() ? 'Convite enviado · o artista cria a conta e aceita o contrato' : 'Artista adicionado ao acervo')
    } catch (e) { setToast((e as Error).message || 'Não foi possível adicionar.') } finally { setBusy(false) }
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Artistas representados" />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>A divisão de cada venda sai automática pelo contrato. O artista assina o certificado digitalmente.</Text>
          {artists.map((a) => {
            const tint = avatarTint(a.name)
            return (
              <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.name} onPress={() => router.push({ pathname: '/web', params: { path: `/e/artist/${encodeURIComponent(a.slug)}`, title: a.name } })} style={styles.row}>
                <Avatar initials={initialsOf(a.name)} bg={tint.bg} fg={tint.fg} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name} numberOfLines={1}>{a.name}</Text><Text style={styles.sub} numberOfLines={2}>{a.sub}</Text></View>
                <View style={[styles.pill, { backgroundColor: a.contract ? colors.sand100 : colors.paper200 }]}><Text style={styles.pillText}>{a.contract ? a.contract.kindLabel : 'Sem contrato'}</Text></View>
              </Pressable>
            )
          })}
          {artists.length === 0 ? <Text style={styles.sub}>Nenhum artista ainda. Convide o primeiro.</Text> : null}
        </ScrollView>
      )}
      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.cta}><Icon name="add" size={20} color={theme.bg} /><Text style={styles.ctaText}>Convidar artista</Text></Pressable>
      </View>
      <BottomSheet open={open} title="Convidar artista" onClose={() => setOpen(false)} height="80%" footer={<Button title={form.inviteEmail.trim() ? 'Enviar convite' : 'Adicionar artista'} loading={busy} disabled={!valid} onPress={() => void add()} />}>
        <Label>Nome do artista</Label>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Como aparece no certificado" autoFocus />
        <Label>Contrato</Label>
        {KINDS.map((k) => <OptionCard key={k.key} on={form.kind === k.key} name={k.name} sub={k.sub} onPress={() => setForm({ ...form, kind: k.key })} />)}
        <Label hint="% de cada venda">Parte da galeria</Label>
        <Input value={form.galleryPct} onChangeText={(v) => setForm({ ...form, galleryPct: v.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" keyboardType="number-pad" />
        <Label hint="opcional">E-mail do artista</Label>
        <Input value={form.inviteEmail} onChangeText={(v) => setForm({ ...form, inviteEmail: v })} placeholder="artista@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
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

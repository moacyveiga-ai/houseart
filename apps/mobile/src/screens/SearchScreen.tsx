// Busca (handoff "HouseArt App Colecionador" › Busca): back · the field "Artista,
// obra, galeria ou certificado" with clear; empty state = recent searches (this
// session), "Em alta na HouseArt" and "Encontrar pela etiqueta"; results =
// "Certificado encontrado" (when the query is an ID), "Pessoas e galerias",
// "N obras" grid, or "Nada encontrado". GET /api/public/search?q=.
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import type { SearchResult } from '@/api/types'
import { colors, theme } from '@/theme'
import { Avatar, Chip, Display, Icon, IconButton, Loading, Wall } from '@/ui/kit'
import { avatarTint, brl, initialsOf, looksLikePublicId } from '@/ui/format'

/** "Em alta": the categories of the catalogue (the prototype lists names; the API has no trending). */
const TRENDING = ['Pintura', 'Fotografia', 'Obra sobre papel', 'Escultura']
let recentSearches: string[] = []

export function SearchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState(recentSearches)
  const ref = useRef<TextInput>(null)
  const seq = useRef(0)
  const has = q.trim().length > 0

  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 80); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (!has) { setResult(null); setLoading(false); return }
    const n = ++seq.current
    setLoading(true)
    const t = setTimeout(() => {
      api<SearchResult>(`/api/public/search?q=${encodeURIComponent(q.trim())}`).then((r) => { if (n === seq.current) setResult(r) }).catch(() => { if (n === seq.current) setResult({ q: q.trim(), artworks: [], artists: [], galleries: [], total: 0 }) }).finally(() => { if (n === seq.current) setLoading(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [q, has])

  function use(t: string) {
    recentSearches = [t, ...recentSearches.filter((y) => y !== t)].slice(0, 5)
    setRecent(recentSearches); setQ(t)
  }
  function drop(t: string) { recentSearches = recentSearches.filter((y) => y !== t); setRecent(recentSearches) }
  const web = (path: string, title: string) => router.push({ pathname: '/web', params: { path, title } })

  const cert = result && looksLikePublicId(result.q) ? result.artworks[0] ?? null : null
  const people = result ? [...result.artists.map((a) => ({ key: `a:${a.slug}`, name: a.name, sub: `Artista${a.meta ? ` · ${a.meta}` : ''}`, go: () => web(`/e/artist/${a.slug}`, a.name) })), ...result.galleries.map((g) => ({ key: `g:${g.slug}`, name: g.name, sub: `Galeria · ${g.city}${g.uf ? `, ${g.uf}` : ''}`, go: () => web(`/e/gallery/${g.slug}`, g.name) }))] : []
  const works = result?.artworks ?? []
  const nothing = !!result && !loading && !people.length && !works.length

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <IconButton name="arrow-back" label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        <View style={styles.field}>
          <Icon name="search" size={20} color={theme.fgMuted} />
          <TextInput ref={ref} value={q} onChangeText={setQ} placeholder="Artista, obra, galeria ou certificado" placeholderTextColor={theme.fgMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { if (q.trim()) use(q.trim()) }} />
          {has ? <IconButton name="cancel" label="Limpar" box={32} size={20} color={theme.fgMuted} onPress={() => setQ('')} /> : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!has ? (<>
          {recent.length ? (
            <View>
              <Text style={styles.h}>Buscas recentes</Text>
              {recent.map((t) => (
                <View key={t} style={styles.recent}>
                  <Icon name="history" size={20} color={theme.fgMuted} />
                  <Pressable accessibilityRole="button" onPress={() => use(t)} style={{ flex: 1 }}><Text style={styles.recentText}>{t}</Text></Pressable>
                  <IconButton name="close" label="Remover" box={36} size={18} color={theme.fgMuted} onPress={() => drop(t)} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            <Text style={styles.h}>Em alta na HouseArt</Text>
            <View style={styles.wrapRow}>{TRENDING.map((t) => <Chip key={t} label={t} icon="trending-up" onPress={() => use(t)} />)}</View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setQ('HA-2026-')} style={styles.tag}>
            <Icon name="contactless" size={26} color={theme.accent} />
            <View style={{ flex: 1 }}><Text style={styles.tagT}>Encontrar pela etiqueta</Text><Text style={styles.tagS}>Encoste o celular no verso de uma obra ou digite o nº do certificado</Text></View>
          </Pressable>
        </>) : loading && !result ? <Loading /> : (<>
          {cert ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/artwork/${cert.publicId}`)} style={styles.cert}>
              <Icon name="verified" size={24} color={theme.success} />
              <View style={{ flex: 1 }}><Text style={styles.certT}>Certificado encontrado</Text><Display italic size={15} line={20}>{cert.title} · {cert.artist}</Display><Text style={styles.certId}>{cert.publicId}</Text></View>
              <Icon name="chevron-right" size={20} />
            </Pressable>
          ) : null}
          {people.length ? (
            <View>
              <Text style={[styles.h, { marginBottom: 4 }]}>Pessoas e galerias</Text>
              {people.map((p) => { const tint = avatarTint(p.name); return (
                <Pressable key={p.key} accessibilityRole="button" onPress={p.go} style={styles.person}>
                  <Avatar initials={initialsOf(p.name)} bg={tint.bg} fg={tint.fg} size={40} />
                  <View style={{ flex: 1 }}><Text style={styles.personN}>{p.name}</Text><Text style={styles.personS}>{p.sub}</Text></View>
                  <Icon name="chevron-right" size={20} color={theme.fgMuted} />
                </Pressable>
              ) })}
            </View>
          ) : null}
          {works.length ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.h}>{works.length} {works.length === 1 ? 'obra' : 'obras'}</Text>
              <View style={styles.grid}>
                {works.map((o) => (
                  <Pressable key={o.publicId} accessibilityRole="button" accessibilityLabel={o.title} onPress={() => router.push(`/artwork/${o.publicId}`)} style={styles.cell}>
                    <Wall uri={o.cover} padding={16} />
                    <Text style={styles.cellA}>{o.artist}</Text>
                    <Display italic size={14} line={19}>{o.title}</Display>
                    <Text style={styles.cellP}>{brl(o.priceCents)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {nothing ? (
            <View style={{ gap: 8, paddingVertical: 16 }}>
              <Display size={22} line={28}>Nada encontrado para “{result?.q ?? q.trim()}”.</Display>
              <Text style={styles.nothingS}>Tente o nome do artista, o título da obra ou o número do certificado (HA-AAAA-XXXX-XXXX).</Text>
            </View>
          ) : null}
        </>)}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingLeft: 6, paddingRight: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  field: { flex: 1, height: 44, borderRadius: theme.radiusMd, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.fg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 6 },
  input: { flex: 1, fontSize: 14, color: theme.fg, paddingVertical: 0 },
  body: { padding: 16, paddingBottom: 32, gap: 20 },
  h: { fontSize: 13, fontWeight: '600', color: theme.fg },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: theme.border },
  recentText: { fontSize: 14, color: theme.fg },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.fg },
  tagT: { fontSize: 14, fontWeight: '600', color: colors.paper50 },
  tagS: { fontSize: 12, lineHeight: 16, color: theme.fgDisabled },
  cert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radiusMd, backgroundColor: colors.verified100 },
  certT: { fontSize: 13, fontWeight: '600', color: theme.success },
  certId: { fontSize: 12, color: theme.fgMuted, fontVariant: ['tabular-nums'] },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border },
  personN: { fontSize: 14, fontWeight: '600', color: theme.fg },
  personS: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 16 },
  cell: { width: '47%', flexGrow: 1, gap: 3 },
  cellA: { fontSize: 12, fontWeight: '600', color: theme.fg },
  cellP: { fontSize: 13, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  nothingS: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
})

// Web build (the app simulator at /app): the web journey opens in a same-origin iframe
// with the site chrome hidden by the same class the native WebView injects. The iframe
// rides on this browser's own web session (the app's bearer cannot become a cookie here).
import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { API_URL } from '@/config'
import { theme } from '@/theme'

const EMBED_CSS = `
html.ha-shell--embedded .ha-topbar,
html.ha-shell--embedded .ha-sidebar,
html.ha-shell--embedded .ha-ticker { display: none !important; }
html.ha-shell--embedded .ha-main { padding-top: 16px !important; }
`

export function WebScreen({ path }: { path: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const src = useMemo(() => `${API_URL}${path}`, [path])
  const onLoad = useCallback(() => {
    try {
      const doc = ref.current?.contentDocument
      if (!doc) return
      doc.documentElement.classList.add('ha-shell--embedded')
      if (!doc.getElementById('ha-embed-css')) {
        const s = doc.createElement('style'); s.id = 'ha-embed-css'; s.textContent = EMBED_CSS; doc.head.appendChild(s)
      }
    } catch { /* cross-origin: leave the page as it is */ }
  }, [])
  return (
    <View style={styles.fill}>
      <iframe ref={ref} src={src} onLoad={onLoad} title="HouseArt" style={{ border: 0, width: '100%', height: '100%', background: theme.bg }} />
    </View>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: theme.bg } })

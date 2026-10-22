// A web journey inside the app: same host, session by cookie, site chrome
// hidden by a class the web does not know about (`ha-shell--embedded`) —
// nothing in the web changes for this.
import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import { useRouter } from 'expo-router'
import { API_HOST, API_URL } from '@/config'
import { useSession } from '@/auth/session'
import { theme } from '@/theme'
import { Button, Centered, Muted } from './primitives'

const EMBED_CSS = `
html.ha-shell--embedded .ha-topbar,
html.ha-shell--embedded .ha-sidebar,
html.ha-shell--embedded .ha-ticker { display: none !important; }
html.ha-shell--embedded .ha-main { padding-top: 16px !important; }
`

// Runs before the page scripts: the class first, the stylesheet as soon as <head> exists.
const BEFORE_LOAD = `
(function () {
  document.documentElement.classList.add('ha-shell--embedded');
  var css = ${JSON.stringify(EMBED_CSS)};
  function inject() {
    if (document.getElementById('ha-embed-css')) return true;
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return false;
    var s = document.createElement('style'); s.id = 'ha-embed-css'; s.textContent = css; head.appendChild(s); return true;
  }
  if (!inject()) { var t = setInterval(function () { if (inject()) clearInterval(t); }, 20); }
})(); true;
`

// After load, in case navigation inside the SPA replaced <head>.
const AFTER_LOAD = `
(function () {
  document.documentElement.classList.add('ha-shell--embedded');
  if (!document.getElementById('ha-embed-css')) {
    var s = document.createElement('style'); s.id = 'ha-embed-css'; s.textContent = ${JSON.stringify(EMBED_CSS)}; document.head.appendChild(s);
  }
})(); true;
`

function isApiHost(url: string): boolean {
  try { return new URL(url).host === API_HOST } catch { return false }
}

export function WebScreen({ path }: { path: string }) {
  const router = useRouter()
  const { signOut } = useSession()
  const ref = useRef<WebView>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const uri = useMemo(() => `${API_URL}${path}`, [path])

  const onShouldStart = useCallback((req: ShouldStartLoadRequest): boolean => {
    const url = req.url
    if (url.startsWith('houseart://')) {
      const target = url.replace(/^houseart:\/\//, '/')
      router.push(target as never)
      return false
    }
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true
    if (isApiHost(url)) {
      // The web sent us to /login: the cookie is gone or the session died.
      if (/\/login(\?|$)/.test(url)) { void signOut(); return false }
      return true
    }
    void Linking.openURL(url).catch(() => undefined)
    return false
  }, [router, signOut])

  const onNav = useCallback((nav: WebViewNavigation) => {
    if (isApiHost(nav.url) && /\/login(\?|$)/.test(nav.url)) void signOut()
  }, [signOut])

  if (failed) {
    return (
      <Centered>
        <Muted>Não foi possível abrir esta tela. {failed}</Muted>
        <Button title="Tentar de novo" onPress={() => { setFailed(null); setNonce((n) => n + 1) }} />
      </Centered>
    )
  }

  return (
    <View style={styles.fill}>
      <WebView
        key={nonce}
        ref={ref}
        source={{ uri }}
        originWhitelist={['https://*', 'http://*', 'houseart://*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        injectedJavaScript={AFTER_LOAD}
        onShouldStartLoadWithRequest={onShouldStart}
        onNavigationStateChange={onNav}
        onError={(e) => setFailed(e.nativeEvent.description ?? '')}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(`Erro ${e.nativeEvent.statusCode}.`) }}
        startInLoadingState
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color={theme.accent} /></View>}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        style={styles.fill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
})

// The WebView rides on the web session cookie. We cannot set HttpOnly from
// the client (accepted); the cookie is Secure on https hosts and scoped to
// the API host only.
import CookieManager from '@react-native-cookies/cookies'
import { API_ORIGIN, API_URL, SESSION_COOKIE } from '@/config'

const secure = API_URL.startsWith('https://')

export async function setSessionCookie(token: string): Promise<void> {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await CookieManager.set(API_ORIGIN, {
    name: SESSION_COOKIE,
    value: token,
    domain: new URL(API_URL).hostname,
    path: '/',
    secure,
    httpOnly: false,
    expires,
  }, true)
}

export async function clearSessionCookies(): Promise<void> {
  try { await CookieManager.clearAll(true) } catch { /* ignore */ }
  try { await CookieManager.clearAll(false) } catch { /* ignore */ }
}

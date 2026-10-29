// The only reader of the API base URL. `EXPO_PUBLIC_API_URL` is inlined by
// Metro at build time; without it, `extra.apiUrl` of app.json (production).
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const DEFAULT_API_URL = 'https://www.houseart.com.br'

function readApiUrl(): string {
  // The web build (the simulator at /app) is served by the API itself: same origin.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) return window.location.origin
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined)?.apiUrl
  const raw = fromEnv || (typeof fromExtra === 'string' ? fromExtra : '') || DEFAULT_API_URL
  return raw.replace(/\/+$/, '')
}

export const API_URL = readApiUrl()
export const API_HOST = new URL(API_URL).host
export const API_ORIGIN = new URL(API_URL).origin

/** The web session cookie the WebView rides on (same name as lib/auth COOKIE_NAME). */
export const SESSION_COOKIE = 'houseart_session'

/** Header that makes /api/auth/login and /api/auth/code/verify return the token in the body. */
export const CLIENT_HEADER = { 'x-houseart-client': 'mobile' } as const

/**
 * Push by Expo is PREPARED, not live: the API only accepts `https:` endpoints
 * (web push by VAPID). Flip when `POST /api/notifications/push` accepts
 * `expo:<token>` and the server sends through Expo Push. See README.
 */
export const PUSH_API_READY = true

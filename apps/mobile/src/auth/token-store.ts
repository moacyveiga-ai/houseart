// The session token (64 hex) lives only in the secure store.
import * as SecureStore from 'expo-secure-store'

const KEY = 'houseart.session.token'
const TOKEN_RE = /^[0-9a-f]{64}$/

export async function readToken(): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY)
    return v && TOKEN_RE.test(v) ? v : null
  } catch { return null }
}

export async function writeToken(token: string): Promise<void> {
  if (!TOKEN_RE.test(token)) throw new Error('Token de sessão inválido.')
  await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
}

export async function clearToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(KEY) } catch { /* nothing to clear */ }
}

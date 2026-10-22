// The "Avisos no celular" switch, shared by Perfil and Avisos: registers the
// Expo token and subscribes it (POST /api/notifications/push, `expo:` endpoint),
// or unsubscribes it. The token of this device is remembered in the secure
// store so the switch shows the truth after the screen remounts.
import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { PUSH_API_READY } from '@/config'
import { registerForPush, subscribePush, unsubscribePush } from './register'

const KEY = 'houseart.push.expoToken'

export function usePushToggle(): { on: boolean; busy: boolean; ready: boolean; toggle: (next: boolean) => Promise<void> } {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    SecureStore.getItemAsync(KEY).then((v) => { if (alive && v) setToken(v) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const toggle = useCallback(async (next: boolean) => {
    if (busy) return
    if (!PUSH_API_READY) { Alert.alert('Em breve', 'Os avisos no celular chegam na próxima entrega do app.'); return }
    setBusy(true)
    try {
      if (next) {
        const r = await registerForPush()
        if (!r.ok) {
          const why = r.reason === 'denied' ? 'Permita notificações nas configurações do aparelho.' : r.reason === 'simulator' ? 'Só em aparelho físico.' : 'Não foi possível registrar este aparelho.'
          Alert.alert('Avisos no celular', why)
          return
        }
        await subscribePush(r.token)
        await SecureStore.setItemAsync(KEY, r.token).catch(() => {})
        setToken(r.token)
      } else {
        if (token) await unsubscribePush(token)
        await SecureStore.deleteItemAsync(KEY).catch(() => {})
        setToken(null)
      }
    } catch (e) { Alert.alert('Avisos no celular', (e as Error).message) } finally { setBusy(false) }
  }, [busy, token])

  return { on: !!token, busy, ready: PUSH_API_READY, toggle }
}

// Push PREPARED, not live (see PUSH_API_READY). Registering the Expo token
// works today; the subscription is only sent once the API accepts `expo:`.
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { api } from '@/api/client'
import { PUSH_API_READY } from '@/config'

export type PushRegistration = { ok: true; token: string } | { ok: false; reason: 'simulator' | 'denied' | 'no-project' | 'error' }

export async function registerForPush(): Promise<PushRegistration> {
  if (!Device.isDevice) return { ok: false, reason: 'simulator' }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.DEFAULT })
  }
  const current = await Notifications.getPermissionsAsync()
  let granted = current.granted
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted
  if (!granted) return { ok: false, reason: 'denied' }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
  if (!projectId) return { ok: false, reason: 'no-project' }
  try {
    const t = await Notifications.getExpoPushTokenAsync({ projectId })
    return { ok: true, token: t.data }
  } catch { return { ok: false, reason: 'error' } }
}

/** The body the API will take once it accepts Expo endpoints. */
export function expoSubscription(expoToken: string) {
  return { endpoint: `expo:${expoToken}`, keys: { p256dh: 'expo', auth: 'expo' } }
}

export async function subscribePush(expoToken: string): Promise<void> {
  if (!PUSH_API_READY) throw new Error('Avisos no celular chegam em breve.')
  await api('/api/notifications/push', { body: expoSubscription(expoToken) })
}

export async function unsubscribePush(expoToken: string): Promise<void> {
  if (!PUSH_API_READY) return
  await api('/api/notifications/push', { method: 'DELETE', body: { endpoint: `expo:${expoToken}` } })
}

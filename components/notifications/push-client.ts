'use client'
// Web push in the browser: the service worker is registered only here (when the
// person turns "Avisos no celular" on), never on page load. Everything is
// best-effort and reports a short reason the screen can show.
import { vapidKeyBytes } from './notifications-core'

export type PushState = 'off' | 'on' | 'unsupported' | 'denied'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  return reg
}

/** Whether this browser already holds a subscription (without registering anything new). */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

export async function subscribe(publicKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: 'Este navegador não recebe avisos no celular.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'Permita as notificações no navegador para ligar.' }
  const reg = await registration()
  const key = vapidKeyBytes(publicKey)
  let sub = await reg.pushManager.getSubscription()
  // A subscription bound to another VAPID key (rotation) is useless to the server: start over.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe().catch(() => undefined); sub = null }
  sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource }))
  const res = await fetch('/api/notifications/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
  if (!res.ok) { await sub.unsubscribe().catch(() => undefined); return { ok: false, reason: 'Não foi possível guardar a inscrição.' } }
  return { ok: true }
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return true // the browser does not report it: keep what exists
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

export async function unsubscribe(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch('/api/notifications/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined)
  await sub.unsubscribe().catch(() => undefined)
}

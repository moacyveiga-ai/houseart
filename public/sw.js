// HouseArt — service worker for web push only (registered by the "Avisos no
// celular" toggle of /notifications; no caching, no fetch handler).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = { title: 'HouseArt', body: '', href: '/notifications' }
  try { data = { ...data, ...(event.data ? event.data.json() : {}) } } catch { /* a text payload: keep the defaults */ }
  event.waitUntil(self.registration.showNotification(data.title || 'HouseArt', {
    body: data.body || '',
    icon: '/brand/simbolo_color.png',
    badge: '/brand/simbolo_color.png',
    data: { href: data.href || '/notifications' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = (event.notification.data && event.notification.data.href) || '/notifications'
  const url = new URL(href, self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})

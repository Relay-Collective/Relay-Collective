/* global self, caches */
const OFFLINE_CACHE = 'relay-offline-v1'
const OFFLINE_PAGE = '/offline.html'
const NOTIFICATION_ID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.addAll([OFFLINE_PAGE, '/apple-touch-icon.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('relay-offline-') && key !== OFFLINE_CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

// Signed-in pages and API responses are never cached. A connection is required to work with rides.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (url.origin === self.location.origin && url.pathname === '/apple-touch-icon.png' && request.destination === 'image') {
    event.respondWith(fetch(request).catch(async () => await caches.match(url.pathname) ?? Response.error()))
    return
  }
  if (request.mode !== 'navigate' || request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => await caches.match(OFFLINE_PAGE) ?? Response.error()))
})

self.addEventListener('push', (event) => {
  let id
  try { id = event.data?.json()?.id } catch { /* Use a generic alert. */ }
  // The only push data used is the inbox identifier. No trip or passenger information on the lock screen.
  const valid = typeof id === 'string' && NOTIFICATION_ID.test(id)
  event.waitUntil(self.registration.showNotification('CareRide · Relay Collective', {
    body: 'You have a CareRide update. Open Relay Collective to see it.',
    icon: '/icon-192.png',
    tag: valid ? `careride-${id}` : 'careride-update',
    data: { id: valid ? id : null },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const id = event.notification.data?.id
    const query = typeof id === 'string' && NOTIFICATION_ID.test(id) ? `?update=${encodeURIComponent(id)}` : ''
    const url = new URL(`/notifications${query}`, self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      try {
        const opened = client.url === url ? client : await client.navigate(url)
        if (opened) return opened.focus()
      } catch { /* Try another window or open the inbox fresh. */ }
    }
    return self.clients.openWindow(url)
  })())
})

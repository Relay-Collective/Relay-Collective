import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

interface WorkerEvent {
  data?: { json: () => unknown }
  notification?: { data: unknown; close: () => void }
  request?: Request
  waitUntil: (work: Promise<unknown>) => void
  respondWith: (work: Promise<Response>) => void
}

function serviceWorker() {
  const handlers = new Map<string, (event: WorkerEvent) => void>()
  const notifications: { title: string; options: NotificationOptions & { data: { id: string | null } } }[] = []
  const visits: string[] = []
  const online = { value: false }
  const cached: string[] = []
  runInNewContext(readFileSync('public/relay-sw.js', 'utf8'), {
    URL, Response,
    fetch: async () => {
      if (!online.value) throw new TypeError('network down')
      return new Response('Fresh page')
    },
    caches: {
      open: async () => ({ addAll: async (urls: string[]) => cached.push(...urls) }),
      match: async (url: string) => cached.includes(url) ? new Response('Reconnect') : undefined,
    },
    self: {
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler),
      skipWaiting: async () => {},
      location: { origin: 'https://relay.example' },
      registration: { showNotification: async (title: string, options: typeof notifications[number]['options']) => { notifications.push({ title, options }) } },
      clients: {
        matchAll: async () => [{ url: 'https://other.example' }],
        openWindow: async (url: string) => { visits.push(url) },
      },
    },
  })
  async function run(event: string, props: Partial<WorkerEvent> = {}) {
    let result: Promise<unknown> | undefined
    handlers.get(event)!({ ...props, waitUntil: (work) => { result = work }, respondWith: (work) => { result = work } })
    return result
  }
  return { run, notifications, visits, online, cached }
}

test('push uses a generic lock screen alert and opens the same-origin inbox only', async () => {
  const worker = serviceWorker()
  const id = 'a007dfc3-cda4-4323-89d7-32602c843889'
  await worker.run('push', { data: { json: () => ({ id, body: 'Private Passenger', url: 'https://other.example' }) } })
  const [alert] = worker.notifications
  assert.equal(alert.title, 'CareRide · Relay Collective')
  assert.doesNotMatch(JSON.stringify(alert), /Private Passenger|other\.example/)
  let closed = false
  await worker.run('notificationclick', { notification: { data: alert.options.data, close: () => { closed = true } } })
  assert.equal(closed, true)
  assert.deepEqual(worker.visits, [`https://relay.example/notifications?update=${id}`])
})

test('offline navigation uses a reconnect page, while signed-in content stays network-only', async () => {
  const worker = serviceWorker()
  const request = { url: 'https://relay.example/volunteer', mode: 'navigate', method: 'GET' } as Request
  await worker.run('install')
  assert.deepEqual(worker.cached, ['/offline.html', '/apple-touch-icon.png'])
  assert.equal(await ((await worker.run('fetch', { request })) as Response).text(), 'Reconnect')
  worker.online.value = true
  assert.equal(await ((await worker.run('fetch', { request })) as Response).text(), 'Fresh page')
  assert.equal(await worker.run('fetch', { request: { ...request, url: 'https://relay.example/api/private' } }), undefined)
})

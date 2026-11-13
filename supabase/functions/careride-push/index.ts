// Service-only consumer for the CareRide delivery queue. The browser never calls this function.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

interface Delivery {
  notification_id: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  lease: string
}

const endpoint = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[A-Za-z0-9_/.~%?&=:+-]+$/

function sameToken(expected: string, actual: string): boolean {
  // Compare the whole value, including on a mismatch.
  let diff = expected.length ^ actual.length
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0)
  return diff === 0
}

async function deliver(row: Delivery, vapidDetails: { subject: string; publicKey: string; privateKey: string }) {
  if (!endpoint.test(row.endpoint)) return 'gone'
  try {
    const request = webpush.generateRequestDetails(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
      JSON.stringify({ id: row.notification_id }),
      { vapidDetails, TTL: 300, urgency: 'normal' },
    )
    const response = await fetch(row.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: new Uint8Array(request.body),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    })
    await response.body?.cancel().catch(() => {})
    if (response.ok) return 'sent'
    if ([404, 410].includes(response.status)) return 'gone'
    return response.status === 429 || response.status >= 500 ? 'retry' : 'failed'
  } catch {
    return 'retry'
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const token = Deno.env.get('CARERIDE_PUSH_JOB_TOKEN')
  if (!token || !sameToken(token, request.headers.get('x-careride-job-token') ?? '')) return new Response(null, { status: 401 })

  const subject = Deno.env.get('CARERIDE_VAPID_SUBJECT')
  const publicKey = Deno.env.get('CARERIDE_VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('CARERIDE_VAPID_PRIVATE_KEY')
  const url = Deno.env.get('SUPABASE_URL')
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || secretKeys.default || Object.values(secretKeys)[0]
  if (!url || !key || !subject || !publicKey || !privateKey) {
    return Response.json({ error: 'Push is not configured.' }, { status: 503 })
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.rpc('careride_claim_push').returns<Delivery[]>()
  if (error) return Response.json({ error: 'Unable to claim deliveries.' }, { status: 500 })
  const pending = data ?? []
  let failedWrites = 0
  for (let start = 0; start < pending.length; start += 10) {
    await Promise.all(pending.slice(start, start + 10).map(async (row) => {
      const result = await deliver(row, { subject, publicKey, privateKey })
      const { error: finishError } = await db.rpc('careride_finish_push', {
        p_notification: row.notification_id, p_subscription: row.subscription_id, p_lease: row.lease, p_result: result,
      })
      if (finishError) failedWrites++
    }))
  }
  const { error: pruneError } = await db.rpc('careride_prune_push')
  return Response.json({ processed: pending.length, failedWrites }, { status: failedWrites || pruneError ? 500 : 200 })
})

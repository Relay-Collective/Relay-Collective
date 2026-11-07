// Permanently deletes a Relay Collective account and its personal information (docs/ACCOUNT_DELETION.md).
//
// POST { action: 'start', profileId, confirmEmail, password }   starts deleting one account
// POST { action: 'retry', jobId, password }                     carries on with a deletion that failed
//
// 1. Checks the caller's own password again (a typed email alone isn't enough to destroy an account).
// 2. Calls the admin_* deletion functions AS THE CALLER, so the database checks they are an active platform
//    admin at every step, switches the account off before anything is erased, and records the job.
// 3. Uses the server-only secret key for the two steps outside the database: removing the person's files
//    from Storage, and deleting their Supabase login (hard delete).
// Each step is checked by the database before the next one starts, so a failure leaves the job where it
// stopped and a retry carries on from there. The response is the job, whatever happened.
//
// Deploy: npx supabase functions deploy admin-delete-account --use-api
// The secret key is provided to Edge Functions by Supabase; it never reaches the browser.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { DeletionRefused, publicJob, runDeletionJob, type WorkingJob } from './workflow.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_SESSION = { persistSession: false, autoRefreshToken: false }

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Supabase provides keys under the legacy names, the newer JSON lists, or both, depending on the project.
function key(legacyName: string, listName: string): string | undefined {
  const legacy = Deno.env.get(legacyName)
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get(listName) ?? '{}') as Record<string, string>
    return keys.default ?? Object.values(keys)[0]
  } catch {
    return undefined
  }
}

// Signs in once with the admin's password on a throwaway client, then ends just that session
// (scope 'local': the admin's own browser session carries on).
async function passwordIsRight(url: string, publishableKey: string, email: string, userId: string, password: string): Promise<boolean> {
  const check = createClient(url, publishableKey, { auth: NO_SESSION })
  const { data, error } = await check.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  await check.auth.signOut({ scope: 'local' })
  return data.user?.id === userId
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Please sign in.' }, 401)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const { action, password } = body
  if (action !== 'start' && action !== 'retry') return json({ error: 'Reload Relay Collective and try again.' }, 400)
  if (typeof password !== 'string' || !password) return json({ error: 'Enter your password to confirm it’s you.' }, 400)
  if (action === 'start' && (typeof body.profileId !== 'string' || !UUID.test(body.profileId) || typeof body.confirmEmail !== 'string')) {
    return json({ error: 'Choose an account to delete.' }, 400)
  }
  if (action === 'retry' && (typeof body.jobId !== 'string' || !UUID.test(body.jobId))) {
    return json({ error: 'Choose a deletion to retry.' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = key('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS')
  const secretKey = key('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS')
  if (!url || !publishableKey || !secretKey) return json({ error: 'The server is missing its Supabase settings.' }, 500)

  // As the caller: the database decides whether they may do this.
  const asCaller = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: NO_SESSION })
  const { data: caller, error: callerError } = await asCaller.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (callerError || !caller.user?.email) return json({ error: 'Please sign in again.' }, 401)
  if (!(await passwordIsRight(url, publishableKey, caller.user.email, caller.user.id, password))) {
    return json({ error: 'That password isn’t right.' }, 403)
  }

  const admin = createClient(url, secretKey, { auth: NO_SESSION })
  const deps = {
    rpc: (name: string, args: Record<string, unknown>) => asCaller.rpc(name, args).then(({ data, error }) => ({ data, error })),
    removeObjects: (bucket: string, paths: string[]) => admin.storage.from(bucket).remove(paths).then(({ error }) => ({ error })),
    deleteAuthUser: (authUserId: string) => admin.auth.admin.deleteUser(authUserId, false).then(({ error }) => ({ error })),
    log: (message: string) => console.log(message),
  }

  try {
    let jobId = body.jobId as string
    if (action === 'start') {
      const { data, error } = await asCaller.rpc('admin_begin_account_deletion', {
        p_profile_id: body.profileId,
        p_confirm_email: body.confirmEmail,
      })
      if (error) throw error.code === 'P0001' ? new DeletionRefused(error.message) : new Error(`begin failed (${error.code})`)
      jobId = (data as WorkingJob).id
    }
    const job = await runDeletionJob(deps, jobId)
    return json({ job: publicJob(job) })
  } catch (err) {
    if (err instanceof DeletionRefused) return json({ error: err.message }, 400)
    console.error('account deletion failed', err instanceof Error ? err.message : 'unknown error')
    return json({ error: "We couldn't finish deleting this account. Check its status, then try again." }, 500)
  }
})

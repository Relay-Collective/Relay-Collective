// Runs one account-deletion job step by step (see supabase/migrations/20261029150000_account_deletion.sql).
// The database decides what each step means and checks it really happened; this only does the two parts
// that live outside the database (Storage and Auth) and reports how they went. No Deno or Supabase imports,
// so tests can run it with fakes (tests/accountDeletionWorkflow.test.ts).

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'requires_attention'
export type JobStep = 'storage' | 'records' | 'auth' | 'verify' | 'done'

// The job as the admin_* deletion functions return it to the Edge Function
export interface WorkingJob {
  id: string
  profileId: string
  status: JobStatus
  step: JobStep
  errorCode: string | null
  authUserId?: string | null
  storage?: { bucket: string; path: string }[] // the person's files still in Storage
  [field: string]: unknown
}

export interface DbError {
  code?: string
  message: string
}

export interface DeletionDeps {
  // A database function, called as the signed-in admin
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }>
  // Storage and Auth, with the server-only key
  removeObjects(bucket: string, paths: string[]): Promise<{ error: unknown }>
  deleteAuthUser(authUserId: string): Promise<{ error: { status?: number } | null }>
  log?(message: string): void // job ids and error codes only, never personal details
}

// A refusal written for people (raise ... using errcode = 'P0001'), passed on as it is
export class DeletionRefused extends Error {}

// More than the four steps, so a job that bounces between workers still stops
const MAX_ROUNDS = 8

async function call(deps: DeletionDeps, name: string, args: Record<string, unknown>): Promise<WorkingJob> {
  const { data, error } = await deps.rpc(name, args)
  if (error) {
    if (error.code === 'P0001') throw new DeletionRefused(error.message)
    throw new Error(`${name} failed (${error.code ?? 'unknown'})`)
  }
  if (!data) throw new DeletionRefused('That deletion wasn’t found.')
  return data as WorkingJob
}

function byBucket(files: { bucket: string; path: string }[]): Map<string, string[]> {
  const buckets = new Map<string, string[]>()
  for (const f of files) buckets.set(f.bucket, [...(buckets.get(f.bucket) ?? []), f.path])
  return buckets
}

// Does the work outside the database for the job's current step. Returns an error code if it failed.
async function work(deps: DeletionDeps, job: WorkingJob): Promise<string | undefined> {
  if (job.step === 'storage') {
    for (const [bucket, paths] of byBucket(job.storage ?? [])) {
      // Removing a file that's already gone isn't an error, so a retry repeats this safely
      const { error } = await deps.removeObjects(bucket, paths)
      if (error) return 'STORAGE_DELETE_FAILED'
    }
  }
  if (job.step === 'auth' && job.authUserId) {
    // Hard delete. A login that's already gone (404) is what we wanted.
    const { error } = await deps.deleteAuthUser(job.authUserId)
    if (error && error.status !== 404) return 'AUTH_DELETE_FAILED'
  }
  return undefined
}

// Takes up the job and runs it until it completes, fails, or needs attention. Safe to call again for the
// same job: finished steps aren't repeated, and Storage and Auth deletes are idempotent.
export async function runDeletionJob(deps: DeletionDeps, jobId: string): Promise<WorkingJob> {
  let job = await call(deps, 'admin_claim_account_deletion', { p_job_id: jobId })
  try {
    for (let round = 0; round < MAX_ROUNDS && job.status === 'in_progress'; round++) {
      const failed = await work(deps, job)
      if (failed) {
        deps.log?.(`account deletion ${jobId}: ${job.step} failed (${failed})`)
        return await call(deps, 'admin_fail_account_deletion', { p_job_id: jobId, p_step: job.step, p_error_code: failed })
      }
      job = await call(deps, 'admin_advance_account_deletion', { p_job_id: jobId, p_step: job.step })
    }
    if (job.status !== 'in_progress') deps.log?.(`account deletion ${jobId}: ${job.status}${job.errorCode ? ` (${job.errorCode})` : ''}`)
    return job
  } catch (err) {
    // Cut short (a network error, an unexpected database error): leave the job ready for a retry
    deps.log?.(`account deletion ${jobId}: interrupted at ${job.step}`)
    const { data } = await deps.rpc('admin_fail_account_deletion', { p_job_id: jobId, p_step: job.step, p_error_code: 'INTERRUPTED' })
    if (data) return data as WorkingJob
    throw err
  }
}

// What the browser gets back: the job without the login id or file paths
export function publicJob({ authUserId, storage, ...job }: WorkingJob): Omit<WorkingJob, 'authUserId' | 'storage'> {
  void authUserId
  void storage
  return job
}

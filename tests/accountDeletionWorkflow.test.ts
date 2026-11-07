import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { publicJob, runDeletionJob, type DeletionDeps, type JobStep, type WorkingJob } from '../supabase/functions/admin-delete-account/workflow.ts'

// The admin-delete-account Edge Function's step runner, with Storage, Auth and the database faked. The database
// side (what each step checks) is tested against the real SQL in tests/db/accountDeletion.test.ts.

const NEXT: Record<JobStep, JobStep> = { storage: 'records', records: 'auth', auth: 'verify', verify: 'done', done: 'done' }

interface Fake {
  deps: DeletionDeps
  job: WorkingJob
  calls: string[]
  removed: string[][]
  deletedLogins: string[]
  logs: string[]
}

// A database that advances like the real one: storage only once no files are left, auth only once the login is gone
function fake(options: { storageError?: boolean; authStatus?: number; throwOn?: string; files?: string[] } = {}): Fake {
  const files = new Set(options.files ?? ['fb/1.png', 'fb/2.png'])
  let loginExists = true
  const f: Fake = {
    calls: [],
    removed: [],
    deletedLogins: [],
    logs: [],
    job: { id: 'job-1', profileId: 'p-1', status: 'pending', step: 'storage', errorCode: null, authUserId: 'auth-1', attempts: 1 },
    deps: undefined as unknown as DeletionDeps,
  }
  const snapshot = (): WorkingJob => ({ ...f.job, storage: [...files].map((path) => ({ bucket: 'feedback-attachments', path })) })
  f.deps = {
    async rpc(name, args) {
      f.calls.push(args.p_step ? `${name}:${args.p_step}` : name)
      if (options.throwOn && f.calls.at(-1) === options.throwOn) throw new Error('network down')
      if (name === 'admin_claim_account_deletion') {
        if (f.job.status !== 'completed') f.job = { ...f.job, status: 'in_progress', errorCode: null }
      } else if (name === 'admin_fail_account_deletion') {
        if (f.job.status === 'in_progress' && f.job.step === args.p_step) f.job = { ...f.job, status: 'failed', errorCode: String(args.p_error_code) }
      } else if (name === 'admin_advance_account_deletion' && f.job.status === 'in_progress' && f.job.step === args.p_step) {
        if (f.job.step === 'storage' && files.size) f.job = { ...f.job, status: 'failed', errorCode: 'STORAGE_DELETE_FAILED' }
        else if (f.job.step === 'auth' && loginExists) f.job = { ...f.job, status: 'failed', errorCode: 'AUTH_DELETE_FAILED' }
        else f.job = { ...f.job, step: NEXT[f.job.step], status: f.job.step === 'verify' ? 'completed' : 'in_progress' }
      }
      return { data: snapshot(), error: null }
    },
    async removeObjects(_bucket, paths) {
      f.removed.push(paths)
      if (options.storageError) return { error: new Error('storage unavailable') }
      for (const p of paths) files.delete(p)
      return { error: null }
    },
    async deleteAuthUser(id) {
      f.deletedLogins.push(id)
      if (options.authStatus && options.authStatus !== 404) return { error: { status: options.authStatus } }
      loginExists = false
      return { error: options.authStatus === 404 ? { status: 404 } : null }
    },
    log: (message) => f.logs.push(message),
  }
  return f
}

describe('runDeletionJob', () => {
  test('runs every step in order and completes', async () => {
    const f = fake()
    const job = await runDeletionJob(f.deps, 'job-1')
    assert.equal(job.status, 'completed')
    assert.deepEqual(f.calls, [
      'admin_claim_account_deletion',
      'admin_advance_account_deletion:storage',
      'admin_advance_account_deletion:records',
      'admin_advance_account_deletion:auth',
      'admin_advance_account_deletion:verify',
    ])
    assert.deepEqual(f.removed, [['fb/1.png', 'fb/2.png']])
    assert.deepEqual(f.deletedLogins, ['auth-1'])
  })

  test('a Storage failure stops before any record or the login is touched (Test E)', async () => {
    const f = fake({ storageError: true })
    const job = await runDeletionJob(f.deps, 'job-1')
    assert.equal(job.status, 'failed')
    assert.equal(job.errorCode, 'STORAGE_DELETE_FAILED')
    assert.equal(job.step, 'storage')
    assert.ok(!f.calls.includes('admin_advance_account_deletion:records'))
    assert.deepEqual(f.deletedLogins, [])
  })

  test('an Auth failure is recorded, never reported as done (Test F)', async () => {
    const f = fake({ authStatus: 500 })
    const job = await runDeletionJob(f.deps, 'job-1')
    assert.deepEqual([job.status, job.step, job.errorCode], ['failed', 'auth', 'AUTH_DELETE_FAILED'])
  })

  test('a login that is already gone counts as deleted', async () => {
    const f = fake({ authStatus: 404 })
    assert.equal((await runDeletionJob(f.deps, 'job-1')).status, 'completed')
  })

  test('a retry resumes where it stopped and asks Storage only for what is left', async () => {
    const f = fake({ files: [] })
    f.job = { ...f.job, status: 'failed', step: 'auth', errorCode: 'AUTH_DELETE_FAILED' }
    const job = await runDeletionJob(f.deps, 'job-1')
    assert.equal(job.status, 'completed')
    assert.deepEqual(f.removed, [], 'no files left: Storage is not called')
    assert.deepEqual(f.calls.slice(1), ['admin_advance_account_deletion:auth', 'admin_advance_account_deletion:verify'])
  })

  test('cut short mid-way, the job is left ready for a retry', async () => {
    const f = fake({ throwOn: 'admin_advance_account_deletion:records' })
    const job = await runDeletionJob(f.deps, 'job-1')
    assert.deepEqual([job.status, job.step, job.errorCode], ['failed', 'records', 'INTERRUPTED'])
  })

  test('a job that is already complete does nothing', async () => {
    const f = fake()
    f.job = { ...f.job, status: 'completed', step: 'done' }
    await runDeletionJob(f.deps, 'job-1')
    assert.deepEqual(f.calls, ['admin_claim_account_deletion'])
    assert.deepEqual(f.deletedLogins, [])
  })

  test('logs carry job ids and error codes, not personal details (Test K)', async () => {
    const f = fake({ storageError: true })
    await runDeletionJob(f.deps, 'job-1')
    assert.ok(f.logs.length > 0)
    assert.ok(f.logs.every((line) => !line.includes('auth-1') && !line.includes('fb/') && !line.includes('@')))
  })
})

test('the browser never gets the login id or file paths back', () => {
  const shown = publicJob({
    id: 'j',
    profileId: 'p',
    status: 'completed',
    step: 'done',
    errorCode: null,
    authUserId: 'auth-1',
    storage: [{ bucket: 'b', path: 'x' }],
  })
  assert.equal('authUserId' in shown, false)
  assert.equal('storage' in shown, false)
})

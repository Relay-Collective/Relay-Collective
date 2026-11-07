import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { DataService } from '../src/services/dataService'
import { DELETED_NAME, emailMatches, needsRetry, shownCategories } from '../src/logic/accountDeletion'
import type { AccountDeletionCategory } from '../src/types'

// Permanent account deletion: the shared rules, and the demo backend. The database functions in
// supabase/migrations/20261029150000_account_deletion.sql enforce the same rules; tests/db/accountDeletion.test.ts
// checks those against the real SQL, and tests/accountDeletionWorkflow.test.ts the Edge Function's steps.

function memoryStorage() {
  const mem = new Map<string, string>()
  return {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value)
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })

const { mockService, resetDemoData } = (await import('../src/services/mockService')) as { mockService: DataService; resetDemoData: () => void }

const ADMIN = { email: 'admin@careride.com', password: 'abcd1234' }

async function signInAs(email: string, password = 'careride') {
  await mockService.signOut()
  return mockService.signIn(email, password)
}

describe('rules', () => {
  test('the typed email must be the account’s, ignoring case and spaces', () => {
    assert.equal(emailMatches('  Frank@CareRide.demo ', 'frank@careride.demo'), true)
    assert.equal(emailMatches('frank@careride.dem', 'frank@careride.demo'), false)
    assert.equal(emailMatches('', undefined), false)
  })

  test('a deletion needs a retry once it failed, or was left running for over a minute', () => {
    const now = Date.parse('2026-10-29T12:00:00Z')
    assert.equal(needsRetry({ status: 'failed', updatedAt: '2026-10-29T12:00:00Z' }, now), true)
    assert.equal(needsRetry({ status: 'in_progress', updatedAt: '2026-10-29T11:59:30Z' }, now), false)
    assert.equal(needsRetry({ status: 'in_progress', updatedAt: '2026-10-29T11:58:00Z' }, now), true)
    assert.equal(needsRetry({ status: 'completed', updatedAt: '2026-10-29T11:00:00Z' }, now), false)
  })

  test('the summary always covers the account itself, and the rest only when there is something', () => {
    const categories: AccountDeletionCategory[] = [
      { key: 'auth_account', action: 'delete', count: 1 },
      { key: 'rides_driven', action: 'retain', count: 0 },
      { key: 'product_feedback', action: 'delete', count: 2 },
      { key: 'preferences', action: 'none', count: 0 },
    ]
    assert.deepEqual(
      shownCategories(categories).map((c) => c.key),
      ['auth_account', 'product_feedback', 'preferences'],
    )
  })
})

describe('demo backend', () => {
  beforeEach(() => resetDemoData())

  async function userId(email: string): Promise<string> {
    const accounts = await mockService.listAccounts()
    return accounts.find((u) => u.email === email)!.id
  }

  test('a platform admin previews, confirms, and the account is gone from the active list', async () => {
    await signInAs(ADMIN.email, ADMIN.password)
    const maya = await userId('maya@careride.demo')
    const preview = await mockService.previewAccountDeletion(maya)
    assert.equal(preview.state, 'READY')
    assert.equal(preview.categories.find((c) => c.key === 'driver_profile')?.count, 1)

    const job = await mockService.startAccountDeletion(maya, { email: 'MAYA@careride.demo', password: ADMIN.password })
    assert.equal(job.status, 'completed')
    assert.equal(
      (await mockService.listAccounts()).some((u) => u.id === maya),
      false,
    )
    assert.equal((await mockService.previewAccountDeletion(maya)).state, 'DELETED')
    assert.deepEqual(await mockService.getAccountDeletion(job.id), job)
    await assert.rejects(signInAs('maya@careride.demo'))
  })

  test('the admin’s password and the account’s email are both checked', async () => {
    await signInAs(ADMIN.email, ADMIN.password)
    const frank = await userId('frank@careride.demo')
    await assert.rejects(mockService.startAccountDeletion(frank, { email: 'frank@careride.demo', password: 'wrong' }), /password/)
    await assert.rejects(mockService.startAccountDeletion(frank, { email: 'maya@careride.demo', password: ADMIN.password }), /doesn’t match/)
    assert.equal(
      (await mockService.listAccounts()).some((u) => u.id === frank),
      true,
    )
  })

  test('only platform admins can delete accounts', async () => {
    const frank = await userId('frank@careride.demo')
    await signInAs('belkin@careride.demo')
    await assert.rejects(mockService.previewAccountDeletion(frank), /Only Relay Collective admins/)
    await assert.rejects(
      mockService.startAccountDeletion(frank, { email: 'frank@careride.demo', password: 'careride' }),
      /Only Relay Collective admins/,
    )
  })

  test('safeguards: yourself, the only platform admin, and the only administrator of a provider with drivers', async () => {
    const me = await signInAs(ADMIN.email, ADMIN.password)
    assert.deepEqual((await mockService.previewAccountDeletion(me.user!.id)).blockers, ['SELF', 'LAST_PLATFORM_ADMIN'])
    const vanshare = await userId('vanshare@careride.demo')
    assert.deepEqual((await mockService.previewAccountDeletion(vanshare)).blockers, ['LAST_PROVIDER_ADMIN'])
    await assert.rejects(
      mockService.startAccountDeletion(vanshare, { email: 'vanshare@careride.demo', password: ADMIN.password }),
      /transport provider/,
    )
  })

  test('an organization’s bookings stay, booked by an anonymous profile', async () => {
    await signInAs(ADMIN.email, ADMIN.password)
    const belkin = await userId('belkin@careride.demo')
    const before = (await mockService.listAllRides()).filter((r) => r.requestedBy === belkin).length
    const preview = await mockService.previewAccountDeletion(belkin)
    assert.equal(preview.categories.find((c) => c.key === 'rides_requested')?.count, before)
    await mockService.startAccountDeletion(belkin, { email: 'belkin@careride.demo', password: ADMIN.password })
    assert.equal((await mockService.listAllRides()).filter((r) => r.requestedBy === belkin).length, before)
    assert.equal((await mockService.listUsers()).find((u) => u.id === belkin)?.name, DELETED_NAME)
  })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DataService, NewOrganizationApplication } from '../src/services/dataService'
import type { Database } from '../src/services/seed'

// Identity-first sign-up, organization applications, and invitations, against the demo backend.
// The database functions in supabase/migrations/20261024120000_identity_onboarding.sql enforce the same rules.

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

const { mockService, resetDemoData, STORAGE_KEY } = (await import('../src/services/mockService')) as {
  mockService: DataService
  resetDemoData: () => void
  STORAGE_KEY: string
}

const PASSWORD = 'careride'

const application: NewOrganizationApplication = {
  orgName: 'Harbour Light Centre',
  kind: 'NONPROFIT',
  description: 'Shelter and meals for adults in the Downtown Eastside.',
  address: '119 E Cordova St',
  city: 'Vancouver',
  contactName: 'Ana Ruiz',
  contactEmail: 'ana@harbourlight.org',
  contactPhone: '604-555-0199',
  contactRole: 'Program coordinator',
  serviceCategories: ['HOUSING', 'FOOD'],
  platformInterests: ['TRANSPORTATION', 'VOLUNTEERS'],
}

function editDb(change: (db: Database) => void) {
  const db = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Database
  change(db)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

async function newIdentity(email: string, name = 'Sam Lee') {
  const result = await mockService.signUp({ name, email, password: PASSWORD })
  assert.equal(result.status, 'SIGNED_IN')
  return result.status === 'SIGNED_IN' ? result.identity : undefined!
}

test('sign-up creates an identity with no role; onboarding is where a role comes from', async () => {
  resetDemoData()
  const identity = await newIdentity('ana@example.org', 'Ana Ruiz')
  const session = await mockService.restoreSession()
  assert.equal(session?.identity.id, identity.id)
  assert.equal(session?.user, undefined, 'no profile until onboarding')

  // Signing in again finds the same identity, still without a role
  await mockService.signOut()
  const again = await mockService.signIn('ana@example.org', PASSWORD)
  assert.equal(again.user, undefined)

  // A taken email gets a neutral message, never "this email is registered"
  await assert.rejects(mockService.signUp({ name: 'X', email: 'ana@example.org', password: PASSWORD }), /couldn't create an account/)
})

test('an organization application starts pending, and retrying it never makes a second organization', async () => {
  resetDemoData()
  await newIdentity('ana@harbourlight.org', 'Ana Ruiz')
  const before = (await mockService.listOrganizations()).length

  const user = await mockService.submitOrganizationApplication(application)
  assert.equal(user.role, 'PARTNER')
  assert.equal(user.name, 'Ana Ruiz', 'the profile is the person, not the organization')
  const org = (await mockService.listOrganizations()).find((o) => o.id === user.orgId)
  assert.equal(org?.status, 'PENDING')

  const retry = await mockService.submitOrganizationApplication(application)
  assert.equal(retry.id, user.id)
  assert.equal((await mockService.listOrganizations()).length, before + 1)

  const saved = await mockService.getOrganizationApplication(user.orgId!)
  assert.deepEqual(saved?.serviceCategories, ['HOUSING', 'FOOD'])

  // A pending organization can't book rides or invite anyone
  await assert.rejects(mockService.createInvitation('colleague@harbourlight.org'), /once your organization is approved/)
  // And the account can't take a second role
  await assert.rejects(
    mockService.registerDriverProfile({ name: 'Ana', phone: '604-555-0199' }, {
      background: 'INDEPENDENT',
      vehicle: 'Blue hatchback',
      seats: 3,
      wheelchairAccessible: false,
      serviceCities: ['Vancouver'],
      requestHours: [null, null, null, null, null, null, null],
    }),
    /already has a Relay Collective role/,
  )
})

test('another organization cannot read an application', async () => {
  resetDemoData()
  await newIdentity('ana@harbourlight.org')
  const user = await mockService.submitOrganizationApplication(application)
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  assert.equal(await mockService.getOrganizationApplication(user.orgId!), undefined)
})

test('driver sign-up stays pending until an admin verifies it', async () => {
  resetDemoData()
  await newIdentity('drive@example.org', 'Riley Park')
  const user = await mockService.registerDriverProfile(
    { name: 'Riley Park', phone: '604-555-0142' },
    {
      background: 'TAXI',
      vehicle: 'Grey minivan',
      seats: 5,
      wheelchairAccessible: true,
      serviceCities: ['Richmond'],
      requestHours: [null, { from: '09:00', to: '17:00' }, null, null, null, null, null],
    },
  )
  assert.equal(user.role, 'DRIVER')
  const driver = (await mockService.listDrivers()).find((d) => d.userId === user.id)
  assert.equal(driver?.status, 'PENDING')
  assert.equal(driver?.orgId, undefined, 'self sign-up never joins a transport provider')
})

test('invitations: one use, one email, and withdrawn or expired links fail safely', async () => {
  resetDemoData()
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const { token, invitation } = await mockService.createInvitation('Jo@Belkin.org')
  assert.equal(invitation.email, 'jo@belkin.org')
  assert.ok(token.length >= 32)
  assert.ok(!('token' in (await mockService.listInvitations())[0]), 'the token is never listed after creation')

  // Previews need a signed-in identity
  await mockService.signOut()
  await assert.rejects(mockService.previewInvitation(token), /sign in/)

  // Wrong account: told so, without the organization's name or the full address
  await newIdentity('someone@else.org')
  const wrong = await mockService.previewInvitation(token)
  assert.equal(wrong.state, 'WRONG_ACCOUNT')
  assert.equal(wrong.orgName, undefined)
  assert.equal(wrong.emailHint, 'j•••@belkin.org')
  await assert.rejects(mockService.acceptInvitation(token), /different email/)

  // The invited person
  await mockService.signOut()
  await newIdentity('jo@belkin.org', 'Jo Tan')
  const preview = await mockService.previewInvitation(token)
  assert.equal(preview.state, 'VALID')
  assert.equal(preview.orgName, 'Belkin House')
  const jo = await mockService.acceptInvitation(token)
  assert.equal(jo.role, 'PARTNER')
  assert.equal(jo.orgId, 'org-belkin')
  assert.equal(jo.houseId, 'house-belkin')
  await assert.rejects(mockService.acceptInvitation(token), /already been used/)

  // Nobody else can reuse it either
  await mockService.signOut()
  await newIdentity('late@belkin.org')
  assert.equal((await mockService.previewInvitation(token)).state, 'USED')
  assert.equal((await mockService.previewInvitation('not-a-real-token')).state, 'INVALID')

  // Withdrawn
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const second = await mockService.createInvitation('late@belkin.org')
  await mockService.revokeInvitation(second.invitation.id)
  await mockService.signIn('late@belkin.org', PASSWORD)
  await assert.rejects(mockService.acceptInvitation(second.token), /withdrawn/)

  // Expired
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const third = await mockService.createInvitation('late@belkin.org')
  editDb((db) => {
    db.invitations.find((i) => i.id === third.invitation.id)!.expiresAt = new Date(Date.now() - 1000).toISOString()
  })
  await mockService.signIn('late@belkin.org', PASSWORD)
  await assert.rejects(mockService.acceptInvitation(third.token), /expired/)
})

test('only administrators of an approved organization can invite, and only into their own organization', async () => {
  resetDemoData()
  await mockService.signIn('maya@careride.demo', PASSWORD) // a driver
  await assert.rejects(mockService.createInvitation('x@example.org'), /Only your organization's administrators/)

  // Another organization can't withdraw Belkin's invitation
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const { invitation } = await mockService.createInvitation('jo@belkin.org')
  await mockService.signIn('richmond@careride.demo', PASSWORD)
  await assert.rejects(mockService.revokeInvitation(invitation.id), /can't be withdrawn/)
  assert.equal((await mockService.listInvitations()).length, 0, "another organization's invitations aren't listed")
})

test('one staff member closing their account leaves the organization’s rides alone', async () => {
  resetDemoData()
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const { token } = await mockService.createInvitation('jo@belkin.org')
  await mockService.signOut()
  await newIdentity('jo@belkin.org', 'Jo Tan')
  await mockService.acceptInvitation(token)

  const active = (await mockService.listRidesForHouse('house-belkin')).filter((r) => ['SEARCHING', 'OFFERED', 'ACCEPTED'].includes(r.status))
  await mockService.deleteMyAccount()
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const after = await mockService.listRidesForHouse('house-belkin')
  for (const r of active) assert.notEqual(after.find((x) => x.id === r.id)?.status, 'CANCELLED')
})

import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { DataService } from '../src/services/dataService'
import { highlightParts, rankDirectory } from '../src/logic/membership'

// Organization discovery, join requests and team management, against the demo backend.
// The database functions in supabase/migrations/20261029120000_organization_membership.sql enforce the
// same rules; tests/db/organizationMembership.test.ts checks those against the real SQL.

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

const PASSWORD = 'careride'
const BELKIN_ADMIN = 'belkin@careride.demo'

async function newIdentity(email: string, name = 'Priya Shah') {
  await mockService.signOut()
  const result = await mockService.signUp({ name, email, password: PASSWORD })
  assert.equal(result.status, 'SIGNED_IN')
}

async function belkinId(): Promise<string> {
  const [found] = await mockService.searchOrganizations('Belkin')
  return found!.id
}

async function requestToJoinBelkin(email: string, name?: string) {
  await newIdentity(email, name)
  return mockService.submitJoinRequest({ orgId: await belkinId(), requestedPosition: 'Case Worker', message: 'I run the Tuesday program.' })
}

async function signInAs(email: string) {
  await mockService.signOut()
  return mockService.signIn(email, PASSWORD)
}

beforeEach(() => resetDemoData())

test('search shows approved, discoverable organizations by partial name, and nothing private', async () => {
  await newIdentity('someone@example.org')
  const found = await mockService.searchOrganizations('hou')
  assert.deepEqual(
    found.map((o) => o.name),
    ['Belkin House', 'Richmond House'],
  )
  assert.deepEqual(Object.keys(found[0]!).sort(), ['city', 'description', 'id', 'name'])
  assert.deepEqual(await mockService.searchOrganizations('h'), [], 'too short to search')
  assert.deepEqual(await mockService.searchOrganizations('Example Shelter'), [], 'awaiting platform approval')
})

test('scenario F: an invitation-only organization disappears from search, and can’t be asked to join', async () => {
  await signInAs(BELKIN_ADMIN)
  await mockService.setOrganizationVisibility('invitation_only')
  await newIdentity('someone@example.org')
  assert.deepEqual(await mockService.searchOrganizations('Belkin'), [])
  await assert.rejects(mockService.submitJoinRequest({ orgId: 'org-belkin' }), /isn’t accepting requests/)
})

test('scenario A: request, review, approve, and the new member is in', async () => {
  const sent = await requestToJoinBelkin('priya@example.org')
  assert.equal(sent.status, 'pending')
  assert.equal(sent.orgName, 'Belkin House')
  assert.equal((await mockService.restoreSession())?.user, undefined, 'no access while pending')

  await signInAs(BELKIN_ADMIN)
  const [request] = await mockService.listJoinRequests('pending')
  assert.equal(request!.applicantName, 'Priya Shah')
  assert.equal(request!.applicantEmail, 'priya@example.org')
  assert.equal(request!.requestedPosition, 'Case Worker')
  await mockService.approveJoinRequest(request!.id, 'STAFF')
  const members = await mockService.listOrganizationMembers()
  assert.equal(members.find((m) => m.name === 'Priya Shah')?.role, 'STAFF')

  const session = await signInAs('priya@example.org')
  assert.equal(session.user?.orgId, 'org-belkin')
  assert.equal(session.user?.orgRole, 'STAFF')
  assert.equal((await mockService.listMyJoinRequests())[0]!.status, 'approved')
})

test('scenario B: a declined request grants nothing and doesn’t share the note', async () => {
  await requestToJoinBelkin('priya@example.org')
  await signInAs(BELKIN_ADMIN)
  const [request] = await mockService.listJoinRequests('pending')
  await mockService.rejectJoinRequest(request!.id, 'Not on our staff list.')
  const session = await signInAs('priya@example.org')
  assert.equal(session.user, undefined)
  const [mine] = await mockService.listMyJoinRequests()
  assert.equal(mine!.status, 'rejected')
  assert.equal(JSON.stringify(mine).includes('staff list'), false)
})

test('scenario C: one pending request at a time, and a retry returns the same one', async () => {
  const first = await requestToJoinBelkin('priya@example.org')
  const again = await mockService.submitJoinRequest({ orgId: first.orgId })
  assert.equal(again.id, first.id)
  const [richmond] = await mockService.searchOrganizations('Richmond')
  await assert.rejects(mockService.submitJoinRequest({ orgId: richmond!.id }), /already have a request waiting/)
  await mockService.cancelJoinRequest(first.id)
  assert.equal((await mockService.submitJoinRequest({ orgId: richmond!.id })).orgName, 'Richmond House')
})

test('scenarios D and E: only an administrator of that organization can review', async () => {
  const sent = await requestToJoinBelkin('priya@example.org')
  await assert.rejects(mockService.approveJoinRequest(sent.id, 'ADMIN'), /Only your organization's administrators/)
  await signInAs('richmond@careride.demo')
  await assert.rejects(mockService.approveJoinRequest(sent.id, 'STAFF'), /wasn't found/)
  assert.deepEqual(await mockService.listJoinRequests('all'), [])
})

test('scenario G: removing a member ends their access but keeps their login', async () => {
  await requestToJoinBelkin('priya@example.org')
  await signInAs(BELKIN_ADMIN)
  const [request] = await mockService.listJoinRequests('pending')
  await mockService.approveJoinRequest(request!.id, 'STAFF')
  const priya = (await mockService.listOrganizationMembers()).find((m) => m.name === 'Priya Shah')!
  await assert.rejects(mockService.removeMember((await mockService.listOrganizationMembers()).find((m) => m.isYou)!.id), /can’t remove yourself/)
  await mockService.removeMember(priya.id)
  assert.equal(
    (await mockService.listOrganizationMembers()).some((m) => m.id === priya.id),
    false,
  )
  assert.equal((await mockService.listOrganizationMembers(true)).find((m) => m.id === priya.id)?.status, 'removed')

  const session = await signInAs('priya@example.org')
  assert.equal(session.user, undefined, 'signed in, with no organization')
  assert.equal(session.identity.email, 'priya@example.org')
})

test('scenario H: the last administrator can’t be demoted or leave', async () => {
  await requestToJoinBelkin('priya@example.org')
  await signInAs(BELKIN_ADMIN)
  const [request] = await mockService.listJoinRequests('pending')
  await mockService.approveJoinRequest(request!.id, 'ADMIN')
  const priya = (await mockService.listOrganizationMembers()).find((m) => m.name === 'Priya Shah')!
  const me = (await mockService.listOrganizationMembers()).find((m) => m.isYou)!

  await signInAs('priya@example.org')
  await mockService.setMemberRole(me.id, 'STAFF') // two administrators: fine
  await signInAs(BELKIN_ADMIN)
  await assert.rejects(mockService.setMemberRole(priya.id, 'STAFF'), /Only your organization's administrators/)
  await signInAs('priya@example.org')
  await assert.rejects(mockService.deleteMyAccount(), /at least one administrator/)
  await assert.rejects(mockService.setMemberRole(priya.id, 'STAFF'), /can’t change your own role/)
})

test('scenario I: invitations still work, and invited colleagues join as staff', async () => {
  await signInAs(BELKIN_ADMIN)
  const { token } = await mockService.createInvitation('jo@belkin.org')
  await newIdentity('jo@belkin.org', 'Jo Tan')
  const user = await mockService.acceptInvitation(token)
  assert.equal(user.orgRole, 'STAFF')
  await assert.rejects(mockService.createInvitation('x@belkin.org'), /Only your organization's administrators/)
})

test('accepting an invitation closes a request that was waiting', async () => {
  await signInAs(BELKIN_ADMIN)
  const { token } = await mockService.createInvitation('jo@belkin.org')
  const sent = await requestToJoinBelkin('jo@belkin.org', 'Jo Tan')
  await mockService.acceptInvitation(token)
  assert.equal((await mockService.listMyJoinRequests()).find((r) => r.id === sent.id)?.status, 'cancelled')
})

test('only an approved organization can become discoverable', async () => {
  await signInAs('richmond@careride.demo')
  await mockService.setOrganizationVisibility('discoverable', 'Meals and beds.')
  await newIdentity('someone@example.org')
  assert.equal((await mockService.searchOrganizations('Richmond'))[0]!.description, 'Meals and beds.')
})

test('ranking puts names that start with the search first, and highlights the match', () => {
  const entries = [{ name: 'Grace Mansion' }, { name: 'Mansion Co-op' }, { name: 'Other' }]
  assert.deepEqual(
    rankDirectory(entries, ' mans ').map((e) => e.name),
    ['Mansion Co-op', 'Grace Mansion'],
  )
  assert.deepEqual(highlightParts('Grace Mansion', 'man'), [
    { text: 'Grace ', match: false },
    { text: 'Man', match: true },
    { text: 'sion', match: false },
  ])
})

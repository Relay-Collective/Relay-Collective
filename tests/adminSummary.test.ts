import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminTitle } from '../src/admin/navigation'
import { adminPaths } from '../src/admin/paths'
import {
  approvalQueue,
  matches,
  page,
  platformMetrics,
  recentDecisions,
  recentIssues,
  registrationActivity,
  reportedIssues,
  rideStage,
  rideStageCounts,
  sortBy,
} from '../src/logic/adminSummary'
import type { DataService } from '../src/services/dataService'
import type { Driver, Organization, Ride, RideFeedback, User } from '../src/types'

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
const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD } = await import('../src/services/seed')

const org = (extra: Partial<Organization>): Organization => ({
  id: 'o',
  name: 'Org',
  type: 'PARTNER_ORG',
  contactName: 'Pat',
  contactPhone: '604-555-0000',
  status: 'APPROVED',
  ...extra,
})

const driver = (extra: Partial<Driver>): Driver => ({
  id: 'd',
  userId: 'u',
  background: 'INDEPENDENT',
  vehicle: 'Sedan',
  wheelchairAccessible: false,
  seats: 3,
  serviceCities: ['Vancouver'],
  requestHours: [null, null, null, null, null, null, null],
  status: 'APPROVED',
  ...extra,
})

const ride = (extra: Partial<Ride>): Ride => ({
  id: 'r',
  type: 'SCHEDULED',
  orgId: 'o1',
  houseId: 'h1',
  requestedBy: 'u1',
  passengers: 1,
  pickupAddress: '555 Homer St',
  destinationName: 'Clinic',
  destinationAddress: '1 Main St',
  pickupTime: '2026-10-20T16:00:00.000Z',
  needsWheelchair: false,
  needsAssistance: false,
  status: 'OFFERED',
  estimatedFareSaved: 0,
  createdAt: '2026-10-18T16:00:00.000Z',
  ...extra,
})

const orgs = [
  org({ id: 'o-new', status: 'PENDING', createdAt: '2026-10-10T00:00:00.000Z' }),
  org({ id: 'o-old', status: 'PENDING', createdAt: '2026-10-01T00:00:00.000Z' }),
  org({ id: 'o-undated', status: 'PENDING' }),
  org({ id: 'o-ok', type: 'TRANSPORT_PROVIDER', createdAt: '2026-09-01T00:00:00.000Z', reviewedAt: '2026-09-02T00:00:00.000Z', reviewedBy: 'admin' }),
]
const drivers = [
  driver({ id: 'd-wait', status: 'PENDING', createdAt: '2026-10-05T00:00:00.000Z' }),
  driver({ id: 'd-no', status: 'REJECTED', createdAt: '2026-09-20T00:00:00.000Z', reviewedAt: '2026-09-21T00:00:00.000Z' }),
]

test('the approval queue is oldest first, with undated records last', () => {
  assert.deepEqual(
    approvalQueue(orgs, drivers).map((i) => i.id),
    ['o-old', 'd-wait', 'o-new', 'o-undated'],
  )
  assert.deepEqual(
    recentDecisions(orgs, drivers).map((i) => [i.id, i.status]),
    [
      ['d-no', 'REJECTED'],
      ['o-ok', 'APPROVED'],
    ],
  )
})

test('activity lists registrations and the latest decision, never a decision on a pending record', () => {
  const events = registrationActivity(orgs, drivers)
  assert.deepEqual(events.slice(0, 3).map((e) => `${e.subjectId}:${e.kind}`), ['o-new:REGISTERED', 'd-wait:REGISTERED', 'o-old:REGISTERED'])
  assert.ok(events.some((e) => e.subjectId === 'o-ok' && e.kind === 'APPROVED' && e.actorId === 'admin'))
  assert.ok(events.some((e) => e.subjectId === 'd-no' && e.kind === 'REJECTED'))
  // A record put back to pending keeps its old review time, but that isn't shown as a decision
  assert.equal(registrationActivity([org({ id: 'x', status: 'PENDING', reviewedAt: '2026-10-01T00:00:00.000Z' })], []).length, 0)
})

test('issues are driver flags and thumbs-down ratings, newest first', () => {
  const feedback: RideFeedback[] = [
    { id: 'f1', rideId: 'r1', authorRole: 'PARTNER', orgId: 'o1', rating: 'UP', at: '2026-10-19T00:00:00.000Z' },
    { id: 'f2', rideId: 'r1', authorRole: 'PARTNER', orgId: 'o1', rating: 'DOWN', at: '2026-10-18T00:00:00.000Z' },
    { id: 'f3', rideId: 'r2', authorRole: 'DRIVER', orgId: 'o1', driverId: 'd1', note: 'Wrong address', at: '2026-10-20T00:00:00.000Z' },
  ]
  const issues = reportedIssues(feedback, [ride({ id: 'r1' })])
  assert.deepEqual(issues.map((i) => [i.id, i.kind, i.ride?.id]), [
    ['f3', 'DRIVER_FLAG', undefined],
    ['f2', 'POOR_RATING', 'r1'],
  ])
  assert.equal(recentIssues(issues, new Date('2026-11-02T00:00:00.000Z')).length, 1) // 14 days back reaches Oct 19
})

test('ride stages split every status, and an accepted ride is under way once the driver sets off', () => {
  assert.equal(rideStage(ride({ status: 'ACCEPTED' })), 'scheduled')
  assert.equal(rideStage(ride({ status: 'ACCEPTED', driverOnTheWayAt: '2026-10-20T15:40:00.000Z' })), 'underWay')
  assert.equal(rideStage(ride({ status: 'NO_SHOW' })), 'closed')
  const counts = rideStageCounts([ride({ status: 'SEARCHING' }), ride({ status: 'NEEDS_ATTENTION' }), ride({ status: 'COMPLETED' })])
  assert.deepEqual(counts, { waiting: 1, noDriver: 1, scheduled: 0, underWay: 0, completed: 1, closed: 0 })
})

test('platform metrics count what is there', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }] as User[]
  const m = platformMetrics({ orgs, drivers, accounts, rides: [ride({ status: 'COMPLETED' }), ride({ status: 'PICKED_UP' })] })
  assert.deepEqual(m, { organizations: 4, partnerOrgs: 3, providers: 1, pendingOrgs: 3, accounts: 2, verifiedDrivers: 0, pendingDrivers: 1, activeRides: 1, completedRides: 1 })
})

test('table helpers sort missing values last and keep pages in range', () => {
  const rows = [{ v: 'b' }, { v: undefined }, { v: 'a' }]
  assert.deepEqual(sortBy(rows, (r) => r.v, 'asc').map((r) => r.v), ['a', 'b', undefined])
  assert.deepEqual(sortBy(rows, (r) => r.v, 'desc').map((r) => r.v), ['b', 'a', undefined])
  assert.deepEqual(page([1, 2, 3, 4, 5], 9, 2), { items: [5], pages: 3, index: 2 })
  assert.deepEqual(page([], 0, 2), { items: [], pages: 1, index: 0 })
  assert.equal(matches('  BELK ', 'Belkin House'), true)
  assert.equal(matches('x', undefined, 'abc'), false)
})

test('admin titles follow the address', () => {
  assert.equal(adminTitle(adminPaths.overview), 'Dashboard')
  assert.equal(adminTitle(adminPaths.review('drivers', 'd1')), 'Approvals')
  assert.equal(adminTitle(adminPaths.ride('r1')), 'CareRide')
})

test('only a platform admin can list every ride, and reviews record who decided and when', async () => {
  resetDemoData()
  await mockService.signIn('belkin@careride.demo', DEMO_PASSWORD)
  await assert.rejects(mockService.listAllRides(), /Only a Relay Collective admin/)

  const admin = await mockService.signIn(ADMIN_EMAIL, ADMIN_PASSWORD)
  const rides = await mockService.listAllRides()
  assert.ok(rides.length > 0)
  assert.ok(rides.every((r, i) => i === 0 || rides[i - 1].pickupTime >= r.pickupTime), 'newest pickup first')

  const target = (await mockService.listOrganizations())[0]
  const reviewed = await mockService.setOrgStatus(target.id, 'APPROVED')
  assert.equal(reviewed.reviewedBy, admin.user?.id)
  assert.ok(reviewed.reviewedAt)
  await mockService.signOut()
})

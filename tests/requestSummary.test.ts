import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  actionItems,
  inView,
  matchesQuery,
  recentActivity,
  REQUEST_VIEWS,
  requestMetrics,
  requestReference,
  sortForView,
} from '../src/modules/careride/logic/requestSummary'
import type { Ride } from '../src/types'
import { inCareRide, rideIdFromPath } from '../src/modules/careride/paths'
import { paths } from '../src/workspace/paths'
import { ACTIVE_MODULES, CARERIDE, FEATURED_PLANNED, PLANNED_MODULES } from '../src/workspace/modules'
import { workspaceTitle } from '../src/workspace/navigation'

const NOW = new Date('2026-10-20T12:00:00.000Z')
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()

function ride(extra: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    type: 'SCHEDULED',
    orgId: 'org-belkin',
    houseId: 'house-belkin',
    requestedBy: 'u-belkin',
    passengers: 1,
    pickupAddress: '555 Homer St, Vancouver',
    destinationName: "St. Paul's Hospital",
    destinationAddress: '1081 Burrard St, Vancouver',
    pickupTime: hoursFromNow(48),
    needsWheelchair: false,
    needsAssistance: false,
    status: 'OFFERED',
    estimatedFareSaved: 2.58,
    createdAt: hoursFromNow(-24),
    ...extra,
  }
}

const rides: Ride[] = [
  ride({ id: 'r-waiting', status: 'OFFERED' }),
  ride({ id: 'r-soon', status: 'SEARCHING', pickupTime: hoursFromNow(3) }),
  ride({ id: 'r-no-driver', status: 'NEEDS_ATTENTION' }),
  ride({ id: 'r-dropped', status: 'SEARCHING', droppedBy: { driverId: 'd1', at: hoursFromNow(-1) } }),
  ride({ id: 'r-late', status: 'ACCEPTED', driverId: 'd1', acceptedAt: hoursFromNow(-5), pickupTime: hoursFromNow(-1) }),
  ride({ id: 'r-confirmed', status: 'ACCEPTED', driverId: 'd1', acceptedAt: hoursFromNow(-2) }),
  ride({ id: 'r-riding', status: 'PICKED_UP', driverId: 'd1', pickedUpAt: hoursFromNow(-0.5), pickupTime: hoursFromNow(-0.6) }),
  ride({ id: 'r-done', status: 'COMPLETED', completedAt: hoursFromNow(-30), pickupTime: hoursFromNow(-31) }),
  ride({ id: 'r-old', status: 'COMPLETED', completedAt: hoursFromNow(-24 * 40), pickupTime: hoursFromNow(-24 * 40) }),
  ride({ id: 'r-transit', status: 'CANCELLED', cancelReason: 'Sent on transit. Gave a Compass Ticket.', cancelledAt: hoursFromNow(-3) }),
]

test('every open request is in exactly one of attention, waiting, and confirmed', () => {
  for (const r of rides.filter((x) => inView(x, 'open', NOW))) {
    const views = (['attention', 'waiting', 'confirmed'] as const).filter((v) => inView(r, v, NOW))
    assert.equal(views.length, 1, `${r.id} is in ${views.join(', ') || 'none'}`)
  }
  for (const r of rides.filter((x) => inView(x, 'past', NOW))) assert.equal(inView(r, 'open', NOW), false)
  assert.ok(REQUEST_VIEWS.some((v) => v.id === 'open'))
})

test('metrics count only real rides, and completed means the last 30 days', () => {
  assert.deepEqual(requestMetrics(rides, NOW), { open: 7, attention: 3, waiting: 2, confirmed: 2, completedRecently: 1 })
  assert.deepEqual(requestMetrics([], NOW), { open: 0, attention: 0, waiting: 0, confirmed: 0, completedRecently: 0 })
})

test('action items list urgent rides first, then waiting rides picking up within a day', () => {
  const items = actionItems(rides, NOW)
  assert.deepEqual(
    items.map((i) => [i.ride.id, i.urgency]),
    [
      ['r-late', 'urgent'],
      ['r-no-driver', 'urgent'],
      ['r-dropped', 'urgent'],
      ['r-soon', 'soon'],
    ],
  )
  assert.equal(items[0].title, 'Driver is late')
  assert.match(items[3].reason, /^Pickup in 3 h\./)
  // A request asked for right now is already being dispatched, so it isn't flagged as "soon"
  assert.equal(actionItems([ride({ type: 'ON_DEMAND', status: 'SEARCHING', pickupTime: hoursFromNow(0) })], NOW).length, 0)
})

test('recent activity comes from ride timestamps, newest first', () => {
  const items = recentActivity(rides, 4)
  assert.deepEqual(
    items.map((i) => `${i.ride.id}:${i.kind}`),
    ['r-riding:PICKED_UP', 'r-confirmed:CONFIRMED', 'r-transit:TRANSIT', 'r-late:CONFIRMED'],
  )
  // A completed time is only shown when the ride is still completed (a driver can undo it)
  const undone = ride({ id: 'r-undone', status: 'PICKED_UP', completedAt: undefined, pickedUpAt: hoursFromNow(-1) })
  assert.ok(!recentActivity([undone], 10).some((i) => i.kind === 'COMPLETED'))
})

test('the past view is most recently finished first; open views by pickup', () => {
  const past = sortForView(rides.filter((r) => inView(r, 'past', NOW)), 'past')
  assert.deepEqual(past.map((r) => r.id), ['r-transit', 'r-done', 'r-old'])
  const open = sortForView(rides.filter((r) => inView(r, 'open', NOW)), 'open')
  assert.equal(open[0].id, 'r-late')
})

test('search matches places and references, not rider names', () => {
  const r = ride({ id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', riderNames: ['Sam Rivera'] })
  assert.equal(requestReference(r.id), 'F90AE7')
  assert.equal(matchesQuery(r, '#f90ae7'), true)
  assert.equal(matchesQuery(r, 'paul'), true)
  assert.equal(matchesQuery(r, 'Rivera'), false)
  assert.equal(matchesQuery(r, '  '), true)
})

test('workspace paths and titles line up', () => {
  assert.equal(rideIdFromPath(paths.ride('abc')), 'abc')
  assert.equal(rideIdFromPath(paths.transport), undefined)
  assert.equal(workspaceTitle(paths.overview), 'Overview')
  // CareRide's pages, including the requests list at its old address, all sit under the module's name
  assert.equal(workspaceTitle(paths.ride('abc')), 'CareRide')
  assert.equal(workspaceTitle(`${paths.requests}`), 'CareRide')
  assert.equal(workspaceTitle(paths.services), 'Modules')
  assert.equal(inCareRide(paths.requests), true)
  assert.equal(inCareRide(paths.destinations), true)
  assert.equal(inCareRide(paths.team), false)
})

test('CareRide is the only active module, and opens the existing transportation home', () => {
  assert.deepEqual(
    ACTIVE_MODULES.map((m) => m.id),
    ['careride'],
  )
  assert.equal(CARERIDE.route, paths.transport)
  assert.ok(PLANNED_MODULES.every((m) => !('route' in m)))
  assert.deepEqual(
    FEATURED_PLANNED.map((m) => m.id),
    ['volunteer-coordination', 'resource-sharing'],
  )
})

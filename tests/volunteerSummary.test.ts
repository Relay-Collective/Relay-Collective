import assert from 'node:assert/strict'
import { test } from 'node:test'
import { driverTimeline } from '../src/logic/driverTimeline'
import { ALL_DAY, hoursOn } from '../src/logic/requestHours'
import { commitmentsFrom, groupDriverRides, impactSummary, volunteerActions, type OpenOffer } from '../src/logic/volunteerSummary'
import type { Driver, Ride } from '../src/types'
import { canDrive, driverKind, serviceRoles } from '../src/volunteer/participation'
import { verificationRequirements } from '../src/volunteer/verification'

const now = new Date('2026-10-20T18:00:00.000Z')

function ride(id: string, extra: Partial<Ride> = {}): Ride {
  return {
    id,
    type: 'SCHEDULED',
    orgId: 'o1',
    houseId: 'h1',
    requestedBy: 'u1',
    passengers: 1,
    pickupAddress: '1 Main St',
    destinationName: 'Clinic',
    destinationAddress: '2 Main St',
    pickupTime: '2026-10-21T18:00:00.000Z',
    needsWheelchair: false,
    needsAssistance: false,
    status: 'ACCEPTED',
    driverId: 'd1',
    estimatedFareSaved: 0,
    createdAt: '2026-10-19T18:00:00.000Z',
    ...extra,
  }
}

function driver(extra: Partial<Driver> = {}): Driver {
  return {
    id: 'd1',
    userId: 'u-d1',
    background: 'INDEPENDENT',
    vehicle: 'White sedan',
    wheelchairAccessible: false,
    seats: 3,
    serviceCities: ['Vancouver'],
    requestHours: hoursOn([0, 1, 2, 3, 4, 5, 6], ALL_DAY),
    status: 'APPROVED',
    ...extra,
  }
}

test('groups a driver’s rides by where they are in the lifecycle', () => {
  const groups = groupDriverRides([
    ride('later', { pickupTime: '2026-10-23T18:00:00.000Z' }),
    ride('soon'),
    ride('started', { driverOnTheWayAt: '2026-10-20T17:50:00.000Z' }),
    ride('riding', { status: 'PICKED_UP' }),
    ride('done', { status: 'COMPLETED', completedAt: '2026-10-19T19:00:00.000Z' }),
    ride('noshow', { status: 'NO_SHOW', cancelledAt: '2026-10-20T12:00:00.000Z' }),
    ride('off', { status: 'CANCELLED', cancelledAt: '2026-10-18T12:00:00.000Z' }),
  ])
  assert.deepEqual(groups.upcoming.map((r) => r.id), ['soon', 'later'])
  assert.deepEqual(groups.active.map((r) => r.id).sort(), ['riding', 'started'])
  assert.deepEqual(groups.completed.map((r) => r.id), ['noshow', 'done'])
  assert.deepEqual(groups.cancelled.map((r) => r.id), ['off'])
})

test('impact counts only drop-offs, from real passenger counts', () => {
  const impact = impactSummary(
    [
      ride('a', { status: 'COMPLETED', passengers: 2, completedAt: '2026-10-02T10:00:00.000Z' }),
      ride('b', { status: 'COMPLETED', passengers: 1, completedAt: '2026-09-28T10:00:00.000Z' }),
      ride('c', { status: 'NO_SHOW', passengers: 4, cancelledAt: '2026-10-03T10:00:00.000Z' }),
      ride('d', { status: 'ACCEPTED', passengers: 3 }),
    ],
    now,
  )
  assert.deepEqual(impact, { ridesCompleted: 2, passengersDriven: 3, thisMonth: 1 })
})

test('a driver in review sees only the review, never ride tasks', () => {
  const actions = volunteerActions(driver({ status: 'PENDING' }), groupDriverRides([ride('x')]), [], now)
  assert.deepEqual(actions.map((a) => a.kind), ['VERIFICATION_PENDING'])
  assert.deepEqual(volunteerActions(driver({ status: 'REJECTED' }), undefined, undefined, now).map((a) => a.kind), ['VERIFICATION_REJECTED'])
})

test('action items come from real states, most urgent first', () => {
  const offers: OpenOffer[] = [
    { offer: { id: 'o1', rideId: 'r1', driverId: 'd1', status: 'PENDING', sentAt: '', expiresAt: '' }, ride: ride('r1', { status: 'OFFERED' }) },
    { offer: { id: 'o2', rideId: 'r2', driverId: 'd1', status: 'PENDING', sentAt: '', expiresAt: '' }, ride: ride('r2', { status: 'OFFERED', reconfirmDriverId: 'd1' }) },
  ]
  const groups = groupDriverRides([ride('trip', { status: 'PICKED_UP' }), ride('tomorrow'), ride('next-week', { pickupTime: '2026-10-27T18:00:00.000Z' })])
  const kinds = volunteerActions(driver(), groups, offers, now).map((a) => a.kind)
  assert.deepEqual(kinds, ['RECONFIRM', 'RESPOND', 'UNDER_WAY', 'SOON'])
})

test('no request hours or an unfinished profile are flagged', () => {
  const kinds = volunteerActions(driver({ requestHours: hoursOn([], ALL_DAY), serviceCities: [] }), groupDriverRides([]), [], now).map((a) => a.kind)
  assert.deepEqual(kinds, ['NO_HOURS', 'PROFILE_INCOMPLETE'])
})

test('commitments list trips under way before upcoming ones', () => {
  const list = commitmentsFrom(groupDriverRides([ride('next'), ride('now', { driverArrivedAt: '2026-10-20T17:55:00.000Z' })]))
  assert.deepEqual(list.map((c) => [c.id, c.underWay]), [['now', true], ['next', false]])
})

test('the timeline follows the recorded steps and marks the next one', () => {
  const steps = driverTimeline(ride('r', { acceptedAt: 'a', driverOnTheWayAt: 'b' }))
  assert.deepEqual(steps.map((s) => s.state), ['done', 'done', 'current', 'upcoming', 'upcoming'])
  const done = driverTimeline(ride('r', { status: 'COMPLETED', acceptedAt: 'a', pickedUpAt: 'c', completedAt: 'd' }))
  assert.equal(done.at(-1)?.state, 'done')
  assert.ok(!done.some((s) => s.state === 'current'))
})

test('a ride that stopped short ends with what stopped it', () => {
  const steps = driverTimeline(ride('r', { status: 'NO_SHOW', acceptedAt: 'a', driverArrivedAt: 'b', cancelledAt: 'c' }))
  assert.deepEqual(steps.map((s) => s.label), ['Accepted', 'Arrived at pickup', 'Passenger didn’t show'])
  assert.equal(steps.at(-1)?.state, 'stopped')
})

test('participation comes from the account, and only approved drivers can drive', () => {
  assert.equal(driverKind({ background: 'TAXI' }), 'PROFESSIONAL_PROVIDER')
  assert.equal(driverKind({ background: 'INDEPENDENT', orgId: 'org' }), 'ORGANIZATION_DRIVER')
  assert.equal(driverKind({ background: 'INDEPENDENT' }), 'VOLUNTEER_DRIVER')
  assert.deepEqual(serviceRoles({ role: 'PARTNER' }, driver()), [])
  assert.equal(serviceRoles({ role: 'DRIVER' }, driver({ status: 'PENDING' }))[0].status, 'PENDING')
  assert.equal(canDrive(driver({ status: 'PENDING' })), false)
  assert.equal(canDrive(driver({ status: 'REJECTED', background: 'TAXI' })), false)
  assert.equal(canDrive(driver()), true)
})

test('verification asks professionals for a permit too, and never marks review done before approval', () => {
  const pro = verificationRequirements(driver({ background: 'RIDESHARE', status: 'PENDING', licenceFile: 'licence.pdf' }))
  assert.equal(pro[2].label, 'Licence and professional permit')
  assert.equal(pro[2].state, 'waiting')
  assert.equal(pro[3].state, 'waiting')
  assert.equal(verificationRequirements(driver())[3].state, 'done')
})

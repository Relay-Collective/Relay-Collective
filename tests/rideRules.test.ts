import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hoursOn, ALL_DAY, DEFAULT_REQUEST_HOURS, isWithinRequestHours } from '../src/logic/requestHours'
import { matchDrivers } from '../src/logic/matchDrivers'
import {
  canMarkNoShow,
  canWaitForDrivers,
  driversToAddToOpenRide,
  driversToAsk,
  editSendsRideAgain,
  isExpired,
  noDriverDeadline,
  NO_SHOW_WAIT_MINUTES,
  offerExpiry,
  partnerCloseCancelsRide,
  pickupTimeAfterEdit,
} from '../src/logic/dispatch'
import type { Driver, House, Ride, RideOffer } from '../src/types'

const anytime = hoursOn([0, 1, 2, 3, 4, 5, 6], ALL_DAY)
const never = hoursOn([], ALL_DAY)
const at = new Date('2026-10-04T18:00:00.000Z')

function driver(id: string, extra: Partial<Driver> = {}): Driver {
  return {
    id,
    userId: id,
    background: 'INDEPENDENT',
    vehicle: 'White sedan',
    wheelchairAccessible: false,
    seats: 3,
    serviceCities: ['Vancouver'],
    requestHours: anytime,
    status: 'APPROVED',
    ...extra,
  }
}

function ride(extra: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    type: 'ON_DEMAND',
    orgId: 'org',
    houseId: 'house',
    requestedBy: 'staff',
    passengers: 1,
    pickupAddress: '1 Main St',
    destinationName: 'Clinic',
    destinationAddress: '2 Oak St',
    pickupTime: at.toISOString(),
    needsWheelchair: false,
    needsAssistance: false,
    status: 'SEARCHING',
    estimatedFareSaved: 2.58,
    createdAt: at.toISOString(),
    ...extra,
  }
}

const house: House = {
  id: 'house',
  orgId: 'org',
  name: 'Belkin House',
  address: '1 Main St',
  city: 'Vancouver',
  phone: '604-555-0120',
}

function offer(extra: Partial<RideOffer> = {}): RideOffer {
  return {
    id: 'offer-1',
    rideId: 'ride-1',
    driverId: 'frank',
    status: 'PENDING',
    sentAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + 60_000).toISOString(),
    ...extra,
  }
}

test('offer windows are 5 minutes on demand and 60 when scheduled', () => {
  assert.equal(offerExpiry('ON_DEMAND', at), new Date(at.getTime() + 5 * 60_000).toISOString())
  assert.equal(offerExpiry('SCHEDULED', at), new Date(at.getTime() + 60 * 60_000).toISOString())
})

test('a pending offer is expired only once its deadline has passed', () => {
  assert.equal(isExpired(offer(), at), false)
  assert.equal(isExpired(offer({ expiresAt: at.toISOString() }), at), true)
  assert.equal(isExpired(offer({ status: 'DECLINED', expiresAt: at.toISOString() }), at), false)
})

test('an uncovered on-demand ride is called off 30 minutes after booking, a scheduled one at pickup', () => {
  assert.equal(noDriverDeadline(ride()).toISOString(), new Date(at.getTime() + 30 * 60_000).toISOString())
  assert.equal(noDriverDeadline(ride({ type: 'SCHEDULED' })).toISOString(), at.toISOString())
})

test('matching keeps approved drivers who fit the city, seats, wheelchair, and request hours', () => {
  const drivers = [
    driver('frank'),
    driver('pending', { status: 'PENDING' }),
    driver('richmond', { serviceCities: ['Richmond'] }),
    driver('full', { seats: 1 }),
    driver('van', { wheelchairAccessible: true, seats: 4 }),
    driver('off', { requestHours: never }),
  ]
  const walking = ride({ passengers: 2 })
  const ids = matchDrivers(walking, house, drivers, [], at).map((d) => d.id)
  assert.deepEqual(ids, ['frank', 'van'])

  const chair = ride({ needsWheelchair: true })
  assert.deepEqual(
    matchDrivers(chair, house, drivers, [], at).map((d) => d.id),
    ['van'],
  )
})

test('a preferred driver is asked alone, and someone already asked is skipped', () => {
  const frank = driver('frank')
  const maya = driver('maya')
  const preferred = ride({ preferredDriverId: 'maya' })
  assert.deepEqual(
    driversToAsk(preferred, house, [frank, maya], []).map((d) => d.id),
    ['maya'],
  )
  const asked: RideOffer[] = [offer({ driverId: 'maya', status: 'DECLINED' })]
  assert.deepEqual(
    driversToAsk(preferred, house, [frank, maya], asked).map((d) => d.id),
    ['frank'],
  )
})

// Stakeholder testing, 2026-11-09: a request already out to one driver never reached drivers who became able to take
// it afterwards (approved later, request hours turned on, city added), so only the first driver ever saw it.
test('drivers who can take a request that is already out are added to it', () => {
  const out = ride({ status: 'OFFERED' })
  const firstAsked = [offer({ driverId: 'frank' })]
  const drivers = [driver('frank'), driver('stakeholder'), driver('brand-new')]
  assert.deepEqual(
    driversToAddToOpenRide(out, house, drivers, firstAsked).map((d) => d.id),
    ['stakeholder', 'brand-new'],
  )
})

test('every driver with the same settings is asked about the same request, however late they became eligible', () => {
  const out = ride({ status: 'OFFERED' })
  const offers = [offer({ driverId: 'frank' })]
  const twins = ['frank', 'a', 'b', 'c'].map((id) => driver(id))
  const added = driversToAddToOpenRide(out, house, twins, offers).map((d) => d.id)
  // Everyone who isn't already deciding is asked; nobody with identical settings is left out
  assert.deepEqual([...offers.map((o) => o.driverId), ...added].sort(), twins.map((d) => d.id).sort())
})

test('drivers who still cannot take it, or already answered, are not added to a request that is out', () => {
  const out = ride({ status: 'OFFERED' })
  const offers = [offer({ driverId: 'frank' }), offer({ id: 'o2', driverId: 'declined', status: 'DECLINED' })]
  const drivers = [
    driver('frank'),
    driver('declined'),
    driver('pending', { status: 'PENDING' }),
    driver('off', { requestHours: never }),
    driver('richmond', { serviceCities: ['Richmond'] }),
    driver('busy'),
  ]
  assert.deepEqual(driversToAddToOpenRide(out, house, drivers, offers, ['busy']), [])
})

test('nobody joins while a preferred driver is being asked alone, or once the ride is no longer out', () => {
  const returnTrip = ride({ status: 'OFFERED', preferredDriverId: 'frank' })
  const drivers = [driver('frank'), driver('maya')]
  assert.deepEqual(driversToAddToOpenRide(returnTrip, house, drivers, [offer({ driverId: 'frank' })]), [])
  // Once the preferred driver has said no, everyone else can be asked
  assert.deepEqual(
    driversToAddToOpenRide(returnTrip, house, drivers, [offer({ driverId: 'frank', status: 'DECLINED' })]).map((d) => d.id),
    ['maya'],
  )
  for (const status of ['SEARCHING', 'ACCEPTED', 'NEEDS_ATTENTION', 'CANCELLED'] as const) {
    assert.deepEqual(driversToAddToOpenRide(ride({ status }), house, drivers, []), [], status)
  }
})

test('drivers with identical settings all match, however their account was made or how long ago', () => {
  const ways: Partial<Driver>[] = [
    {}, // driver sign-up
    { appliedAsVolunteer: true }, // general volunteer who applied from their workspace
    { background: 'TAXI' },
    { background: 'RIDESHARE' },
    { background: 'ORG_DRIVER', orgId: 'provider' }, // added by a transport provider
    { reviewedAt: '2026-01-01T00:00:00.000Z' }, // an account from long before today
  ]
  const drivers = ways.map((extra, i) => driver(`d${i}`, extra))
  for (const type of ['ON_DEMAND', 'SCHEDULED'] as const) {
    const ids = matchDrivers(ride({ type }), house, drivers, [], at).map((d) => d.id)
    assert.deepEqual(ids.sort(), drivers.map((d) => d.id).sort(), type)
    // The order they're stored in doesn't decide who is asked
    const reversed = matchDrivers(ride({ type }), house, [...drivers].reverse(), [], at).map((d) => d.id)
    assert.deepEqual(reversed.sort(), ids)
  }
})

test('everyone who fits is asked at once, not only the first match', () => {
  const twins = [driver('mine'), driver('stakeholder'), driver('new-account')]
  assert.deepEqual(
    driversToAsk(ride(), house, twins, []).map((d) => d.id).sort(),
    ['mine', 'new-account', 'stakeholder'],
  )
})

test('a busy driver is skipped, and only that driver', () => {
  const twins = [driver('busy'), driver('free')]
  assert.deepEqual(driversToAsk(ride(), house, twins, [], ['busy']).map((d) => d.id), ['free'])
})

test('new drivers start with weekday daytime request hours, so evenings and weekends get no requests', () => {
  // Local times, like the app: Monday 9 November 2026
  assert.equal(isWithinRequestHours(DEFAULT_REQUEST_HOURS, new Date(2026, 10, 9, 10, 0)), true, 'Monday 10 AM')
  assert.equal(isWithinRequestHours(DEFAULT_REQUEST_HOURS, new Date(2026, 10, 9, 18, 0)), false, 'Monday 6 PM')
  assert.equal(isWithinRequestHours(DEFAULT_REQUEST_HOURS, new Date(2026, 10, 8, 10, 0)), false, 'Sunday 10 AM')
  assert.equal(isWithinRequestHours(anytime, new Date(2026, 10, 9, 18, 0)), true, 'an any-time driver still gets it')
})

test('a scheduled ride can wait for a driver whose request hours are closed right now', () => {
  const later = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
  const scheduled = ride({ type: 'SCHEDULED', pickupTime: later })
  const sleepy = driver('frank', { requestHours: never })
  assert.equal(canWaitForDrivers(scheduled, house, [sleepy], []), true)
  assert.equal(canWaitForDrivers(ride(), house, [sleepy], []), false)
  assert.equal(canWaitForDrivers(scheduled, house, [], []), false)
})

test('a no-show waits until 10 minutes after the driver arrives', () => {
  const arrived = ride({ status: 'ACCEPTED', driverArrivedAt: at.toISOString() })
  assert.equal(canMarkNoShow(ride({ status: 'ACCEPTED' }), at.getTime()), false)
  assert.equal(canMarkNoShow(arrived, at.getTime() + (NO_SHOW_WAIT_MINUTES - 1) * 60_000), false)
  assert.equal(canMarkNoShow(arrived, at.getTime() + NO_SHOW_WAIT_MINUTES * 60_000), true)
})

test('closing a partner account leaves a ride the driver has already started', () => {
  assert.equal(partnerCloseCancelsRide(ride({ status: 'OFFERED' })), true)
  assert.equal(partnerCloseCancelsRide(ride({ status: 'ACCEPTED' })), true)
  assert.equal(partnerCloseCancelsRide(ride({ status: 'ACCEPTED', driverOnTheWayAt: at.toISOString() })), false)
  assert.equal(partnerCloseCancelsRide(ride({ status: 'ACCEPTED', driverArrivedAt: at.toISOString() })), false)
  assert.equal(partnerCloseCancelsRide(ride({ status: 'PICKED_UP' })), false)
})

test('notes keep an on-demand give-up clock, and a new destination restarts it', () => {
  const before = ride()
  const notes = { ...before, notes: 'Meet in the lobby' }
  assert.equal(editSendsRideAgain(before, notes), false)
  assert.equal(pickupTimeAfterEdit(before, notes, '2026-10-04T19:00:00.000Z'), before.pickupTime)

  const moved = { ...before, destinationAddress: '9 Pine St' }
  assert.equal(editSendsRideAgain(before, moved), true)
  assert.equal(pickupTimeAfterEdit(before, moved, '2026-10-04T19:00:00.000Z'), '2026-10-04T19:00:00.000Z')

  const later = { ...before, type: 'SCHEDULED' as const, pickupTime: '2026-10-05T18:00:00.000Z' }
  assert.equal(editSendsRideAgain(before, later), true)
  assert.equal(pickupTimeAfterEdit(before, later, '2026-10-04T19:00:00.000Z'), later.pickupTime)
})

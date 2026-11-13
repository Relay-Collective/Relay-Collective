import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CAPACITY_LOCKED } from '../src/logic/capacity'
import { NO_SHOW_NOT_HERE, NO_SHOW_TOO_SOON } from '../src/logic/dispatch'
import type { DataService } from '../src/services/dataService'
import type { Ride } from '../src/types'

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

const { mockService, resetDemoData } = await import('../src/services/mockService')

const PASSWORD = 'careride'

function booking(pickupTime: string, destinationAddress = '1081 Burrard St, Vancouver'): Parameters<DataService['requestRide']>[0] {
  return {
    type: 'ON_DEMAND',
    orgId: 'org-belkin',
    houseId: 'house-belkin',
    requestedBy: 'u-belkin',
    passengers: 1,
    riderNames: ['Alex'],
    pickupAddress: '555 Homer St, Vancouver',
    destinationName: "St. Paul's Hospital",
    destinationAddress,
    pickupTime,
    needsWheelchair: false,
    needsAssistance: false,
    estimatedFareSaved: 2.58,
  }
}

function changes(ride: Ride, extra: Partial<Ride> = {}) {
  return {
    type: ride.type,
    pickupTime: ride.pickupTime,
    passengers: ride.passengers,
    riderNames: ride.riderNames,
    needsWheelchair: ride.needsWheelchair,
    needsAssistance: ride.needsAssistance,
    pickupInstructions: ride.pickupInstructions,
    notes: ride.notes,
    destinationId: ride.destinationId,
    destinationName: ride.destinationName,
    destinationAddress: ride.destinationAddress,
    ...extra,
  }
}

test('the demo backend keeps an on-demand clock on a notes edit, and blocks an early no-show', async () => {
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const pickupTime = new Date().toISOString()
  const booked = await mockService.requestRide(booking(pickupTime))
  const noted = await mockService.updateRide(booked.id, changes(booked, { notes: 'Meet in the lobby' }))
  assert.equal(noted.pickupTime, pickupTime)
  assert.equal(noted.notes, 'Meet in the lobby')
  assert.equal(noted.status, booked.status)

  await mockService.signIn('frank@careride.demo', PASSWORD)
  const offers = await mockService.listMyOffers('d-frank')
  const mine = offers.find((offer) => offer.rideId === booked.id)
  assert.ok(mine)
  await mockService.respondToOffer(mine.id, true)
  await assert.rejects(mockService.markNoShow(booked.id), { message: NO_SHOW_NOT_HERE })
  await mockService.markDriverArrived(booked.id)
  await assert.rejects(mockService.markNoShow(booked.id), { message: NO_SHOW_TOO_SOON })
  await mockService.markOnTheWay(booked.id)

  const second = await mockService.requestRide(booking(new Date().toISOString(), '899 W 12th Ave, Vancouver'))
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  await mockService.deleteMyAccount()

  const started = await mockService.getRide(booked.id)
  const waiting = await mockService.getRide(second.id)
  assert.equal(started?.status, 'ACCEPTED')
  assert.ok(started?.driverOnTheWayAt)
  assert.equal(waiting?.status, 'CANCELLED')
})

test('an approved driver can change their vehicle description, not how many people it holds', async () => {
  await mockService.signIn('frank@careride.demo', PASSWORD)
  await assert.rejects(mockService.updateDriver('d-frank', { seats: 8 }), { message: CAPACITY_LOCKED })
  const saved = await mockService.updateDriver('d-frank', { vehicle: 'Black SUV with a roof rack' })
  assert.equal(saved.vehicle, 'Black SUV with a roof rack')
  assert.equal(saved.seats, 3)
  assert.equal(saved.wheelchairAccessible, false)

  const pending = await mockService.updateDriver('d-jordan', { seats: 2, wheelchairAccessible: true })
  assert.equal(pending.seats, 2)
  assert.equal(pending.wheelchairAccessible, true)
})

// Stakeholder testing, 2026-11-09: a request reached the driver who could take it at booking, but never a driver approved
// (or whose settings changed) while it was out. The demo backend must ask them too, like the database does.
test('a driver approved after a request went out is asked about it too', async () => {
  const anyTime = Array.from({ length: 7 }, () => ({ from: '00:00', to: '23:59' }))
  await mockService.signIn('jordan@careride.demo', PASSWORD)
  await mockService.updateDriver('d-jordan', { requestHours: anyTime, serviceCities: ['Richmond'] })

  await mockService.signIn('richmond@careride.demo', PASSWORD)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
  const booked = await mockService.requestRide({
    ...booking(tomorrow),
    type: 'SCHEDULED',
    orgId: 'org-richmond',
    houseId: 'house-richmond',
    requestedBy: 'u-richmond',
    pickupAddress: '7000 Westminster Hwy, Richmond',
  })
  assert.equal(booked.status, 'OFFERED')
  const before = await mockService.listOffersForRide(booked.id)
  assert.ok(before.some((o) => o.driverId === 'd-frank' && o.status === 'PENDING'), 'the driver eligible at booking is asked')
  assert.ok(!before.some((o) => o.driverId === 'd-jordan'), 'a driver still pending review is not')

  await mockService.signIn('admin@careride.com', 'abcd1234')
  await mockService.setDriverStatus('d-jordan', 'APPROVED')

  await mockService.signIn('jordan@careride.demo', PASSWORD)
  const jordans = await mockService.listMyOffers('d-jordan')
  assert.ok(jordans.some((o) => o.rideId === booked.id), 'the newly approved driver now sees the request')
  await mockService.signIn('frank@careride.demo', PASSWORD)
  const franks = await mockService.listMyOffers('d-frank')
  assert.ok(franks.some((o) => o.rideId === booked.id), 'the first driver keeps their request')
})

test('CareRide inbox routes a new offer and confirmation to separate signed-in accounts', async () => {
  resetDemoData()
  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const booked = await mockService.requestRide(booking(new Date().toISOString()))
  await mockService.signIn('frank@careride.demo', PASSWORD)
  const item = (await mockService.loadNotifications()).items.find((note) => note.ride_id === booked.id)
  assert.equal(item?.kind, 'OFFER')
  assert.equal(item.read_at, null)
  assert.equal(await mockService.countUnreadNotifications(), 1)
  assert.doesNotMatch(JSON.stringify(item), /1081 Burrard|Alex/)
  const offer = (await mockService.listMyOffers('d-frank')).find((note) => note.rideId === booked.id)
  assert.ok(offer)
  await mockService.respondToOffer(offer.id, true)

  await mockService.signIn('richmond@careride.demo', PASSWORD)
  assert.ok(!(await mockService.loadNotifications()).items.some((note) => note.ride_id === booked.id))
  await mockService.markNotificationsRead(item.id)
  await mockService.signIn('frank@careride.demo', PASSWORD)
  assert.equal((await mockService.loadNotifications()).items.find((note) => note.id === item.id)?.read_at, null)
  await mockService.markNotificationsRead(item.id)
  assert.ok((await mockService.loadNotifications()).items.find((note) => note.id === item.id)?.read_at)
  assert.equal(await mockService.countUnreadNotifications(), 0)

  await mockService.signIn('belkin@careride.demo', PASSWORD)
  const partner = (await mockService.loadNotifications()).items.find((note) => note.ride_id === booked.id)
  assert.equal(partner?.kind, 'DRIVER_ACCEPTED')
  assert.equal(partner.read_at, null)
})

import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, type Actor } from './harness'

// Who is sent a ride request, against the real migrations (supabase/migrations/20261110120000_late_driver_dispatch.sql).
//
// Stakeholder testing, 2026-11-09: a request reached one driver account but not a stakeholder's account with the same
// settings, nor a driver account created during the session. A request already out (OFFERED) was never sent to a
// driver who became able to take it afterwards: approved later, request hours turned on, or a city added. These tests
// pin down that every driver who can take an open request is asked, whenever they became able to, and however their
// account was made.
// Run with: npm run test:db

let db: PGlite

type Queryable = Pick<Transaction, 'query'>

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

let emailCount = 0
async function newIdentity(name: string): Promise<Actor & { authUserId: string }> {
  const u = await one<{ id: string }>(db, `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    `dispatch${++emailCount}@example.org`,
    JSON.stringify({ full_name: name }),
  ])
  return { authUserId: u.id }
}

let phoneCount = 0
async function addPerson(role: string, orgId: string | null = null, houseId: string | null = null) {
  const identity = await newIdentity('Someone')
  await db.query(
    `insert into public.profiles (auth_user_id, name, phone, email, role, org_id, house_id)
     values ($1, 'Someone', $2, $3, $4, $5, $6)`,
    [identity.authUserId, `604-555-${String(1000 + ++phoneCount)}`, `staff${phoneCount}@example.org`, role, orgId, houseId],
  )
  return identity
}

const ALWAYS = Array.from({ length: 7 }, () => ({ from: '00:00', to: '23:59' }))
const NEVER = Array.from({ length: 7 }, () => null)
const details = (overrides: Record<string, unknown> = {}) => ({
  name: 'Driver',
  phone: `604-555-${String(2000 + ++phoneCount)}`,
  vehicle: 'Silver hatchback',
  seats: 3,
  wheelchairAccessible: false,
  serviceCities: ['Vancouver'],
  requestHours: ALWAYS,
  ...overrides,
})

interface Driver extends Actor {
  authUserId: string
  driverId: string
}

const driverIdOf = (who: Actor) =>
  one<{ id: string }>(db, `select d.id from public.drivers d join public.profiles p on p.id = d.profile_id where p.auth_user_id = $1`, [
    who.authUserId,
  ]).then((r) => r.id)

// A driver signing up on their own (the driver sign-up page): PENDING until reviewed
async function signUpDriver(d: Record<string, unknown> = details()): Promise<Driver> {
  const identity = await newIdentity('Driver')
  await as(db, identity, (tx) => tx.query(`select public.register_driver_profile($1)`, [JSON.stringify(d)]))
  return { ...identity, driverId: await driverIdOf(identity) }
}

// A general volunteer who then applies to drive from their workspace: PENDING until reviewed
async function volunteerDriver(d: Record<string, unknown> = details()): Promise<Driver> {
  const identity = await newIdentity('Volunteer')
  await as(db, identity, (tx) =>
    tx.query(`select public.register_volunteer($1)`, [JSON.stringify({ name: 'Volunteer', phone: d.phone, interests: ['TRANSPORTATION'] })]),
  )
  await as(db, identity, (tx) => tx.query(`select public.apply_to_careride($1)`, [JSON.stringify(d)]))
  return { ...identity, driverId: await driverIdOf(identity) }
}

const review = (driverId: string, status = 'APPROVED') =>
  as(db, admin, (tx) => tx.query(`select public.review_driver($1, $2::public.verification_status)`, [driverId, status]))

const book = (type: 'ON_DEMAND' | 'SCHEDULED' = 'SCHEDULED') =>
  as(db, partner, (tx) =>
    one<{ id: string; status: string }>(tx, `select (r).id, (r).status from public.request_ride($1) r`, [
      JSON.stringify({
        type,
        passengers: 1,
        destinationName: "St. Paul's Hospital",
        destinationAddress: '1081 Burrard St, Vancouver',
        pickupTime: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }),
    ]),
  )

// Who has an open request for this ride, as the database sees it
const askedAbout = (rideId: string) =>
  db
    .query<{ driver_id: string }>(`select driver_id from public.ride_offers where ride_id = $1 and status = 'PENDING' order by driver_id`, [rideId])
    .then((r) => r.rows.map((x) => x.driver_id))

// What the driver's own Rides page loads: their waiting requests, and the ride behind each one
const requestsSeenBy = (who: Driver) =>
  as(db, who, (tx) =>
    tx
      .query<{ ride_id: string }>(
        `select o.ride_id from public.ride_offers o join public.rides r on r.id = o.ride_id
         where o.driver_id = $1 and o.status = 'PENDING' and o.expires_at > now()`,
        [who.driverId],
      )
      .then((r) => r.rows.map((x) => x.ride_id)),
  )

const runDeadlineJob = () => one<{ r: Record<string, number> }>(db, `select private.process_ride_deadlines() as r`).then((x) => x.r)

let admin: Actor
let partner: Actor
let org = ''
let house = ''

before(async () => {
  db = await migratedDatabase()
  org = (
    await one<{ id: string }>(
      db,
      `insert into public.organizations (name, type, contact_name, contact_phone, status)
       values ('Belkin House', 'PARTNER_ORG', 'Contact', '604-555-0100', 'APPROVED') returning id`,
    )
  ).id
  house = (
    await one<{ id: string }>(
      db,
      `insert into public.houses (org_id, name, address, city, phone) values ($1, 'Belkin House', '555 Homer St', 'Vancouver', '604-555-0101') returning id`,
      [org],
    )
  ).id
  admin = await addPerson('PLATFORM_ADMIN')
  partner = await addPerson('PARTNER', org, house)
})

describe('drivers with the same settings', () => {
  test('are all asked, however their account was made', async () => {
    const drivers = [await signUpDriver(), await volunteerDriver(), await signUpDriver()]
    for (const d of drivers) await review(d.driverId)

    for (const type of ['ON_DEMAND', 'SCHEDULED'] as const) {
      const ride = await book(type)
      assert.equal(ride.status, 'OFFERED')
      const asked = await askedAbout(ride.id)
      for (const d of drivers) {
        assert.ok(asked.includes(d.driverId), `${type}: every approved driver with these settings is asked`)
        assert.ok((await requestsSeenBy(d)).includes(ride.id), `${type}: and sees it on their own screen`)
      }
    }
  })
})

describe('a request that is already out', () => {
  test('reaches a driver approved after it was booked', async () => {
    const first = await signUpDriver()
    await review(first.driverId)
    const late = await volunteerDriver()

    const ride = await book()
    assert.ok((await askedAbout(ride.id)).includes(first.driverId))
    assert.ok(!(await askedAbout(ride.id)).includes(late.driverId), 'not before they are approved')

    await review(late.driverId)
    assert.ok((await requestsSeenBy(late)).includes(ride.id), 'straight away once approved')
    assert.ok((await requestsSeenBy(first)).includes(ride.id), 'and the first driver keeps theirs')
  })

  test('reaches a brand new driver account approved while it is out, for an on-demand ride too', async () => {
    const first = await signUpDriver()
    await review(first.driverId)
    const ride = await book('ON_DEMAND')

    const brandNew = await signUpDriver()
    await review(brandNew.driverId)
    assert.ok((await requestsSeenBy(brandNew)).includes(ride.id))
  })

  test('reaches a driver who turns on their request hours or adds the pickup city', async () => {
    const offShift = await signUpDriver(details({ requestHours: NEVER.map((_, i) => (i === 0 ? { from: '00:00', to: '00:01' } : null)) }))
    const elsewhere = await signUpDriver(details({ serviceCities: ['Richmond'] }))
    await review(offShift.driverId)
    await review(elsewhere.driverId)

    const ride = await book()
    assert.ok(!(await askedAbout(ride.id)).includes(offShift.driverId))
    assert.ok(!(await askedAbout(ride.id)).includes(elsewhere.driverId))

    // Saved the way the Availability page saves them: an update on their own row, as themselves
    await as(db, offShift, (tx) =>
      tx.query(`update public.drivers set request_hours = $1 where id = $2`, [JSON.stringify(ALWAYS), offShift.driverId]),
    )
    await as(db, elsewhere, (tx) => tx.query(`update public.drivers set service_cities = '{Richmond,Vancouver}' where id = $1`, [elsewhere.driverId]))
    assert.ok((await requestsSeenBy(offShift)).includes(ride.id), 'request hours turned on')
    assert.ok((await requestsSeenBy(elsewhere)).includes(ride.id), 'pickup city added')
  })

  test('reaches a driver whose request hours open while it is out, from the per-minute job', async () => {
    const first = await signUpDriver()
    const later = await signUpDriver(details({ requestHours: NEVER.map((_, i) => (i === 0 ? { from: '00:00', to: '00:01' } : null)) }))
    await review(first.driverId)
    await review(later.driverId)
    const ride = await book()
    assert.ok(!(await askedAbout(ride.id)).includes(later.driverId))

    // Hours "opening" is time passing, not a row change: only the job can notice it
    await db.exec(`alter table public.drivers disable trigger drivers_ask_about_open_rides`)
    try {
      await db.query(`update public.drivers set request_hours = $1 where id = $2`, [JSON.stringify(ALWAYS), later.driverId])
      assert.ok(!(await askedAbout(ride.id)).includes(later.driverId))
      const result = await runDeadlineJob()
      assert.equal(result.rides_failed, 0)
    } finally {
      await db.exec(`alter table public.drivers enable trigger drivers_ask_about_open_rides`)
    }
    assert.ok((await requestsSeenBy(later)).includes(ride.id))
    assert.ok((await requestsSeenBy(first)).includes(ride.id))
  })

  test('is not sent to drivers who still cannot take it, or sent twice', async () => {
    const first = await signUpDriver()
    await review(first.driverId)
    const ride = await book()
    const asked = await askedAbout(ride.id)

    const rejected = await signUpDriver()
    await review(rejected.driverId, 'REJECTED')
    const richmondOnly = await signUpDriver(details({ serviceCities: ['Richmond'] }))
    await review(richmondOnly.driverId)
    const after = await askedAbout(ride.id)
    assert.ok(!after.includes(rejected.driverId))
    assert.ok(!after.includes(richmondOnly.driverId))

    await runDeadlineJob()
    await runDeadlineJob()
    const pending = await db.query<{ n: number }>(
      `select count(*)::int as n from public.ride_offers where ride_id = $1 and status = 'PENDING' group by driver_id having count(*) > 1`,
      [ride.id],
    )
    assert.equal(pending.rows.length, 0, 'nobody has two open requests for one ride')
    for (const d of asked) assert.ok(after.includes(d), 'everyone already asked keeps their request')
  })

  test('stays with a preferred driver who is being asked alone first', async () => {
    const outbound = await signUpDriver()
    await review(outbound.driverId)
    // A return trip, sent to the outbound driver alone
    const ride = await one<{ id: string; dispatch_revision: number }>(
      db,
      `insert into public.rides (type, org_id, house_id, requested_by, passengers, pickup_address, destination_name, destination_address,
                                 pickup_time, status, preferred_driver_id)
       values ('SCHEDULED', $1, $2, (select id from public.profiles where auth_user_id = $3), 1, '1081 Burrard St', 'Belkin House', '555 Homer St',
               now() + interval '1 day', 'OFFERED', $4)
       returning id, dispatch_revision`,
      [org, house, partner.authUserId, outbound.driverId],
    )
    await db.query(
      `insert into public.ride_offers (ride_id, driver_id, dispatch_revision, expires_at) values ($1, $2, $3, now() + interval '1 hour')`,
      [ride.id, outbound.driverId, ride.dispatch_revision],
    )

    const other = await signUpDriver()
    await review(other.driverId)
    await runDeadlineJob()
    assert.deepEqual(await askedAbout(ride.id), [outbound.driverId])

    // Once they say no, everyone else is asked
    await as(db, outbound, (tx) =>
      tx.query(`select public.respond_to_offer((select id from public.ride_offers where ride_id = $1 and driver_id = $2), false)`, [
        ride.id,
        outbound.driverId,
      ]),
    )
    assert.ok((await askedAbout(ride.id)).includes(other.driverId))
  })
})

// A ride this driver already has, inserted directly (as history from before the test)
const pastRide = (driverId: string, type: 'ON_DEMAND' | 'SCHEDULED', status: string) =>
  one<{ id: string }>(
    db,
    `insert into public.rides (type, org_id, house_id, requested_by, passengers, pickup_address, destination_name, destination_address,
                               pickup_time, status, driver_id, accepted_at)
     values ($1, $2, $3, (select id from public.profiles where auth_user_id = $4), 1, '555 Homer St', 'Clinic', '2 Oak St',
             now() - interval '2 hours', $5, $6, now() - interval '3 hours')
     returning id`,
    [type, org, house, partner.authUserId, status, driverId],
  )

describe('an existing driver account', () => {
  test('made before today’s sign-up flows is asked alongside a brand new account with the same settings', async () => {
    // Like an account that has been around since before the current sign-up pages
    const identity = await newIdentity('Long-time driver')
    await db.query(
      `insert into public.profiles (auth_user_id, name, phone, email, role, created_at)
       values ($1, 'Long-time driver', '604-555-3001', 'longtime@example.org', 'DRIVER', now() - interval '60 days')`,
      [identity.authUserId],
    )
    await db.query(
      `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status, created_at)
       values ((select id from public.profiles where auth_user_id = $1), 'INDEPENDENT', 'Silver hatchback', 3, '{Vancouver}', $2, 'APPROVED',
               now() - interval '60 days')`,
      [identity.authUserId, JSON.stringify(ALWAYS)],
    )
    const existing: Driver = { ...identity, driverId: await driverIdOf(identity) }
    const brandNew = await signUpDriver()
    await review(brandNew.driverId)

    for (const type of ['ON_DEMAND', 'SCHEDULED'] as const) {
      const ride = await book(type)
      assert.ok((await requestsSeenBy(existing)).includes(ride.id), `${type}: the existing account sees it`)
      assert.ok((await requestsSeenBy(brandNew)).includes(ride.id), `${type}: the new account sees it`)
    }
  })

  test('with finished rides, declined requests and expired requests behind it still gets new requests', async () => {
    const veteran = await signUpDriver()
    await review(veteran.driverId)
    await pastRide(veteran.driverId, 'ON_DEMAND', 'COMPLETED')
    await pastRide(veteran.driverId, 'SCHEDULED', 'NO_SHOW')

    const declined = await book()
    await as(db, veteran, (tx) =>
      tx.query(`select public.respond_to_offer((select id from public.ride_offers where ride_id = $1 and driver_id = $2), false)`, [
        declined.id,
        veteran.driverId,
      ]),
    )
    const ignored = await book('ON_DEMAND')
    await db.query(`update public.ride_offers set status = 'EXPIRED' where ride_id = $1 and driver_id = $2`, [ignored.id, veteran.driverId])

    for (const type of ['ON_DEMAND', 'SCHEDULED'] as const) {
      const ride = await book(type)
      assert.ok((await requestsSeenBy(veteran)).includes(ride.id), `${type}: earlier answers don't hold back a new request`)
    }
  })

  test('holding an unfinished on-demand ride skips on-demand requests only, until that ride is finished', async () => {
    const driver = await signUpDriver()
    await review(driver.driverId)
    const stuck = await pastRide(driver.driverId, 'ON_DEMAND', 'ACCEPTED')

    const onDemand = await book('ON_DEMAND')
    const scheduled = await book('SCHEDULED')
    let seen = await requestsSeenBy(driver)
    assert.ok(!seen.includes(onDemand.id), 'on the way to a pickup: no on-demand requests')
    assert.ok(seen.includes(scheduled.id), 'scheduled requests still arrive')

    await db.query(`update public.rides set status = 'COMPLETED', picked_up_at = now(), completed_at = now() where id = $1`, [stuck.id])
    const next = await book('ON_DEMAND')
    seen = await requestsSeenBy(driver)
    assert.ok(seen.includes(next.id), 'once finished, on-demand requests arrive again')
  })

  test('still waiting for review, or rejected, gets nothing until approved', async () => {
    const waiting = await signUpDriver()
    const rejected = await volunteerDriver()
    await review(rejected.driverId, 'REJECTED')
    const ride = await book()
    assert.deepEqual(await requestsSeenBy(waiting), [])
    assert.deepEqual(await requestsSeenBy(rejected), [])

    await review(waiting.driverId)
    assert.ok((await requestsSeenBy(waiting)).includes(ride.id), 'approved: the open request arrives')
    assert.deepEqual(await requestsSeenBy(rejected), [])
  })

  test('cannot see a request it was not sent', async () => {
    const asked = await signUpDriver()
    const elsewhere = await signUpDriver(details({ serviceCities: ['Richmond'] }))
    await review(asked.driverId)
    await review(elsewhere.driverId)
    const ride = await book()
    assert.ok((await requestsSeenBy(asked)).includes(ride.id))
    assert.ok(!(await requestsSeenBy(elsewhere)).includes(ride.id))
    const readable = await as(db, elsewhere, (tx) => tx.query(`select id from public.rides where id = $1`, [ride.id]))
    assert.equal(readable.rows.length, 0, 'the rider’s details stay private')
  })
})

describe('request hours', () => {
  // Mondays only, all day. Each time below is on a different day in UTC than in Vancouver, whether Vancouver is on
  // UTC-7 or UTC-8 that day (British Columbia's clocks changed rules in 2026, and time zone databases differ).
  const MONDAYS = JSON.stringify([null, { from: '00:00', to: '23:59' }, null, null, null, null, null])
  const within = (at: string) =>
    one<{ ok: boolean }>(db, `select private.within_request_hours($1::jsonb, 'America/Vancouver', $2::timestamptz) as ok`, [MONDAYS, at]).then(
      (r) => r.ok,
    )

  test('are read in Vancouver time, wherever the server or the phone is', async () => {
    assert.equal(await within('2026-11-09T06:00:00Z'), false, 'Monday 6 AM in UTC is still Sunday night in Vancouver')
    assert.equal(await within('2026-11-10T06:00:00Z'), true, 'Tuesday 6 AM in UTC is still Monday night in Vancouver')
    assert.equal(await within('2026-11-09T20:00:00Z'), true, 'Monday midday in both')
  })

  test('new sign-ups default to Vancouver time too', async () => {
    const d = await signUpDriver()
    const { tz } = await one<{ tz: string }>(db, `select request_hours_tz as tz from public.drivers where id = $1`, [d.driverId])
    assert.equal(tz, 'America/Vancouver')
  })
})

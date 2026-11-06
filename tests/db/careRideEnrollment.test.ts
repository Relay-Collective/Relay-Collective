import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, refusal, type Actor } from './harness'

// CareRide driver enrollment for existing general volunteers, against the real migrations
// (supabase/migrations/20261105120000_careride_volunteer_enrollment.sql). The rules under test: one account and one
// identity throughout, interests untouched, the application always PENDING, and only an admin's approval opens rides.
// Run with: npm run test:db

let db: PGlite

type Queryable = Pick<Transaction, 'query'>

interface Volunteer extends Actor {
  authUserId: string
  profileId: string
  email: string
}

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

const count = (sql: string, params: unknown[] = []) => one<{ n: number }>(db, `select count(*)::int as n from ${sql}`, params).then((r) => r.n)

let emailCount = 0
async function newIdentity(name: string) {
  const email = `enrol${++emailCount}@example.org`
  const u = await one<{ id: string }>(db, `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    email,
    JSON.stringify({ full_name: name }),
  ])
  return { authUserId: u.id, email }
}

// A general volunteer made the way the app makes one: register_volunteer(), from the session
async function newVolunteer(name: string, interests: string[], phone = ''): Promise<Volunteer> {
  const identity = await newIdentity(name)
  const profileId = await as(db, identity, (tx) =>
    one<{ id: string }>(tx, `select public.register_volunteer($1) as id`, [JSON.stringify({ name, phone, interests })]).then((r) => r.id),
  )
  return { ...identity, profileId }
}

async function addPerson(role: string, orgId: string | null = null, houseId: string | null = null) {
  const identity = await newIdentity('Someone')
  const p = await one<{ id: string }>(
    db,
    `insert into public.profiles (auth_user_id, name, phone, email, role, org_id, house_id)
     values ($1, 'Someone', '604-555-0199', $2, $3, $4, $5) returning id`,
    [identity.authUserId, identity.email, role, orgId, houseId],
  )
  return { ...identity, profileId: p.id }
}

const ALWAYS = Array.from({ length: 7 }, () => ({ from: '00:00', to: '23:59' }))
const details = (overrides: Record<string, unknown> = {}) => ({
  vehicle: 'Silver hatchback',
  seats: 3,
  wheelchairAccessible: false,
  serviceCities: ['Vancouver'],
  requestHours: ALWAYS,
  phone: '604-555-0177',
  ...overrides,
})

interface Enrollment {
  driverId: string
  status: string
  created: boolean
}
const apply = (who: Actor, d: unknown = details()) =>
  as(db, who, (tx) => one<{ r: Enrollment }>(tx, `select public.apply_to_careride($1) as r`, [JSON.stringify(d)]).then((x) => x.r))

const profileOf = (profileId: string) =>
  one<{ id: string; auth_user_id: string; role: string; name: string; phone: string | null; email: string; is_active: boolean }>(
    db,
    `select id, auth_user_id, role, name, phone, email, is_active from public.profiles where id = $1`,
    [profileId],
  )
const driverOf = (profileId: string) =>
  one<{ id: string; status: string; background: string; applied_as_volunteer: boolean; vehicle: string; org_id: string | null } | undefined>(
    db,
    `select id, status, background, applied_as_volunteer, vehicle, org_id from public.drivers where profile_id = $1`,
    [profileId],
  )
const interestsOf = (who: Actor) =>
  as(db, who, (tx) =>
    tx.query<{ interest: string }>(`select interest from public.volunteer_interests order by interest`).then((r) => r.rows.map((x) => x.interest)),
  )
const review = (who: Actor, driverId: string, status: string) =>
  as(db, who, (tx) => tx.query(`select public.review_driver($1, $2::public.verification_status)`, [driverId, status]))

const org = { id: '', house: '' }
let admin: Awaited<ReturnType<typeof addPerson>>
let partner: Awaited<ReturnType<typeof addPerson>>
let legacyDriver: Awaited<ReturnType<typeof addPerson>>
let legacyDriverId = ''

// A ride waiting for a driver, with a PENDING offer to this one, so respond_to_offer() can be tried
async function offeredRide(driverId: string): Promise<{ rideId: string; offerId: string }> {
  const r = await one<{ id: string; dispatch_revision: number }>(
    db,
    `insert into public.rides (type, org_id, house_id, requested_by, passengers, pickup_address, destination_name, destination_address, pickup_time, status)
     values ('SCHEDULED', $1, $2, $3, 1, '1 Main St', 'St. Paul''s Hospital', '1081 Burrard St', now() + interval '1 day', 'OFFERED')
     returning id, dispatch_revision`,
    [org.id, org.house, partner.profileId],
  )
  const o = await one<{ id: string }>(
    db,
    `insert into public.ride_offers (ride_id, driver_id, dispatch_revision, expires_at) values ($1, $2, $3, now() + interval '1 hour') returning id`,
    [r.id, driverId, r.dispatch_revision],
  )
  return { rideId: r.id, offerId: o.id }
}
const respond = (who: Actor, offerId: string) => as(db, who, (tx) => tx.query(`select public.respond_to_offer($1, true)`, [offerId]))
const rideDriver = (rideId: string) => one<{ driver_id: string | null }>(db, `select driver_id from public.rides where id = $1`, [rideId]).then((r) => r.driver_id)

before(async () => {
  db = await migratedDatabase()
  const o = await one<{ id: string }>(
    db,
    `insert into public.organizations (name, type, contact_name, contact_phone, status) values ('Belkin House', 'PARTNER_ORG', 'Contact', '604-555-0100', 'APPROVED') returning id`,
  )
  const h = await one<{ id: string }>(
    db,
    `insert into public.houses (org_id, name, address, city, phone) values ($1, 'Belkin House', '1 Main St', 'Vancouver', '604-555-0101') returning id`,
    [o.id],
  )
  Object.assign(org, { id: o.id, house: h.id })
  admin = await addPerson('PLATFORM_ADMIN')
  partner = await addPerson('PARTNER', org.id, org.house)
  legacyDriver = await addPerson('DRIVER')
  legacyDriverId = (
    await one<{ id: string }>(
      db,
      `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status)
       values ($1, 'TAXI', 'Blue Corolla', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', 'APPROVED') returning id`,
      [legacyDriver.profileId],
    )
  ).id
})

describe('applying from the volunteer workspace', () => {
  test('creates a PENDING driver profile on the same account, and keeps every interest', async () => {
    const v = await newVolunteer('Priya Applicant', ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION'])
    const beforeProfile = await profileOf(v.profileId)
    const vpBefore = await one<{ id: string; created_at: string }>(db, `select id, created_at from public.volunteer_profiles where profile_id = $1`, [
      v.profileId,
    ])

    const result = await apply(v)
    assert.equal(result.created, true)
    assert.equal(result.status, 'PENDING')

    const after = await profileOf(v.profileId)
    assert.equal(after.id, beforeProfile.id, 'the same profile')
    assert.equal(after.auth_user_id, v.authUserId, 'the same login')
    assert.equal(after.name, beforeProfile.name)
    assert.equal(after.email, beforeProfile.email)
    assert.equal(after.role, 'DRIVER')
    assert.equal(after.phone, '604-555-0177', 'the missing phone was added')
    assert.equal(await count(`public.profiles where auth_user_id = $1`, [v.authUserId]), 1, 'no second profile')
    assert.equal(await count(`auth.users where email = $1`, [v.email]), 1, 'no second identity')

    const driver = (await driverOf(v.profileId))!
    assert.equal(driver.id, result.driverId)
    assert.equal(driver.status, 'PENDING', 'never approved by applying')
    assert.equal(driver.background, 'INDEPENDENT')
    assert.equal(driver.applied_as_volunteer, true)
    assert.equal(driver.org_id, null)

    assert.deepEqual(await interestsOf(v), ['COMMUNITY_OUTREACH', 'FOOD_DISTRIBUTION', 'RESOURCE_COORDINATION'], 'interests untouched')
    assert.deepEqual(
      await one(db, `select id, created_at from public.volunteer_profiles where profile_id = $1`, [v.profileId]),
      vpBefore,
      'the volunteer profile is the same row',
    )
    // The applicant can read their own application, and still change their interests
    const mine = await as(db, v, (tx) => tx.query<{ status: string }>(`select status from public.drivers where id = $1`, [driver.id]))
    assert.deepEqual(mine.rows, [{ status: 'PENDING' }])
    await as(db, v, (tx) => tx.query(`select public.set_my_volunteer_interests($1)`, [JSON.stringify(['GENERAL'])]))
    assert.deepEqual(await interestsOf(v), ['GENERAL'])
    assert.equal((await driverOf(v.profileId))!.status, 'PENDING', 'changing interests leaves driving alone')
  })

  test('Transportation interest is neither needed nor enough', async () => {
    const interested = await newVolunteer('Alex Interested', ['TRANSPORTATION'])
    assert.equal(await driverOf(interested.profileId), undefined, 'choosing Transportation enrols nobody')
    const notInterested = await newVolunteer('Kim Not Interested', ['GENERAL'])
    assert.equal((await apply(notInterested)).status, 'PENDING', 'anyone can apply, whatever their interests')
  })

  test('a phone already on the account stays as it is', async () => {
    const v = await newVolunteer('Has Phone', ['GENERAL'], '604-555-0100')
    await apply(v, details({ phone: '778-555-0199' }))
    assert.equal((await profileOf(v.profileId)).phone, '604-555-0100')
    const w = await newVolunteer('No Phone Given', ['GENERAL'])
    assert.match(await refusal(apply(w, details({ phone: '' }))), /Phone is required|10-digit/)
  })

  test('every field is checked with the driver sign-up rules, and a refusal leaves nothing behind', async () => {
    const v = await newVolunteer('Careful Applicant', ['GENERAL'])
    const cases: [Record<string, unknown> | unknown, RegExp][] = [
      [details({ vehicle: '' }), /Vehicle is required/],
      [details({ vehicle: 'x'.repeat(200) }), /80 characters|too long/i],
      [details({ seats: 0 }), /how many passengers/],
      [details({ seats: 99 }), /how many passengers/],
      [details({ serviceCities: [] }), /at least one city/],
      [details({ serviceCities: ['Atlantis'] }), /Vancouver or Richmond/],
      [details({ requestHours: [1, 2, 3] }), /.+/],
      [details({ phone: '123' }), /10-digit/],
      ['not an object', /Fill in your driver details/],
    ]
    for (const [bad, message] of cases) {
      assert.match(await refusal(apply(v, bad)), message, JSON.stringify(bad).slice(0, 60))
    }
    assert.equal(await driverOf(v.profileId), undefined)
    assert.equal((await profileOf(v.profileId)).role, 'VOLUNTEER')
  })

  test('the browser can’t choose a status, a background, or an organization', async () => {
    const v = await newVolunteer('Sneaky Applicant', ['GENERAL'])
    await apply(v, details({ status: 'APPROVED', background: 'TAXI', orgId: org.id, org_id: org.id, applied_as_volunteer: false }))
    const d = (await driverOf(v.profileId))!
    assert.deepEqual([d.status, d.background, d.org_id, d.applied_as_volunteer], ['PENDING', 'INDEPENDENT', null, true])
  })
})

describe('repeats and races', () => {
  test('applying again returns the same application, never a second driver profile', async () => {
    const v = await newVolunteer('Double Tap', ['GENERAL'])
    const first = await apply(v)
    const again = await apply(v, details({ vehicle: 'Something else', seats: 7 }))
    assert.deepEqual(again, { driverId: first.driverId, status: 'PENDING', created: false })
    assert.equal(await count(`public.drivers where profile_id = $1`, [v.profileId]), 1)
    assert.equal((await driverOf(v.profileId))!.vehicle, 'Silver hatchback', 'the first application stands')
  })

  test('submissions sent together still make one driver profile', async () => {
    const v = await newVolunteer('Two Tabs', ['GENERAL'])
    const results = await Promise.all([apply(v), apply(v), apply(v)])
    assert.equal(results.filter((r) => r.created).length, 1)
    assert.equal(new Set(results.map((r) => r.driverId)).size, 1)
    assert.equal(await count(`public.drivers where profile_id = $1`, [v.profileId]), 1)
  })

  test('the database itself refuses a second driver profile for one account', async () => {
    const v = await newVolunteer('Unique Check', ['GENERAL'])
    await apply(v)
    assert.match(
      await refusal(
        db.query(
          `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status)
           values ($1, 'INDEPENDENT', 'Car', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', 'PENDING')`,
          [v.profileId],
        ),
      ),
      /duplicate key/,
    )
  })

  test('a decision is never reset by applying again', async () => {
    const v = await newVolunteer('Turned Down', ['FOOD_DISTRIBUTION'])
    const { driverId } = await apply(v)
    await review(admin, driverId, 'REJECTED')
    assert.deepEqual(await apply(v), { driverId, status: 'REJECTED', created: false })
    assert.equal((await driverOf(v.profileId))!.status, 'REJECTED')
  })
})

describe('who may apply', () => {
  test('signed out, a login without a profile, organization staff and admins are refused', async () => {
    assert.match(await refusal(apply({})), /sign in|permission denied/i)
    assert.match(await refusal(apply(await newIdentity('No Profile'))), /volunteer first/)
    assert.match(await refusal(apply(partner)), /can't apply/)
    assert.match(await refusal(apply(admin)), /can't apply/)
    assert.equal((await profileOf(partner.profileId)).role, 'PARTNER')
    assert.equal(await count(`public.drivers where profile_id in ($1, $2)`, [partner.profileId, admin.profileId]), 0)
  })

  test('a closed volunteer account can’t apply', async () => {
    const v = await newVolunteer('Closed Account', ['GENERAL'])
    await as(db, v, (tx) => tx.query(`select public.deactivate_my_account()`))
    assert.match(await refusal(apply(v)), /closed/)
    assert.equal(await driverOf(v.profileId), undefined)
  })

  test('an existing driver gets their own application back, unchanged', async () => {
    const before = await driverOf(legacyDriver.profileId)
    assert.deepEqual(await apply(legacyDriver), { driverId: legacyDriverId, status: 'APPROVED', created: false })
    assert.deepEqual(await driverOf(legacyDriver.profileId), before)
  })

  test('a DRIVER account with no driver profile is left for the team, not filled in', async () => {
    const broken = await addPerson('DRIVER')
    assert.match(await refusal(apply(broken)), /no driver profile/)
    assert.equal(await driverOf(broken.profileId), undefined)
  })

  test('only signed-in users can call it at all', async () => {
    const grants = await one<{ anon: boolean; authenticated: boolean }>(
      db,
      `select has_function_privilege('anon', 'public.apply_to_careride(jsonb)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.apply_to_careride(jsonb)', 'execute') as authenticated`,
    )
    assert.deepEqual(grants, { anon: false, authenticated: true })
  })
})

describe('no escalation', () => {
  test('an applicant can’t approve themselves, change their status or role, or write the new column', async () => {
    const v = await newVolunteer('Eager Applicant', ['GENERAL'])
    const { driverId } = await apply(v)
    assert.match(await refusal(review(v, driverId, 'APPROVED')), /Only a CareRide admin/)
    assert.match(await refusal(as(db, v, (tx) => tx.query(`update public.drivers set status = 'APPROVED' where id = $1`, [driverId]))), /permission denied/)
    assert.match(
      await refusal(as(db, v, (tx) => tx.query(`update public.drivers set applied_as_volunteer = false where id = $1`, [driverId]))),
      /permission denied/,
    )
    assert.match(
      await refusal(as(db, v, (tx) => tx.query(`update public.profiles set role = 'PLATFORM_ADMIN' where id = $1`, [v.profileId]))),
      /permission denied/,
    )
    assert.equal((await driverOf(v.profileId))!.status, 'PENDING')
    assert.equal((await profileOf(v.profileId)).role, 'DRIVER')
  })

  test('a general volunteer can’t insert an approved driver profile for themselves', async () => {
    const v = await newVolunteer('Direct Insert', ['TRANSPORTATION'])
    assert.match(
      await refusal(
        as(db, v, (tx) =>
          tx.query(
            `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status)
             values ($1, 'INDEPENDENT', 'Car', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', 'APPROVED')`,
            [v.profileId],
          ),
        ),
      ),
      /permission denied/,
    )
    assert.equal(await driverOf(v.profileId), undefined)
  })

  test('applications are private: one volunteer can’t read or change another’s', async () => {
    const a = await newVolunteer('Volunteer A', ['GENERAL'])
    const b = await newVolunteer('Volunteer B', ['GENERAL'])
    const { driverId: bDriver } = await apply(b)
    await apply(a)
    const seen = await as(db, a, (tx) => tx.query(`select id from public.drivers where id = $1`, [bDriver]))
    assert.equal(seen.rows.length, 0, 'A can’t see B’s application')
    const changed = await as(db, a, (tx) => tx.query(`update public.drivers set vehicle = 'Hijacked' where id = $1`, [bDriver]))
    assert.equal(changed.affectedRows ?? 0, 0)
    assert.equal((await driverOf(b.profileId))!.vehicle, 'Silver hatchback')
    const theirInterests = await as(db, a, (tx) =>
      tx.query(`select 1 from public.volunteer_interests vi join public.volunteer_profiles vp on vp.id = vi.volunteer_profile_id where vp.profile_id = $1`, [
        b.profileId,
      ]),
    )
    assert.equal(theirInterests.rows.length, 0)
  })
})

describe('ride access follows the verification decision', () => {
  test('pending: can’t accept a ride, even one offered to them', async () => {
    const v = await newVolunteer('Pending Driver', ['GENERAL'])
    const { driverId } = await apply(v)
    const { rideId, offerId } = await offeredRide(driverId)
    assert.match(await refusal(respond(v, offerId)), /needs to be approved/)
    assert.equal(await rideDriver(rideId), null)
  })

  test('rejected: still can’t, and general volunteering carries on', async () => {
    const v = await newVolunteer('Rejected Driver', ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'])
    const { driverId } = await apply(v)
    await review(admin, driverId, 'REJECTED')
    const { rideId, offerId } = await offeredRide(driverId)
    assert.match(await refusal(respond(v, offerId)), /needs to be approved/)
    assert.equal(await rideDriver(rideId), null)
    assert.deepEqual(await interestsOf(v), ['COMMUNITY_OUTREACH', 'FOOD_DISTRIBUTION'])
    await as(db, v, (tx) => tx.query(`select public.set_my_volunteer_interests($1)`, [JSON.stringify(['GENERAL', 'FOOD_DISTRIBUTION'])]))
    assert.deepEqual(await interestsOf(v), ['FOOD_DISTRIBUTION', 'GENERAL'])
  })

  test('approved by an admin: accepts rides like any driver, with identity and interests intact', async () => {
    const v = await newVolunteer('Approved Driver', ['FOOD_DISTRIBUTION', 'RESOURCE_COORDINATION'])
    const { driverId } = await apply(v)
    await review(admin, driverId, 'APPROVED')
    const { rideId, offerId } = await offeredRide(driverId)
    await respond(v, offerId)
    assert.equal(await rideDriver(rideId), driverId)
    const seen = await as(db, v, (tx) => tx.query(`select id from public.rides where id = $1`, [rideId]))
    assert.equal(seen.rows.length, 1)
    assert.deepEqual(await interestsOf(v), ['FOOD_DISTRIBUTION', 'RESOURCE_COORDINATION'])
    const p = await profileOf(v.profileId)
    assert.deepEqual([p.auth_user_id, p.role], [v.authUserId, 'DRIVER'])
    // Now in the pool partners see when booking
    const pool = await as(db, partner, (tx) => tx.query(`select 1 from public.booking_driver_pool()`).then((r) => r.rows.length))
    assert.ok(pool >= 2)
  })

  test('existing drivers from before enrollment keep working', async () => {
    const { rideId, offerId } = await offeredRide(legacyDriverId)
    await respond(legacyDriver, offerId)
    assert.equal(await rideDriver(rideId), legacyDriverId)
    assert.equal((await driverOf(legacyDriver.profileId))!.applied_as_volunteer, false, 'existing rows default to false')
  })
})

describe('closing and deleting an enrolled volunteer', () => {
  test('an enrolled volunteer closes their sign-in through the driver path', async () => {
    const v = await newVolunteer('Leaving Driver', ['GENERAL'])
    await apply(v)
    await as(db, v, (tx) => tx.query(`select public.deactivate_my_account()`))
    assert.equal((await profileOf(v.profileId)).is_active, false)
    assert.deepEqual(await interestsOf(v), [], 'a closed account reads nothing')
  })

  test('permanent deletion lists, erases and verifies the driver profile and the volunteer profile', async () => {
    const v = await newVolunteer('Deleted Driver', ['FOOD_DISTRIBUTION', 'GENERAL'])
    const { driverId } = await apply(v)
    const vp = await one<{ id: string }>(db, `select id from public.volunteer_profiles where profile_id = $1`, [v.profileId])

    const preview = await as(db, admin, (tx) =>
      one<{ p: { state: string; categories: { key: string; count: number }[] } }>(tx, `select public.admin_account_deletion_preview($1) as p`, [
        v.profileId,
      ]).then((r) => r.p),
    )
    assert.equal(preview.state, 'READY')
    const n = (key: string) => preview.categories.find((c) => c.key === key)?.count
    assert.equal(n('driver_profile'), 1)
    assert.equal(n('volunteer_profile'), 1)

    const job = await as(db, admin, (tx) =>
      one<{ j: { id: string } }>(tx, `select public.admin_begin_account_deletion($1, $2) as j`, [v.profileId, v.email]).then((r) => r.j),
    )
    let state = await as(db, admin, (tx) =>
      one<{ j: { status: string; step: string; authUserId?: string } }>(tx, `select public.admin_claim_account_deletion($1) as j`, [job.id]).then(
        (r) => r.j,
      ),
    )
    for (let round = 0; round < 8 && state.status === 'in_progress'; round++) {
      if (state.step === 'auth' && state.authUserId) await db.query(`delete from auth.users where id = $1`, [state.authUserId])
      state = await as(db, admin, (tx) =>
        one<{ j: typeof state }>(tx, `select public.admin_advance_account_deletion($1, $2) as j`, [job.id, state.step]).then((r) => r.j),
      )
    }
    assert.equal(state.status, 'completed')
    assert.equal(await count(`public.volunteer_profiles where id = $1`, [vp.id]), 0)
    assert.equal(await count(`public.volunteer_interests where volunteer_profile_id = $1`, [vp.id]), 0)
    assert.equal(await count(`public.drivers where id = $1 and (deleted_at is null or vehicle <> '')`, [driverId]), 0, 'the driver profile is erased')
  })
})

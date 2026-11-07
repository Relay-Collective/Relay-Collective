import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, refusal, type Actor } from './harness'

// General volunteers, against the real migrations (supabase/migrations/20261104120000_volunteer_role.sql and
// 20261104120100_general_volunteers.sql). The rule under test above all: volunteering interests are descriptive
// and never grant access to anything. Run with: npm run test:db

let db: PGlite

type Queryable = Pick<Transaction, 'query'>

interface Person extends Actor {
  authUserId: string
  profileId: string
  email: string
}

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

let emailCount = 0
// A login with no Relay Collective role yet: someone who just signed up
async function newIdentity(name = 'New Volunteer'): Promise<Actor & { authUserId: string; email: string }> {
  const email = `volunteer${++emailCount}@example.org`
  const u = await one<{ id: string }>(db, `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    email,
    JSON.stringify({ full_name: name }),
  ])
  return { authUserId: u.id, email }
}

async function addPerson(role: string, orgId: string | null = null, houseId: string | null = null): Promise<Person> {
  const identity = await newIdentity()
  const p = await one<{ id: string }>(
    db,
    `insert into public.profiles (auth_user_id, name, phone, email, role, org_id, house_id)
     values ($1, 'Someone', '604-555-0199', $2, $3, $4, $5) returning id`,
    [identity.authUserId, identity.email, role, orgId, houseId],
  )
  return { ...identity, profileId: p.id }
}

async function addDriver(person: Person, status = 'APPROVED'): Promise<string> {
  const d = await one<{ id: string }>(
    db,
    `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status)
     values ($1, 'INDEPENDENT', 'Blue Corolla', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', $2) returning id`,
    [person.profileId, status],
  )
  return d.id
}

const register = (who: Actor, details: unknown) =>
  as(db, who, (tx) => one<{ id: string }>(tx, `select public.register_volunteer($1) as id`, [JSON.stringify(details)]).then((r) => r.id))
const setInterests = (who: Actor, interests: unknown) =>
  as(db, who, (tx) => tx.query(`select public.set_my_volunteer_interests($1)`, [JSON.stringify(interests)]))
// What the person can read of their own interests, through the access rules
const myInterests = (who: Actor) =>
  as(db, who, (tx) =>
    tx.query<{ interest: string }>(`select interest from public.volunteer_interests order by interest`).then((r) => r.rows.map((x) => x.interest)),
  )
const profileOf = (authUserId: string) =>
  one<{ id: string; role: string; name: string; phone: string | null; org_id: string | null; is_active: boolean }>(
    db,
    `select id, role, name, phone, org_id, is_active from public.profiles where auth_user_id = $1`,
    [authUserId],
  )
const count = (sql: string, params: unknown[] = []) => one<{ n: number }>(db, `select count(*)::int as n from ${sql}`, params).then((r) => r.n)

const org = { id: '', house: '' }
let admin: Person
let partner: Person
let driver: Person
let driverId = ''
let pendingDriver: Person
let volunteer: Actor & { authUserId: string; email: string; profileId: string }
let other: Actor & { authUserId: string; email: string; profileId: string }
let rideId = ''
let offerId = ''

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
  driver = await addPerson('DRIVER')
  driverId = await addDriver(driver)
  pendingDriver = await addPerson('DRIVER')
  await addDriver(pendingDriver, 'PENDING')

  const v = await newIdentity('Priya Volunteer')
  volunteer = { ...v, profileId: await register(v, { name: 'Priya Volunteer', phone: '', interests: ['FOOD_DISTRIBUTION', 'TRANSPORTATION'] }) }
  const w = await newIdentity('Wren Volunteer')
  other = { ...w, profileId: await register(w, { name: 'Wren Volunteer', phone: '604-555-0142', interests: ['GENERAL'] }) }

  // A ride offered to the approved driver, which a volunteer must never be able to see or take
  const r = await one<{ id: string }>(
    db,
    `insert into public.rides (type, org_id, house_id, requested_by, passengers, pickup_address, destination_name, destination_address, pickup_time, status)
     values ('SCHEDULED', $1, $2, $3, 1, '1 Main St', 'St. Paul''s Hospital', '1081 Burrard St', now() + interval '1 day', 'OFFERED') returning id`,
    [org.id, org.house, partner.profileId],
  )
  rideId = r.id
  const offer = await one<{ id: string }>(
    db,
    `insert into public.ride_offers (ride_id, driver_id, dispatch_revision, expires_at) values ($1, $2, 1, now() + interval '1 hour') returning id`,
    [rideId, driverId],
  )
  offerId = offer.id
})

describe('registering as a general volunteer', () => {
  test('creates a VOLUNTEER profile from the session, with no organization and no driver profile', async () => {
    const p = await profileOf(volunteer.authUserId)
    assert.equal(p.id, volunteer.profileId)
    assert.equal(p.role, 'VOLUNTEER')
    assert.equal(p.name, 'Priya Volunteer')
    assert.equal(p.phone, null, 'a phone number is optional')
    assert.equal(p.org_id, null)
    assert.equal(await count(`public.drivers where profile_id = $1`, [p.id]), 0, 'no driver row, even with Transportation chosen')
    assert.equal(await count(`public.volunteer_profiles where profile_id = $1`, [p.id]), 1)
  })

  test('saves every interest chosen, once each', async () => {
    assert.deepEqual(await myInterests(volunteer), ['FOOD_DISTRIBUTION', 'TRANSPORTATION'])
    const v = await newIdentity()
    await register(v, { name: 'Dup Test', interests: ['GENERAL', 'GENERAL', 'COMMUNITY_OUTREACH'] })
    assert.deepEqual(await myInterests(v), ['COMMUNITY_OUTREACH', 'GENERAL'])
  })

  test('needs a session, a name and at least one known interest', async () => {
    assert.match(await refusal(register({}, { name: 'Anon', interests: ['GENERAL'] })), /sign in|permission denied/i)
    const v = await newIdentity()
    assert.match(await refusal(register(v, { name: '', interests: ['GENERAL'] })), /Your name is required/)
    assert.match(await refusal(register(v, { name: 'A', interests: [] })), /at least one/)
    assert.match(await refusal(register(v, { name: 'A' })), /at least one/)
    assert.match(await refusal(register(v, { name: 'A', interests: ['GENERAL', 'DRIVING_LESSONS'] })), /isn't one we offer/)
    assert.match(await refusal(register(v, { name: 'A', interests: [42] })), /isn't one we offer/)
    assert.match(await refusal(register(v, { name: 'A', phone: '123', interests: ['GENERAL'] })), /10-digit/)
    assert.equal(await count(`public.profiles where auth_user_id = $1`, [v.authUserId]), 0, 'nothing is left behind by a refusal')
  })

  test('is safe to repeat: a retry returns the same profile and keeps the first interests', async () => {
    const again = await register(volunteer, { name: 'Someone Else', interests: ['GENERAL'] })
    assert.equal(again, volunteer.profileId)
    assert.equal(await count(`public.volunteer_profiles where profile_id = $1`, [volunteer.profileId]), 1)
    assert.deepEqual(await myInterests(volunteer), ['FOOD_DISTRIBUTION', 'TRANSPORTATION'])
    assert.equal((await profileOf(volunteer.authUserId)).name, 'Priya Volunteer')
  })

  test('the database refuses a second volunteer profile or a repeated interest', async () => {
    assert.match(await refusal(db.query(`insert into public.volunteer_profiles (profile_id) values ($1)`, [volunteer.profileId])), /duplicate key/)
    const vp = await one<{ id: string }>(db, `select id from public.volunteer_profiles where profile_id = $1`, [volunteer.profileId])
    assert.match(
      await refusal(db.query(`insert into public.volunteer_interests (volunteer_profile_id, interest) values ($1, 'TRANSPORTATION')`, [vp.id])),
      /duplicate key/,
    )
    assert.match(
      await refusal(db.query(`insert into public.volunteer_interests (volunteer_profile_id, interest) values ($1, 'ANYTHING')`, [vp.id])),
      /check constraint/,
    )
  })

  test('a volunteer profile can never belong to an organization', async () => {
    assert.match(
      await refusal(db.query(`update public.profiles set org_id = $1 where id = $2`, [org.id, volunteer.profileId])),
      /profiles_volunteer_no_org/,
    )
  })

  test('organization staff and admins cannot register as volunteers on the same login', async () => {
    assert.match(await refusal(register(partner, { name: 'P', interests: ['GENERAL'] })), /already has a Relay Collective role/)
    assert.match(await refusal(register(admin, { name: 'A', interests: ['GENERAL'] })), /already has a Relay Collective role/)
    assert.equal((await profileOf(partner.authUserId)).role, 'PARTNER')
  })

  test('a volunteer cannot then sign up as a driver or join an organization on the same login', async () => {
    await assert.rejects(
      as(db, volunteer, (tx) => tx.query(`select public.register_driver_profile($1)`, [JSON.stringify({ name: 'Priya', phone: '604-555-0123' })])),
      /already has a Relay Collective role/,
    )
    assert.equal(await count(`public.drivers where profile_id = $1`, [volunteer.profileId]), 0)
  })
})

describe('existing drivers', () => {
  test('a driver who also volunteers keeps their role, driver profile and verification', async () => {
    const before = await one<{ status: string; updated_at: string }>(db, `select status, updated_at from public.drivers where id = $1`, [driverId])
    const id = await register(driver, { name: 'ignored', interests: ['COMMUNITY_OUTREACH'] })
    assert.equal(id, driver.profileId)
    const p = await profileOf(driver.authUserId)
    assert.equal(p.role, 'DRIVER')
    assert.equal(p.name, 'Someone', 'their name is not replaced')
    assert.deepEqual(await one(db, `select status, updated_at from public.drivers where id = $1`, [driverId]), before)
    assert.deepEqual(await myInterests(driver), ['COMMUNITY_OUTREACH'])
    // Changing interests leaves driving alone too
    await setInterests(driver, ['GENERAL'])
    assert.deepEqual(await one(db, `select status, updated_at from public.drivers where id = $1`, [driverId]), before)
  })

  test('driver sign-up still works for a new identity', async () => {
    const v = await newIdentity()
    await as(db, v, (tx) =>
      tx.query(`select public.register_driver_profile($1)`, [
        JSON.stringify({
          name: 'Dana',
          phone: '604-555-0111',
          vehicle: 'Red Civic',
          seats: 3,
          serviceCities: ['Vancouver'],
          requestHours: [null, null, null, null, null, null, null],
        }),
      ]),
    )
    const p = await profileOf(v.authUserId)
    assert.equal(p.role, 'DRIVER')
    assert.equal(
      await one<{ status: string }>(db, `select status from public.drivers where profile_id = $1`, [p.id]).then((r) => r.status),
      'PENDING',
    )
    assert.equal(await count(`public.volunteer_profiles where profile_id = $1`, [p.id]), 0, 'drivers are not made volunteers automatically')
  })

  test('an approved driver still sees and can answer their ride offer', async () => {
    const seen = await as(db, driver, (tx) => tx.query(`select id from public.rides where id = $1`, [rideId]).then((r) => r.rows.length))
    assert.equal(seen, 1)
    const offers = await as(db, driver, (tx) => tx.query(`select id from public.ride_offers where id = $1`, [offerId]).then((r) => r.rows.length))
    assert.equal(offers, 1)
  })
})

describe('updating interests', () => {
  test('adds and removes, keeping each once', async () => {
    await setInterests(volunteer, ['TRANSPORTATION', 'RESOURCE_COORDINATION', 'RESOURCE_COORDINATION'])
    assert.deepEqual(await myInterests(volunteer), ['RESOURCE_COORDINATION', 'TRANSPORTATION'])
    await setInterests(volunteer, ['FOOD_DISTRIBUTION', 'TRANSPORTATION'])
    assert.deepEqual(await myInterests(volunteer), ['FOOD_DISTRIBUTION', 'TRANSPORTATION'])
  })

  test('refuses an empty or unknown list and keeps what was saved', async () => {
    assert.match(await refusal(setInterests(volunteer, [])), /at least one/)
    assert.match(await refusal(setInterests(volunteer, ['TRANSPORTATION', 'ADMIN'])), /isn't one we offer/)
    assert.match(await refusal(setInterests(volunteer, 'GENERAL')), /at least one/)
    assert.deepEqual(await myInterests(volunteer), ['FOOD_DISTRIBUTION', 'TRANSPORTATION'])
  })

  test('only for someone with a volunteer profile', async () => {
    assert.match(await refusal(setInterests(partner, ['GENERAL'])), /Register as a volunteer first/)
    assert.match(await refusal(setInterests((await newIdentity()) as Actor, ['GENERAL'])), /Register as a volunteer first/)
    assert.match(await refusal(setInterests({}, ['GENERAL'])), /Register as a volunteer first|permission denied/)
  })
})

describe('access to volunteer data', () => {
  test('a volunteer reads only their own profile and interests', async () => {
    const rows = await as(db, volunteer, (tx) =>
      tx.query<{ profile_id: string }>(`select profile_id from public.volunteer_profiles`).then((r) => r.rows),
    )
    assert.deepEqual(
      rows.map((r) => r.profile_id),
      [volunteer.profileId],
    )
    assert.deepEqual(await myInterests(other), ['GENERAL'])
    // Not even by asking for the other one directly
    const theirs = await as(db, volunteer, (tx) =>
      tx.query(
        `select 1 from public.volunteer_interests vi join public.volunteer_profiles vp on vp.id = vi.volunteer_profile_id where vp.profile_id = $1`,
        [other.profileId],
      ),
    )
    assert.equal(theirs.rows.length, 0)
    const profiles = await as(db, volunteer, (tx) => tx.query<{ id: string }>(`select id from public.profiles`).then((r) => r.rows.map((x) => x.id)))
    assert.deepEqual(profiles, [volunteer.profileId], 'no other person, driver or organization member is visible')
  })

  test('organization staff and drivers see no volunteer data', async () => {
    for (const who of [partner, pendingDriver]) {
      assert.equal(await as(db, who, (tx) => tx.query(`select 1 from public.volunteer_profiles`).then((r) => r.rows.length)), 0)
      assert.equal(await as(db, who, (tx) => tx.query(`select 1 from public.volunteer_interests`).then((r) => r.rows.length)), 0)
    }
    assert.equal(
      await as(db, {}, (tx) => refusal(tx.query(`select 1 from public.volunteer_profiles`))).then((m) => /permission denied/.test(m)),
      true,
    )
  })

  test('platform admins can read every volunteer profile and interest', async () => {
    const n = await as(db, admin, (tx) => tx.query(`select 1 from public.volunteer_profiles`).then((r) => r.rows.length))
    assert.equal(n, await count(`public.volunteer_profiles`))
    const interests = await as(db, admin, (tx) => tx.query(`select 1 from public.volunteer_interests`).then((r) => r.rows.length))
    assert.equal(interests, await count(`public.volunteer_interests`))
  })

  test('nobody writes the tables directly: not their own rows, not anyone else’s', async () => {
    const vp = await one<{ id: string }>(db, `select id from public.volunteer_profiles where profile_id = $1`, [other.profileId])
    const mine = await one<{ id: string }>(db, `select id from public.volunteer_profiles where profile_id = $1`, [volunteer.profileId])
    for (const sql of [
      [`insert into public.volunteer_interests (volunteer_profile_id, interest) values ($1, 'GENERAL')`, [vp.id]],
      [`insert into public.volunteer_interests (volunteer_profile_id, interest) values ($1, 'GENERAL')`, [mine.id]],
      [`delete from public.volunteer_interests where volunteer_profile_id = $1`, [vp.id]],
      [`update public.volunteer_interests set interest = 'GENERAL' where volunteer_profile_id = $1`, [mine.id]],
      [`insert into public.volunteer_profiles (profile_id) values ($1)`, [partner.profileId]],
      [`delete from public.volunteer_profiles where id = $1`, [mine.id]],
    ] as const) {
      assert.match(await refusal(as(db, volunteer, (tx) => tx.query(sql[0], [...sql[1]]))), /permission denied/, sql[0])
    }
    assert.deepEqual(await myInterests(other), ['GENERAL'])
  })
})

describe('volunteers get no CareRide or admin access', () => {
  test('a volunteer interested in transportation cannot see or take rides', async () => {
    await setInterests(volunteer, ['TRANSPORTATION'])
    for (const table of ['rides', 'ride_offers', 'drivers', 'houses', 'organizations', 'destinations', 'driver_documents']) {
      const rows = await as(db, volunteer, (tx) => tx.query(`select 1 from public.${table}`).then((r) => r.rows.length))
      assert.equal(rows, 0, `${table} should be hidden from a volunteer`)
    }
    assert.match(await refusal(as(db, volunteer, (tx) => tx.query(`select public.respond_to_offer($1, true)`, [offerId]))), /.+/)
    const ride = await one<{ status: string; driver_id: string | null }>(db, `select status, driver_id from public.rides where id = $1`, [rideId])
    assert.deepEqual(ride, { status: 'OFFERED', driver_id: null })
  })

  test('a volunteer cannot make themselves a driver, an admin, or verified', async () => {
    assert.match(
      await refusal(
        as(db, volunteer, (tx) =>
          tx.query(
            `insert into public.drivers (profile_id, background, vehicle, seats, service_cities, request_hours, status)
             values ($1, 'INDEPENDENT', 'Car', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', 'APPROVED')`,
            [volunteer.profileId],
          ),
        ),
      ),
      /permission denied/,
    )
    assert.match(
      await refusal(as(db, volunteer, (tx) => tx.query(`update public.profiles set role = 'PLATFORM_ADMIN' where id = $1`, [volunteer.profileId]))),
      /permission denied/,
    )
    assert.match(await refusal(as(db, volunteer, (tx) => tx.query(`update public.drivers set status = 'APPROVED'`))), /permission denied/)
    assert.match(await refusal(as(db, volunteer, (tx) => tx.query(`select public.admin_list_accounts()`))), /Only Relay Collective admins/)
    assert.match(await refusal(as(db, volunteer, (tx) => tx.query(`select public.list_join_requests('pending')`))), /.+/)
    const p = await profileOf(volunteer.authUserId)
    assert.equal(p.role, 'VOLUNTEER')
    assert.equal(await count(`public.drivers where profile_id = $1`, [p.id]), 0)
  })

  test('a volunteer’s feedback is filed under the volunteer workspace', async () => {
    const id = await as(db, other, (tx) =>
      one<{ id: string }>(
        tx,
        `select public.submit_feedback(gen_random_uuid(), 'general', 'Hello', 'Just saying hi', '/volunteer', 'organization') as id`,
      ).then((r) => r.id),
    )
    assert.equal((await one<{ w: string }>(db, `select source_workspace as w from public.feedback_submissions where id = $1`, [id])).w, 'volunteer')
  })
})

describe('closing and deleting a volunteer account', () => {
  test('a volunteer can close their own sign-in; their data then reads as closed', async () => {
    const v = await newIdentity()
    await register(v, { name: 'Closing Volunteer', interests: ['GENERAL'] })
    await as(db, v, (tx) => tx.query(`select public.deactivate_my_account()`))
    const p = await profileOf(v.authUserId)
    assert.equal(p.is_active, false)
    assert.equal(await as(db, v, (tx) => one<{ s: string }>(tx, `select public.my_account_state() as s`).then((r) => r.s)), 'INACTIVE')
    assert.deepEqual(await myInterests(v), [], 'a closed account reads nothing')
    assert.match(await refusal(setInterests(v, ['GENERAL'])), /Register as a volunteer first/)
  })

  test('permanent deletion lists, erases and verifies the volunteer profile, leaving nothing orphaned', async () => {
    const v = await newIdentity()
    const profileId = await register(v, { name: 'Deleted Volunteer', phone: '604-555-0150', interests: ['FOOD_DISTRIBUTION', 'GENERAL'] })
    const vp = await one<{ id: string }>(db, `select id from public.volunteer_profiles where profile_id = $1`, [profileId])

    const preview = await as(db, admin, (tx) =>
      one<{ p: { state: string; categories: { key: string; count: number; action: string }[] } }>(
        tx,
        `select public.admin_account_deletion_preview($1) as p`,
        [profileId],
      ).then((r) => r.p),
    )
    assert.equal(preview.state, 'READY')
    assert.deepEqual(
      preview.categories.find((c) => c.key === 'volunteer_profile'),
      { key: 'volunteer_profile', action: 'delete', count: 1 },
    )

    const job = await as(db, admin, (tx) =>
      one<{ j: { id: string } }>(tx, `select public.admin_begin_account_deletion($1, $2) as j`, [profileId, v.email]).then((r) => r.j),
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
    assert.equal(await count(`public.profiles where id = $1`, [profileId]), 0, 'nothing pointed at the profile, so it went too')
  })

  test('if the placeholder profile is removed, its volunteer rows go with it', async () => {
    const v = await newIdentity()
    const profileId = await register(v, { name: 'Cascade', interests: ['GENERAL'] })
    await db.query(`delete from public.profiles where id = $1`, [profileId])
    assert.equal(await count(`public.volunteer_profiles where profile_id = $1`, [profileId]), 0)
    assert.equal(
      await count(
        `public.volunteer_interests vi where not exists (select 1 from public.volunteer_profiles vp where vp.id = vi.volunteer_profile_id)`,
      ),
      0,
    )
  })
})

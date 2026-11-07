import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, refusal, type Actor } from './harness'

// Permanent account deletion, against the real migrations (supabase/migrations/20261029150000_account_deletion.sql).
// The Edge Function's two outside steps are played here by deleting the storage.objects and auth.users rows,
// which is what the Storage and Auth APIs do. Run with: npm run test:db

let db: PGlite

interface Person extends Actor {
  authUserId: string
  profileId: string
  email: string
}

type Queryable = Pick<Transaction, 'query'>

interface Job {
  id: string
  status: string
  step: string
  errorCode: string | null
  attempts: number
  authUserId?: string | null
  storage?: { bucket: string; path: string }[]
}

interface Preview {
  state: string
  blockers: string[]
  categories: { key: string; action: string; count: number }[]
  job?: Job
}

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

const orgs = { a: '', aHouse: '', b: '', bHouse: '', c: '', cHouse: '', provider: '' }
const people = {} as Record<
  | 'admin'
  | 'admin2'
  | 'adminA'
  | 'staffA'
  | 'newcomerA'
  | 'adminB'
  | 'loneAdminC'
  | 'staffC'
  | 'driver'
  | 'otherDriver'
  | 'providerAdmin'
  | 'providerDriver',
  Person
>
const drivers = { driver: '', otherDriver: '', providerDriver: '' }
const rides = { finished: '', upcoming: '', unrelated: '' }
let driverFile = ''
let otherFile = ''

async function addOrg(name: string, type = 'PARTNER_ORG'): Promise<{ org: string; house: string }> {
  const o = await one<{ id: string }>(
    db,
    `insert into public.organizations (name, type, contact_name, contact_phone, status) values ($1, $2, 'Contact', '604-555-0100', 'APPROVED') returning id`,
    [name, type],
  )
  if (type !== 'PARTNER_ORG') return { org: o.id, house: '' }
  const h = await one<{ id: string }>(
    db,
    `insert into public.houses (org_id, name, address, city, phone) values ($1, $2, '1 Main St', 'Vancouver', '604-555-0101') returning id`,
    [o.id, name],
  )
  return { org: o.id, house: h.id }
}

async function addPerson(key: keyof typeof people, role: string, orgId: string | null = null, houseId: string | null = null, orgRole?: string) {
  const email = `${key.toLowerCase()}@example.org`
  const u = await one<{ id: string }>(db, `insert into auth.users (email) values ($1) returning id`, [email])
  const p = await one<{ id: string }>(
    db,
    `insert into public.profiles (auth_user_id, name, phone, email, role, org_id, house_id, org_role)
     values ($1, $2, '604-555-0199', $3, $4, $5, $6, $7) returning id`,
    [u.id, `Person ${key}`, email, role, orgId, houseId, orgRole ?? null],
  )
  people[key] = { authUserId: u.id, profileId: p.id, email }
}

async function addDriver(person: Person, orgId: string | null = null): Promise<string> {
  const d = await one<{ id: string }>(
    db,
    `insert into public.drivers (profile_id, org_id, background, vehicle, seats, service_cities, request_hours, status)
     values ($1, $2, 'INDEPENDENT', 'Blue Corolla', 3, '{Vancouver}', '[null, null, null, null, null, null, null]', 'APPROVED') returning id`,
    [person.profileId, orgId],
  )
  return d.id
}

async function addRide(orgId: string, houseId: string, requestedBy: string, status: string, driverId: string | null): Promise<string> {
  const finished = status === 'COMPLETED'
  const r = await one<{ id: string }>(
    db,
    `insert into public.rides (type, org_id, house_id, requested_by, passengers, pickup_address, destination_name, destination_address,
                               pickup_time, status, driver_id, accepted_at, picked_up_at, completed_at)
     values ('SCHEDULED', $1, $2, $3, 1, '1 Main St', 'St. Paul''s Hospital', '1081 Burrard St', $4, $5, $6,
             case when $6::uuid is not null then now() end, case when $7 then now() end, case when $7 then now() end)
     returning id`,
    [
      orgId,
      houseId,
      requestedBy,
      finished ? new Date(Date.now() - 86_400_000).toISOString() : new Date(Date.now() + 86_400_000).toISOString(),
      status,
      driverId,
      finished,
    ],
  )
  return r.id
}

// A screenshot on someone's own feedback, uploaded the way the app does it
async function feedbackWithScreenshot(person: Person): Promise<string> {
  const feedbackId = await as(db, person, (tx) =>
    one<{ id: string }>(tx, `select public.submit_feedback($1, 'bug', 'Map is wrong', 'My street shows in the wrong place.') as id`, [
      crypto.randomUUID(),
    ]),
  ).then((r) => r.id)
  const grant = await as(db, person, (tx) =>
    one<{ grant: { id: string; storagePath: string } }>(tx, `select public.begin_feedback_attachment($1, 'shot.png', 'image/png', 1000) as grant`, [
      feedbackId,
    ]),
  ).then((r) => r.grant)
  await db.query(`insert into storage.objects (bucket_id, name, owner) values ('feedback-attachments', $1, $2)`, [
    grant.storagePath,
    person.authUserId,
  ])
  await as(db, person, (tx) => tx.query(`select public.confirm_feedback_attachment($1)`, [grant.id]))
  return grant.storagePath
}

const preview = (who: Actor, profileId: string) =>
  as(db, who, (tx) => one<{ p: Preview }>(tx, `select public.admin_account_deletion_preview($1) as p`, [profileId]).then((r) => r.p))
const begin = (who: Actor, target: Person, email = target.email) =>
  as(db, who, (tx) => one<{ j: Job }>(tx, `select public.admin_begin_account_deletion($1, $2) as j`, [target.profileId, email]).then((r) => r.j))
const claim = (who: Actor, jobId: string) =>
  as(db, who, (tx) => one<{ j: Job }>(tx, `select public.admin_claim_account_deletion($1) as j`, [jobId]).then((r) => r.j))
const advance = (who: Actor, jobId: string, step: string) =>
  as(db, who, (tx) => one<{ j: Job }>(tx, `select public.admin_advance_account_deletion($1, $2) as j`, [jobId, step]).then((r) => r.j))
const jobRow = (jobId: string) => one<Record<string, unknown>>(db, `select * from private.account_deletion_jobs where id = $1`, [jobId])
const count = (sql: string, params: unknown[] = []) => one<{ n: number }>(db, `select count(*)::int as n from ${sql}`, params).then((r) => r.n)
const objectExists = (path: string) => count(`storage.objects where name = $1`, [path]).then((n) => n > 0)
// Lets a test claim a job again right away, as a worker would after the one-minute wait
const staleJob = (jobId: string) =>
  db.query(`update private.account_deletion_jobs set updated_at = now() - interval '2 minutes' where id = $1`, [jobId])

// What the Edge Function does: Storage and Auth outside the database, every other step in it
async function runToEnd(who: Actor, jobId: string): Promise<Job> {
  let job = await claim(who, jobId)
  for (let round = 0; round < 8 && job.status === 'in_progress'; round++) {
    if (job.step === 'storage')
      for (const f of job.storage ?? []) await db.query(`delete from storage.objects where bucket_id = $1 and name = $2`, [f.bucket, f.path])
    if (job.step === 'auth' && job.authUserId) await db.query(`delete from auth.users where id = $1`, [job.authUserId])
    job = await advance(who, jobId, job.step)
  }
  return job
}

const category = (p: Preview, key: string) => p.categories.find((c) => c.key === key)

before(async () => {
  db = await migratedDatabase()
  const a = await addOrg('Belkin House')
  const b = await addOrg('Grace Mansion')
  const c = await addOrg('Richmond House')
  const provider = await addOrg('VanShare', 'TRANSPORT_PROVIDER')
  Object.assign(orgs, { a: a.org, aHouse: a.house, b: b.org, bHouse: b.house, c: c.org, cHouse: c.house, provider: provider.org })

  await addPerson('admin', 'PLATFORM_ADMIN')
  await addPerson('admin2', 'PLATFORM_ADMIN')
  await addPerson('adminA', 'PARTNER', a.org, a.house, 'ADMIN')
  await addPerson('staffA', 'PARTNER', a.org, a.house, 'STAFF')
  await addPerson('newcomerA', 'PARTNER', a.org, a.house, 'STAFF')
  await addPerson('adminB', 'PARTNER', b.org, b.house, 'ADMIN')
  await addPerson('loneAdminC', 'PARTNER', c.org, c.house, 'ADMIN')
  await addPerson('staffC', 'PARTNER', c.org, c.house, 'STAFF')
  await addPerson('driver', 'DRIVER')
  await addPerson('otherDriver', 'DRIVER')
  await addPerson('providerAdmin', 'ORG_ADMIN', provider.org)
  await addPerson('providerDriver', 'DRIVER')
  drivers.driver = await addDriver(people.driver)
  drivers.otherDriver = await addDriver(people.otherDriver)
  drivers.providerDriver = await addDriver(people.providerDriver, provider.org)

  // A finished ride the driver gave for Belkin House (booked by staffA), and an upcoming one for Grace Mansion
  rides.finished = await addRide(a.org, a.house, people.staffA.profileId, 'COMPLETED', drivers.driver)
  rides.upcoming = await addRide(b.org, b.house, people.adminB.profileId, 'ACCEPTED', drivers.driver)
  rides.unrelated = await addRide(b.org, b.house, people.adminB.profileId, 'COMPLETED', drivers.otherDriver)
  await db.query(
    `insert into public.ride_events (ride_id, kind, actor_profile_id, actor_role, actor_name) values ($1, 'DRIVER_ACCEPTED', $2, 'DRIVER', 'Person driver')`,
    [rides.finished, people.driver.profileId],
  )
  // The driver flagged an issue; the front desk rated the ride
  await db.query(
    `insert into public.ride_feedback (ride_id, author_role, author_profile_id, org_id, driver_id, note) values ($1, 'DRIVER', $2, $3, $4, 'Client''s neighbour was rude to me')`,
    [rides.finished, people.driver.profileId, a.org, drivers.driver],
  )
  await db.query(
    `insert into public.ride_feedback (ride_id, author_role, author_profile_id, org_id, driver_id, rating) values ($1, 'PARTNER', $2, $3, $4, 'UP')`,
    [rides.finished, people.staffA.profileId, a.org, drivers.driver],
  )

  driverFile = await feedbackWithScreenshot(people.driver)
  otherFile = await feedbackWithScreenshot(people.otherDriver)

  // Before driving, the driver asked to join Grace Mansion, and was invited to Belkin House
  await db.query(
    `insert into public.organization_join_requests (organization_id, user_id, message, status, cancelled_at) values ($1, $2, 'Hi, I''m Sam', 'cancelled', now())`,
    [b.org, people.driver.authUserId],
  )
  await db.query(
    `insert into public.organization_invitations (org_id, email, token_hash, invited_by, expires_at) values ($1, $2, '\\x01', $3, now() + interval '7 days')`,
    [a.org, people.driver.email, people.adminA.profileId],
  )
  await db.query(
    `insert into public.organization_membership_events (organization_id, subject_user_id, event_type) values ($1, $2, 'request_submitted')`,
    [b.org, people.driver.authUserId],
  )
})

describe('preview', () => {
  test('counts what the account actually has, and plans an action for each', async () => {
    const p = await preview(people.admin, people.driver.profileId)
    assert.equal(p.state, 'READY')
    assert.deepEqual(p.blockers, [])
    const expected: Record<string, [string, number]> = {
      auth_account: ['delete', 1],
      profile: ['anonymize', 1],
      driver_profile: ['delete', 1],
      open_rides: ['reassign', 1],
      product_feedback: ['delete', 1],
      personal_files: ['delete', 1],
      join_requests: ['delete', 1],
      invitations: ['delete', 1],
      ride_issue_reports: ['delete', 1],
      rides_driven: ['retain', 1],
      ride_history: ['anonymize', 1],
      organization_membership: ['remove', 0],
    }
    for (const [key, [action, n]] of Object.entries(expected)) {
      assert.deepEqual([category(p, key)?.action, category(p, key)?.count], [action, n], key)
    }
  })

  test('changes nothing', async () => {
    await preview(people.admin, people.driver.profileId)
    assert.equal(await count(`private.account_deletion_jobs`), 0)
    assert.equal(
      (await one<{ is_active: boolean }>(db, `select is_active from public.profiles where id = $1`, [people.driver.profileId])).is_active,
      true,
    )
  })
})

describe('who may delete (Test B)', () => {
  test('organization administrators, drivers and signed-out callers are refused at every step', async () => {
    for (const who of [people.adminA, people.providerAdmin, people.driver, {}]) {
      assert.match(await refusal(preview(who, people.staffA.profileId)), /admin|permission denied/i)
      assert.match(await refusal(begin(who, people.staffA)), /admin|permission denied/i)
    }
    assert.equal(await count(`private.account_deletion_jobs`), 0)
  })

  test('the job tables are out of the API’s reach', async () => {
    assert.match(await refusal(as(db, people.admin, (tx) => tx.query(`select * from private.account_deletion_jobs`))), /permission denied/)
  })

  test('the typed email has to match the account', async () => {
    assert.match(await refusal(begin(people.admin, people.staffA, people.adminA.email)), /doesn't match/)
  })
})

describe('safeguards', () => {
  test('an admin can’t delete their own account (Test C)', async () => {
    const p = await preview(people.admin, people.admin.profileId)
    assert.equal(p.state, 'BLOCKED')
    assert.deepEqual(p.blockers, ['SELF'])
    assert.match(await refusal(begin(people.admin, people.admin)), /signed in with/)
  })

  test('the last administrator of an organization with members can’t be deleted (Test D)', async () => {
    const p = await preview(people.admin, people.loneAdminC.profileId)
    assert.deepEqual(p.blockers, ['LAST_ORG_ADMIN'])
    assert.match(await refusal(begin(people.admin, people.loneAdminC)), /only administrator/)
    assert.equal(await count(`private.account_deletion_jobs`), 0)
  })

  test('the only administrator of a transport provider with drivers is blocked too', async () => {
    assert.deepEqual((await preview(people.admin, people.providerAdmin.profileId)).blockers, ['LAST_PROVIDER_ADMIN'])
  })

  test('another platform admin can be deleted while one remains', async () => {
    assert.equal((await preview(people.admin, people.admin2.profileId)).state, 'READY')
  })
})

describe('deleting a driver: storage failure, retry, auth failure, completion', () => {
  let jobId = ''

  test('two admins starting at once get one job (Test I)', async () => {
    const results = await Promise.allSettled([begin(people.admin, people.driver), begin(people.admin2, people.driver)])
    const started = results.filter((r) => r.status === 'fulfilled')
    assert.equal(started.length, 1)
    const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    assert.match(refused.reason.message, /already being deleted/)
    jobId = (started[0] as PromiseFulfilledResult<Job>).value.id
    assert.equal(await count(`private.account_deletion_jobs where target_profile_id = $1`, [people.driver.profileId]), 1)
    // The database itself refuses a second open job, whatever path tries
    assert.match(
      await refusal(
        db.query(`insert into private.account_deletion_jobs (target_profile_id, target_role, requested_by) values ($1, 'DRIVER', $2)`, [
          people.driver.profileId,
          people.admin.profileId,
        ]),
      ),
      /duplicate key/,
    )
  })

  test('starting switches the account off and sends upcoming rides back out', async () => {
    const p = await one<{ is_active: boolean }>(db, `select is_active from public.profiles where id = $1`, [people.driver.profileId])
    assert.equal(p.is_active, false)
    const ride = await one<{ status: string; driver_id: string | null }>(db, `select status, driver_id from public.rides where id = $1`, [
      rides.upcoming,
    ])
    assert.equal(ride.driver_id, null)
    assert.notEqual(ride.status, 'ACCEPTED')
    assert.equal((await preview(people.admin, people.driver.profileId)).state, 'IN_PROGRESS')
  })

  test('their earlier token can’t reach anything (Test J)', async () => {
    const state = await as(db, people.driver, (tx) => one<{ s: string }>(tx, `select public.my_account_state() as s`))
    assert.equal(state.s, 'INACTIVE')
    assert.equal(await as(db, people.driver, (tx) => tx.query(`select id from public.drivers`)).then((r) => r.rows.length), 0)
    assert.equal(await as(db, people.driver, (tx) => tx.query(`select id from public.feedback_submissions`)).then((r) => r.rows.length), 0)
    assert.match(
      await refusal(as(db, people.driver, (tx) => tx.query(`select public.submit_feedback($1, 'bug', 'x', 'y')`, [crypto.randomUUID()]))),
      /sign in/,
    )
  })

  test('a worker can’t take a job another is running (Test I)', async () => {
    await claim(people.admin, jobId)
    assert.match(await refusal(claim(people.admin2, jobId)), /running right now/)
  })

  test('records wait until Storage has removed every file (Test E)', async () => {
    // Storage refused: nothing deleted. The step can't be skipped by claiming it's done.
    let job = await advance(people.admin, jobId, 'storage')
    assert.equal(job.status, 'failed')
    assert.equal(job.errorCode, 'STORAGE_DELETE_FAILED')
    assert.equal(job.step, 'storage')
    job = await advance(people.admin, jobId, 'records')
    assert.equal(job.step, 'storage', 'a later step does nothing while an earlier one is unfinished')
    assert.equal(await count(`public.feedback_submissions where submitted_by = $1`, [people.driver.profileId]), 1)
    assert.equal(await objectExists(otherFile), true)
  })

  test('a retry carries on from the failed step and only touches this person’s files (Test E)', async () => {
    const job = await claim(people.admin, jobId)
    assert.equal(job.attempts, 2)
    assert.deepEqual(job.storage, [{ bucket: 'feedback-attachments', path: driverFile }])
    await db.query(`delete from storage.objects where name = $1`, [driverFile])
    const next = await advance(people.admin, jobId, 'storage')
    assert.equal(next.step, 'records')
    const afterRecords = await advance(people.admin, jobId, 'records')
    assert.equal(afterRecords.step, 'auth')
    assert.equal(await objectExists(otherFile), true)
  })

  test('the auth step isn’t done until the login is really gone (Test F)', async () => {
    const job = await advance(people.admin, jobId, 'auth')
    assert.equal(job.status, 'failed')
    assert.equal(job.errorCode, 'AUTH_DELETE_FAILED')
    // Partly done: the records are erased, the login isn't, and the job says so
    const profile = await one<{ name: string; deleted_at: string | null }>(db, `select name, deleted_at from public.profiles where id = $1`, [
      people.driver.profileId,
    ])
    assert.equal(profile.name, 'Deleted account')
    assert.notEqual(profile.deleted_at, null)
    assert.notEqual((await jobRow(jobId)).status, 'completed')
  })

  test('retrying finishes the job and verifies it', async () => {
    await staleJob(jobId)
    const job = await runToEnd(people.admin2, jobId)
    assert.equal(job.status, 'completed')
    assert.equal(job.step, 'done')
    assert.equal(await count(`auth.users where id = $1`, [people.driver.authUserId]), 0)
    assert.equal((await preview(people.admin, people.driver.profileId)).state, 'DELETED')
  })

  test('personal records are gone or anonymous (Test A)', async () => {
    const profile = await one<{ name: string; phone: string | null; email: string | null; auth_user_id: string | null }>(
      db,
      `select name, phone, email, auth_user_id from public.profiles where id = $1`,
      [people.driver.profileId],
    )
    assert.deepEqual(profile, { name: 'Deleted account', phone: null, email: null, auth_user_id: null })
    const driver = await one<{ vehicle: string; service_cities: string[]; deleted_at: string | null }>(
      db,
      `select vehicle, service_cities, deleted_at from public.drivers where id = $1`,
      [drivers.driver],
    )
    assert.equal(driver.vehicle, '')
    assert.deepEqual(driver.service_cities, [])
    assert.notEqual(driver.deleted_at, null)
    assert.equal(await count(`public.feedback_submissions where submitted_by = $1`, [people.driver.profileId]), 0)
    assert.equal(await count(`public.organization_join_requests where user_id = $1`, [people.driver.authUserId]), 0)
    assert.equal(await count(`public.organization_invitations where email = $1`, [people.driver.email]), 0)
    assert.equal(await count(`public.ride_feedback where author_profile_id = $1`, [people.driver.profileId]), 0)
    assert.equal(await count(`public.ride_events where actor_name = 'Person driver'`), 0)
    assert.equal(await count(`public.organization_membership_events where subject_user_id = $1`, [people.driver.authUserId]), 0)
  })

  test('shared records stay (Test G)', async () => {
    const finished = await one<{ status: string; driver_id: string }>(db, `select status, driver_id from public.rides where id = $1`, [
      rides.finished,
    ])
    assert.deepEqual(finished, { status: 'COMPLETED', driver_id: drivers.driver })
    assert.equal(await count(`public.rides where id = $1`, [rides.unrelated]), 1)
    assert.equal(await count(`public.rides where id = $1`, [rides.upcoming]), 1)
    assert.equal(await count(`public.ride_feedback where ride_id = $1 and author_role = 'PARTNER'`, [rides.finished]), 1)
    assert.equal(await count(`public.feedback_submissions where submitted_by = $1`, [people.otherDriver.profileId]), 1)
    assert.equal(await count(`public.organizations`), 4)
    assert.equal(await count(`public.profiles where id = $1 and is_active`, [people.otherDriver.profileId]), 1)
  })

  test('the job keeps no name or email, and lets go of the login id (Test K)', async () => {
    const row = await jobRow(jobId)
    const events = await db.query(`select * from private.account_deletion_events where job_id = $1`, [jobId])
    const stored = JSON.stringify([row, events.rows])
    for (const secret of [people.driver.email, 'Person driver', '604-555-0199', 'Blue Corolla', 'Map is wrong', people.driver.authUserId]) {
      assert.equal(stored.includes(secret), false, secret)
    }
    assert.equal(row.target_auth_user_id, null)
    assert.deepEqual(row.storage_objects, [])
    assert.ok(events.rows.some((e) => (e as { event: string }).event === 'step_failed'))
  })

  test('the deleted login can’t sign up again with its old token (Test J)', async () => {
    assert.match(
      await refusal(
        as(db, people.driver, (tx) =>
          tx.query(`select public.register_driver_profile($1)`, [JSON.stringify({ name: 'Sam', phone: '604-555-0123' })]),
        ),
      ),
      /foreign key|violates/,
    )
  })
})

describe('deleting an organization member (Test H)', () => {
  test('membership ends; the organization, its administrator and its rides stay', async () => {
    // staffA joined Grace Mansion's waitlist once and accepted Belkin House's invitation
    await db.query(
      `insert into public.organization_join_requests (organization_id, user_id, status, cancelled_at) values ($1, $2, 'cancelled', now())`,
      [orgs.b, people.staffA.authUserId],
    )
    await db.query(
      `insert into public.organization_invitations (org_id, email, token_hash, invited_by, expires_at, accepted_at, accepted_by)
       values ($1, $2, '\\x02', $3, now() + interval '7 days', now(), $4)`,
      [orgs.a, people.staffA.email, people.adminA.profileId, people.staffA.profileId],
    )
    const p = await preview(people.admin, people.staffA.profileId)
    assert.deepEqual(
      [category(p, 'organization_membership')?.count, category(p, 'rides_requested')?.count, category(p, 'ride_ratings')?.count],
      [1, 1, 1],
    )

    const started = await begin(people.admin, people.staffA)
    const job = await runToEnd(people.admin, started.id)
    assert.equal(job.status, 'completed')

    assert.equal(await count(`public.organization_join_requests where user_id = $1`, [people.staffA.authUserId]), 0)
    assert.equal(await count(`public.organization_invitations where accepted_by = $1`, [people.staffA.profileId]), 0)
    // Their booking stays the organization's, booked by an anonymous profile
    const ride = await one<{ requested_by: string; name: string }>(
      db,
      `select r.requested_by, p.name from public.rides r join public.profiles p on p.id = r.requested_by where r.id = $1`,
      [rides.finished],
    )
    assert.deepEqual(ride, { requested_by: people.staffA.profileId, name: 'Deleted account' })
    assert.equal(await count(`public.profiles where id = $1 and is_active and org_role = 'ADMIN'`, [people.adminA.profileId]), 1)
    // The organization's administrator sees a former member, not a name
    const members = await as(db, people.adminA, (tx) =>
      one<{ m: { id: string; name: string; status: string }[] }>(tx, `select public.list_organization_members(true) as m`),
    )
    const former = members.m.find((m) => m.id === people.staffA.profileId)
    assert.deepEqual([former?.name, former?.status], ['Deleted account', 'closed'])
  })

  test('someone nothing points to leaves no placeholder behind', async () => {
    const started = await begin(people.admin, people.newcomerA)
    assert.equal((await runToEnd(people.admin, started.id)).status, 'completed')
    assert.equal(await count(`public.profiles where id = $1`, [people.newcomerA.profileId]), 0)
    assert.equal((await jobRow(started.id)).status, 'completed', 'the deletion record outlives the profile')
  })

  test('the admin account list shows a deletion in progress, and drops the account once its login is gone', async () => {
    const started = await begin(people.admin, people.staffC)
    const listed = await as(db, people.admin, (tx) =>
      tx.query<{ id: string; deletion_status: string | null }>(`select id, deletion_status from public.admin_list_accounts()`),
    )
    assert.equal(listed.rows.find((r) => r.id === people.staffC.profileId)?.deletion_status, 'pending')
    await runToEnd(people.admin, started.id)
    const after = await as(db, people.admin, (tx) => tx.query<{ id: string }>(`select id from public.admin_list_accounts()`))
    assert.equal(
      after.rows.some((r) => r.id === people.staffC.profileId),
      false,
    )
  })
})

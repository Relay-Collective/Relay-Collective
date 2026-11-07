import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, refusal, type Actor } from './harness'

// Organization discovery, join requests and team management, against the real migrations
// (supabase/migrations/20261029120000_organization_membership.sql). Run with: npm run test:db

let db: PGlite

interface Member extends Actor {
  authUserId: string
  profileId: string
}

type Queryable = Pick<Transaction, 'query'>

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

const orgs = { a: '', b: '', hidden: '', pending: '' }
const people = {} as Record<'platformAdmin' | 'adminA' | 'staffA' | 'adminB', Member>

async function addOrg(name: string, status = 'APPROVED', discoverability = 'discoverable'): Promise<{ org: string; house: string }> {
  const o = await one<{ id: string }>(
    db,
    `insert into public.organizations (name, type, contact_name, contact_phone, status, discoverability)
     values ($1, 'PARTNER_ORG', 'Contact', '604-555-0100', $2, $3) returning id`,
    [name, status, discoverability],
  )
  const h = await one<{ id: string }>(
    db,
    `insert into public.houses (org_id, name, address, city, phone) values ($1, $2, '1 Main St', 'Vancouver', '604-555-0101') returning id`,
    [o.id, name],
  )
  return { org: o.id, house: h.id }
}

let emailCount = 0
// A login with no Relay Collective role yet: someone who just signed up
async function newIdentity(name = 'Applicant', confirmed = true): Promise<Actor & { authUserId: string }> {
  const u = await one<{ id: string }>(db, `insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id`, [
    `person${++emailCount}@example.org`,
    confirmed ? new Date().toISOString() : null,
    JSON.stringify({ full_name: name }),
  ])
  return { authUserId: u.id }
}

async function addMember(role: string, orgId: string | null, houseId: string | null, orgRole?: string): Promise<Member> {
  const identity = await newIdentity()
  const p = await one<{ id: string }>(
    db,
    `insert into public.profiles (auth_user_id, name, role, org_id, house_id, org_role) values ($1, 'Member', $2, $3, $4, $5) returning id`,
    [identity.authUserId, role, orgId, houseId, orgRole ?? null],
  )
  return { authUserId: identity.authUserId, profileId: p.id }
}

const search = (who: Actor, q: string) =>
  as(db, who, (tx) => tx.query<{ id: string; name: string; city: string; description: string | null }>(`select * from public.search_organizations($1)`, [q]).then((r) => r.rows))
const submit = (who: Actor, orgId: string, position: string | null = 'Case worker', message: string | null = 'I run the Tuesday program.') =>
  as(db, who, (tx) => one<{ id: string }>(tx, `select public.submit_join_request($1, $2, $3) as id`, [orgId, position, message]).then((r) => r.id))
const approve = (who: Actor, id: string, role = 'STAFF') =>
  as(db, who, (tx) => one<{ id: string }>(tx, `select public.approve_join_request($1, $2) as id`, [id, role]).then((r) => r.id))
const reject = (who: Actor, id: string, note: string | null = null) =>
  as(db, who, (tx) => tx.query(`select public.reject_join_request($1, $2)`, [id, note]))
const requestStatus = (id: string) =>
  one<{ status: string }>(db, `select status from public.organization_join_requests where id = $1`, [id]).then((r) => r.status)
const profileOf = (authUserId: string) =>
  db
    .query<{ id: string; org_id: string; org_role: string; is_active: boolean }>(
      `select id, org_id, org_role, is_active from public.profiles where auth_user_id = $1`,
      [authUserId],
    )
    .then((r) => r.rows)

before(async () => {
  db = await migratedDatabase()
  const a = await addOrg('Belkin House')
  const b = await addOrg('Grace Mansion')
  const hidden = await addOrg('Quiet Shelter Society', 'APPROVED', 'invitation_only')
  const pending = await addOrg('Belkin Annex', 'PENDING', 'discoverable')
  Object.assign(orgs, { a: a.org, b: b.org, hidden: hidden.org, pending: pending.org })
  people.platformAdmin = await addMember('PLATFORM_ADMIN', null, null)
  people.adminA = await addMember('PARTNER', a.org, a.house) // first member: ADMIN by default
  people.staffA = await addMember('PARTNER', a.org, a.house) // later members: STAFF by default
  people.adminB = await addMember('PARTNER', b.org, b.house)
})

after(async () => {
  await db.close()
})

describe('roles of existing and new members', () => {
  test('the first member of an organization is its administrator; later members are staff', async () => {
    assert.equal((await profileOf(people.adminA.authUserId))[0]!.org_role, 'ADMIN')
    assert.equal((await profileOf(people.staffA.authUserId))[0]!.org_role, 'STAFF')
  })

  test('nobody can write a profile role, request or event from the browser', async () => {
    for (const sql of [
      `update public.profiles set org_role = 'ADMIN' where id = '${people.staffA.profileId}'`,
      `insert into public.organization_join_requests (organization_id, user_id) values ('${orgs.a}', '${people.staffA.authUserId}')`,
      `update public.organizations set discoverability = 'discoverable' where id = '${orgs.hidden}'`,
      `insert into public.organization_membership_events (organization_id, event_type) values ('${orgs.a}', 'role_changed')`,
    ]) {
      assert.match(await refusal(as(db, people.staffA, (tx) => tx.query(sql))), /permission denied/)
    }
  })
})

describe('discovery (scenario F)', () => {
  test('search finds approved, discoverable organizations by partial name, best match first', async () => {
    const someone = await newIdentity()
    const found = await search(someone, 'belk')
    assert.deepEqual(
      found.map((o) => o.name),
      ['Belkin House'],
    )
    assert.deepEqual(Object.keys(found[0]!).sort(), ['city', 'description', 'id', 'name'])
    assert.deepEqual(
      (await search(someone, 'man')).map((o) => o.name),
      ['Grace Mansion'],
    )
  })

  test('invitation-only and unapproved organizations never appear', async () => {
    const someone = await newIdentity()
    assert.deepEqual(await search(someone, 'Quiet'), [])
    assert.deepEqual(await search(someone, 'Annex'), [])
    assert.deepEqual((await search(someone, 'e')).length, 0) // too short to search
  })

  test('wildcards in the search are taken literally', async () => {
    const someone = await newIdentity()
    assert.deepEqual(await search(someone, '%%'), [])
    assert.deepEqual(await search(someone, '__'), [])
  })

  test('signed-out visitors cannot search; signed-in people still cannot read the organizations table', async () => {
    assert.match(await refusal(search({}, 'Belkin')), /permission denied/)
    const someone = await newIdentity()
    const { rows } = await as(db, someone, (tx) => tx.query(`select id from public.organizations`))
    assert.deepEqual(rows, [])
  })

  test('searching is rate limited per person', async () => {
    const someone = await newIdentity()
    for (let i = 0; i < 40; i++) await search(someone, 'Belkin')
    assert.match(await refusal(search(someone, 'Belkin')), /Too many searches/)
    assert.equal((await search(await newIdentity(), 'Belkin')).length, 1) // others are unaffected
  })

  test('only an administrator of an approved organization can make it discoverable', async () => {
    const visibility = (who: Actor, value: string) =>
      as(db, who, (tx) => tx.query(`select public.set_organization_visibility($1, $2)`, [value, 'Shelter and meals.']))
    assert.match(await refusal(visibility(people.staffA, 'discoverable')), /Only your organization's administrators/)
    await visibility(people.adminA, 'invitation_only')
    assert.deepEqual(await search(await newIdentity(), 'Belkin House'), [])
    await visibility(people.adminA, 'discoverable')
    const [found] = await search(await newIdentity(), 'Belkin House')
    assert.equal(found!.description, 'Shelter and meals.')

    const pendingAdmin = await addMember(
      'PARTNER',
      orgs.pending,
      (
        await one<{ id: string }>(db, `select id from public.houses where org_id = $1`, [orgs.pending])
      ).id,
    )
    await db.query(`update public.organizations set discoverability = 'invitation_only' where id = $1`, [orgs.pending])
    assert.match(await refusal(visibility(pendingAdmin, 'discoverable')), /once Relay Collective approves it/)
  })
})

describe('requesting to join', () => {
  test('a request for an invitation-only or unknown organization gets the same answer', async () => {
    const someone = await newIdentity()
    const hidden = await refusal(submit(someone, orgs.hidden))
    const unknown = await refusal(submit(someone, crypto.randomUUID()))
    assert.equal(hidden, unknown)
    assert.match(hidden, /isn't accepting requests/)
  })

  test('an unconfirmed email cannot ask to join', async () => {
    assert.match(await refusal(submit(await newIdentity('X', false), orgs.a)), /confirm your email/)
  })

  test('someone who already has a role cannot ask to join', async () => {
    assert.match(await refusal(submit(people.staffA, orgs.a)), /already a member/)
    assert.match(await refusal(submit(people.adminB, orgs.a)), /one organization/)
  })

  test('scenario C: one pending request at a time; a retry returns the same request', async () => {
    const someone = await newIdentity()
    const first = await submit(someone, orgs.a)
    assert.equal(await submit(someone, orgs.a), first)
    assert.match(await refusal(submit(someone, orgs.b)), /already have a request waiting/)
    // The database itself refuses a second pending row, whatever a function might do
    const insert = db.query(`insert into public.organization_join_requests (organization_id, user_id) values ($1, $2)`, [orgs.a, someone.authUserId])
    assert.match(await refusal(insert), /organization_join_requests_one_pending/)
  })

  test('applicants see their own requests, without review notes, and nobody else’s', async () => {
    const mine = await newIdentity()
    const other = await newIdentity()
    const id = await submit(mine, orgs.a)
    await submit(other, orgs.a)
    const { rows } = await as(db, mine, (tx) => tx.query<{ id: string }>(`select id from public.organization_join_requests`))
    assert.deepEqual(
      rows.map((r) => r.id),
      [id],
    )
    assert.match(await refusal(as(db, mine, (tx) => tx.query(`select review_note from public.organization_join_requests`))), /permission denied/)
    const listed = await as(db, mine, (tx) => one<{ list: { orgName: string; status: string }[] }>(tx, `select public.my_join_requests() as list`))
    assert.deepEqual(
      listed.list.map((r) => [r.orgName, r.status]),
      [['Belkin House', 'pending']],
    )
  })

  test('an applicant can withdraw a pending request, and nothing else', async () => {
    const someone = await newIdentity()
    const other = await newIdentity()
    const id = await submit(someone, orgs.b)
    const cancel = (who: Actor) => as(db, who, (tx) => tx.query(`select public.cancel_join_request($1)`, [id]))
    assert.match(await refusal(cancel(other)), /can't be withdrawn/)
    await cancel(someone)
    assert.equal(await requestStatus(id), 'cancelled')
    assert.deepEqual(await profileOf(someone.authUserId), [])
    assert.match(await refusal(cancel(someone)), /can't be withdrawn/)
    assert.match(await refusal(approve(people.adminB, id)), /already withdrawn/)
    // After withdrawing, they may ask again
    await submit(someone, orgs.a)
  })
})

describe('reviewing requests', () => {
  test('scenario A: an administrator approves with a role, and the member gets access', async () => {
    const applicant = await newIdentity('Priya Shah')
    const id = await submit(applicant, orgs.a)

    const list = await as(db, people.adminA, (tx) =>
      one<{ list: { id: string; applicantName: string; applicantEmail: string; emailVerified: boolean }[] }>(
        tx,
        `select public.list_join_requests('pending') as list`,
      ),
    )
    const listed = list.list.find((r) => r.id === id)!
    assert.equal(listed.applicantName, 'Priya Shah')
    assert.match(listed.applicantEmail, /@example\.org$/)
    assert.equal(listed.emailVerified, true)

    const profileId = await approve(people.adminA, id, 'STAFF')
    assert.equal(await requestStatus(id), 'approved')
    const [profile] = await profileOf(applicant.authUserId)
    assert.deepEqual(profile, { id: profileId, org_id: orgs.a, org_role: 'STAFF', is_active: true })

    // The new member reads their organization, and appears in its directory
    const seen = await as(db, applicant, (tx) => tx.query<{ id: string }>(`select id from public.organizations`))
    assert.deepEqual(
      seen.rows.map((r) => r.id),
      [orgs.a],
    )
    const members = await as(db, people.adminA, (tx) =>
      one<{ list: { id: string; role: string; status: string }[] }>(tx, `select public.list_organization_members() as list`),
    )
    const listedMember = members.list.find((m) => m.id === profileId)
    assert.deepEqual([listedMember?.role, listedMember?.status], ['STAFF', 'active'])

    const events = await db.query<{ event_type: string }>(
      `select event_type from public.organization_membership_events where request_id = $1 order by id`,
      [id],
    )
    assert.deepEqual(
      events.rows.map((e) => e.event_type),
      ['request_submitted', 'request_approved'],
    )
  })

  test('scenario B: rejecting creates no membership and keeps the note from the applicant', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    await reject(people.adminA, id, 'We could not confirm they work here.')
    assert.equal(await requestStatus(id), 'rejected')
    assert.deepEqual(await profileOf(applicant.authUserId), [])
    const mine = await as(db, applicant, (tx) => one<{ list: Record<string, unknown>[] }>(tx, `select public.my_join_requests() as list`))
    assert.equal(JSON.stringify(mine.list).includes('confirm they work'), false)
    assert.match(await refusal(approve(people.adminA, id)), /already declined/)
  })

  test('scenario D: staff, and the applicant themselves, cannot approve', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    assert.match(await refusal(approve(people.staffA, id)), /Only your organization's administrators/)
    assert.match(await refusal(approve(applicant, id)), /Only your organization's administrators/)
    assert.match(
      await refusal(as(db, people.staffA, (tx) => tx.query(`select public.list_join_requests()`))),
      /Only your organization's administrators/,
    )
    assert.equal(await requestStatus(id), 'pending')
  })

  test('scenario E: an administrator of another organization cannot see or decide a request', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    assert.match(await refusal(approve(people.adminB, id)), /wasn't found/)
    assert.match(await refusal(reject(people.adminB, id)), /wasn't found/)
    const theirs = await as(db, people.adminB, (tx) => one<{ list: { id: string }[] }>(tx, `select public.list_join_requests('all') as list`))
    assert.equal(
      theirs.list.some((r) => r.id === id),
      false,
    )
    const { rows } = await as(db, people.adminB, (tx) => tx.query(`select id from public.organization_join_requests where id = $1`, [id]))
    assert.deepEqual(rows, [])
  })

  test('only organization roles can be granted, never a platform role', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    for (const role of ['PLATFORM_ADMIN', 'ORG_ADMIN', '', 'admin']) {
      assert.match(await refusal(approve(people.adminA, id, role)), /Choose a role/)
    }
    assert.equal(await requestStatus(id), 'pending')
  })

  test('scenario J: approving twice never creates a second membership', async () => {
    const admin2 = await addMember(
      'PARTNER',
      orgs.a,
      (
        await one<{ id: string }>(db, `select id from public.houses where org_id = $1`, [orgs.a])
      ).id,
      'ADMIN',
    )
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    // PGlite runs one connection, so these run one after the other; the row lock and advisory lock in
    // approve_join_request (and the unique login on profiles) are what make true concurrency safe.
    const results = await Promise.allSettled([approve(people.adminA, id, 'STAFF'), approve(admin2, id, 'ADMIN')])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    assert.match((failed.reason as Error).message, /already approved/)
    assert.equal((await profileOf(applicant.authUserId)).length, 1)
  })

  test('approval is all or nothing: a failure leaves the request pending', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    // The applicant got a role some other way while waiting (made directly here, bypassing the trigger's cleanup)
    await db.query(`alter table public.profiles disable trigger profiles_close_join_requests`)
    await db.query(`insert into public.profiles (auth_user_id, name, role) values ($1, 'X', 'DRIVER')`, [applicant.authUserId])
    await db.query(`alter table public.profiles enable trigger profiles_close_join_requests`)
    assert.match(await refusal(approve(people.adminA, id)), /already has a Relay Collective role/)
    assert.equal(await requestStatus(id), 'pending')
  })

  test('joining another way closes a pending request', async () => {
    const applicant = await newIdentity()
    const id = await submit(applicant, orgs.a)
    // e.g. signing up as a driver while waiting
    await db.query(`insert into public.profiles (auth_user_id, name, role) values ($1, 'X', 'DRIVER')`, [applicant.authUserId])
    assert.equal(await requestStatus(id), 'cancelled')
  })
})

describe('managing members', () => {
  test('administrators change roles; staff cannot, and nobody changes their own', async () => {
    const setRole = (who: Actor, profileId: string, role: string) =>
      as(db, who, (tx) => tx.query(`select public.set_member_role($1, $2)`, [profileId, role]))
    assert.match(await refusal(setRole(people.staffA, people.staffA.profileId, 'ADMIN')), /Only your organization's administrators/)
    assert.match(await refusal(setRole(people.adminA, people.adminA.profileId, 'STAFF')), /can't change your own role/)
    assert.match(await refusal(setRole(people.adminA, people.adminB.profileId, 'STAFF')), /isn't an active member/)
    assert.match(await refusal(setRole(people.adminA, people.staffA.profileId, 'PLATFORM_ADMIN')), /Choose a role/)
    await setRole(people.adminA, people.staffA.profileId, 'ADMIN')
    await setRole(people.staffA, people.adminA.profileId, 'STAFF') // the new administrator demotes the old one
    await setRole(people.staffA, people.adminA.profileId, 'ADMIN')
    await setRole(people.adminA, people.staffA.profileId, 'STAFF')
  })

  test('only administrators see members’ emails', async () => {
    const list = (who: Actor) =>
      as(db, who, (tx) => one<{ list: { email: string | null }[] }>(tx, `select public.list_organization_members() as list`).then((r) => r.list))
    assert.ok((await list(people.adminA)).every((m) => m.email))
    assert.ok((await list(people.staffA)).every((m) => m.email === null))
  })

  test('scenario G: removing a member ends their access but keeps their login and history', async () => {
    const applicant = await newIdentity()
    const profileId = await approve(people.adminA, await submit(applicant, orgs.a))
    const remove = (who: Actor, id: string) => as(db, who, (tx) => tx.query(`select public.remove_member($1)`, [id]))
    assert.match(await refusal(remove(people.staffA, profileId)), /Only your organization's administrators/)
    assert.match(await refusal(remove(people.adminB, profileId)), /isn't an active member/)
    assert.match(await refusal(remove(people.adminA, people.adminA.profileId)), /can't remove yourself/)

    await remove(people.adminA, profileId)
    const login = await db.query(`select id from auth.users where id = $1`, [applicant.authUserId])
    assert.equal(login.rows.length, 1)
    const kept = await one<{ org_id: string; auth_user_id: string | null; is_active: boolean }>(
      db,
      `select org_id, auth_user_id, is_active from public.profiles where id = $1`,
      [profileId],
    )
    assert.deepEqual(kept, { org_id: orgs.a, auth_user_id: null, is_active: false })
    const seen = await as(db, applicant, (tx) => tx.query(`select id from public.organizations`))
    assert.deepEqual(seen.rows, [])
    const state = await as(db, applicant, (tx) => one<{ s: string }>(tx, `select public.my_account_state() as s`))
    assert.equal(state.s, 'NONE') // they can start again: ask to join, or join elsewhere
    const former = await as(db, people.adminA, (tx) =>
      one<{ list: { id: string; status: string }[] }>(tx, `select public.list_organization_members(true) as list`),
    )
    assert.equal(former.list.find((m) => m.id === profileId)?.status, 'removed')
  })

  test('scenario H: an organization never loses its last administrator', async () => {
    const solo = await addOrg('Harbour Light')
    const admin = await addMember('PARTNER', solo.org, solo.house)
    const staff = await addMember('PARTNER', solo.org, solo.house)
    // Closing their own account while colleagues remain
    assert.match(await refusal(as(db, admin, (tx) => tx.query(`select public.deactivate_my_account()`))), /at least one administrator/)
    // Even a direct change through a privileged path is refused for a signed-in member
    assert.match(
      await refusal(
        as(db, admin, async (tx) => {
          await tx.exec('reset role')
          await tx.query(`update public.profiles set org_role = 'STAFF' where id = $1`, [admin.profileId])
        }),
      ),
      /at least one administrator/,
    )
    // With another administrator it's fine
    await as(db, admin, (tx) => tx.query(`select public.set_member_role($1, 'ADMIN')`, [staff.profileId]))
    await as(db, staff, (tx) => tx.query(`select public.set_member_role($1, 'STAFF')`, [admin.profileId]))
    assert.match(
      await refusal(as(db, admin, (tx) => tx.query(`select public.set_member_role($1, 'STAFF')`, [staff.profileId]))),
      /Only your organization's administrators/,
    )
  })
})

describe('invitations (scenario I)', () => {
  test('administrators invite; an invited colleague joins as staff; staff cannot invite', async () => {
    const invitee = await one<{ id: string; email: string }>(db, `insert into auth.users (email) values ('invited@example.org') returning id, email`)
    assert.match(
      await refusal(as(db, people.staffA, (tx) => tx.query(`select public.create_invitation('x@example.org')`))),
      /Only your organization's administrators/,
    )
    const created = await as(db, people.adminA, (tx) =>
      one<{ inv: { token: string } }>(tx, `select public.create_invitation($1) as inv`, [invitee.email]),
    )
    await as(db, { authUserId: invitee.id }, (tx) => tx.query(`select public.accept_invitation($1)`, [created.inv.token]))
    const [profile] = await profileOf(invitee.id)
    assert.equal(profile!.org_id, orgs.a)
    assert.equal(profile!.org_role, 'STAFF')
  })

  test('an invitation accepted while a request is pending closes the request', async () => {
    const applicant = await newIdentity()
    const email = (await one<{ email: string }>(db, `select email from auth.users where id = $1`, [applicant.authUserId])).email
    const id = await submit(applicant, orgs.b)
    const created = await as(db, people.adminA, (tx) => one<{ inv: { token: string } }>(tx, `select public.create_invitation($1) as inv`, [email]))
    await as(db, applicant, (tx) => tx.query(`select public.accept_invitation($1)`, [created.inv.token]))
    assert.equal(await requestStatus(id), 'cancelled')
  })
})

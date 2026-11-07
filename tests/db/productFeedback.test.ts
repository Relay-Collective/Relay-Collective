import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { as, migratedDatabase, refusal, type Actor } from './harness'

// Feedback & Suggestions access rules, against the real migrations (supabase/migrations/20261028120000_product_feedback.sql).
// Run with: npm run test:db

let db: PGlite

interface Person extends Actor {
  authUserId: string
  profileId: string
}

const people: Record<'admin' | 'admin2' | 'partner' | 'colleague' | 'otherPartner' | 'driver' | 'orgAdmin' | 'closed', Person> = {} as never
const orgs = { a: '', b: '', provider: '' }

type Queryable = Pick<Transaction, 'query'>

async function one<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await tx.query<T>(sql, params)
  return rows[0]!
}

async function rows<T>(tx: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await tx.query<T>(sql, params)).rows
}

async function addPerson(key: keyof typeof people, role: string, orgId: string | null, houseId: string | null, active = true) {
  const { rows: [u] } = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${key}@example.org`])
  const { rows: [p] } = await db.query<{ id: string }>(
    `insert into public.profiles (auth_user_id, name, role, org_id, house_id, is_active) values ($1, $2, $3, $4, $5, $6) returning id`,
    [u!.id, key, role, orgId, houseId, active],
  )
  people[key] = { authUserId: u!.id, profileId: p!.id }
}

async function addOrg(name: string, type: string): Promise<{ org: string; house?: string }> {
  const { rows: [o] } = await db.query<{ id: string }>(
    `insert into public.organizations (name, type, contact_name, contact_phone, status) values ($1, $2, 'Contact', '604-555-0100', 'APPROVED') returning id`,
    [name, type],
  )
  if (type !== 'PARTNER_ORG') return { org: o!.id }
  const { rows: [h] } = await db.query<{ id: string }>(
    `insert into public.houses (org_id, name, address, city, phone) values ($1, $2, '1 Main St', 'Vancouver', '604-555-0101') returning id`,
    [o!.id, name],
  )
  return { org: o!.id, house: h!.id }
}

function submit(person: Actor, fields: Partial<{ requestId: string; type: string; title: string; description: string; page: string; workspace: string; release: string }> = {}) {
  return as(db, person, (tx) =>
    one<{ id: string }>(tx, `select public.submit_feedback($1, $2, $3, $4, $5, $6, $7) as id`, [
      fields.requestId ?? crypto.randomUUID(),
      fields.type ?? 'bug',
      fields.title ?? 'The ride list is slow',
      fields.description ?? 'It takes a long time to load on my phone.',
      fields.page ?? null,
      fields.workspace ?? null,
      fields.release ?? null,
    ]).then((r) => r.id),
  )
}

function triage(person: Actor, id: string, field: string, expected: string | null, value: string | null) {
  return as(db, person, (tx) => tx.query(`select public.update_feedback_triage($1, $2, $3, $4)`, [id, field, expected, value]))
}

function message(person: Actor, id: string, text: string, visibility: string) {
  return as(db, person, (tx) => tx.query(`select public.add_feedback_message($1, $2, $3)`, [id, text, visibility]))
}

function visible(person: Actor, id: string) {
  return as(db, person, (tx) => rows<{ id: string }>(tx, `select id from public.feedback_submissions where id = $1`, [id]))
}

before(async () => {
  db = await migratedDatabase()
  const a = await addOrg('Belkin House', 'PARTNER_ORG')
  const b = await addOrg('Grace Mansion', 'PARTNER_ORG')
  const provider = await addOrg('VanShare', 'TRANSPORT_PROVIDER')
  Object.assign(orgs, { a: a.org, b: b.org, provider: provider.org })
  await addPerson('admin', 'PLATFORM_ADMIN', null, null)
  await addPerson('admin2', 'PLATFORM_ADMIN', null, null)
  await addPerson('partner', 'PARTNER', a.org, a.house!)
  await addPerson('colleague', 'PARTNER', a.org, a.house!)
  await addPerson('otherPartner', 'PARTNER', b.org, b.house!)
  await addPerson('driver', 'DRIVER', null, null)
  await addPerson('orgAdmin', 'ORG_ADMIN', provider.org, null)
  await addPerson('closed', 'PARTNER', b.org, b.house!, false)
})

after(async () => {
  await db.close()
})

describe('sending feedback', () => {
  test('anonymous visitors cannot send or read feedback', async () => {
    assert.match(await refusal(submit({})), /permission denied/)
    assert.match(await refusal(as(db, {}, (tx) => tx.query('select id from public.feedback_submissions'))), /permission denied/)
  })

  test('a deactivated account cannot send feedback', async () => {
    assert.match(await refusal(submit(people.closed)), /Please sign in/)
  })

  test('feedback is saved under the caller and their own organization, with no triage', async () => {
    const id = await submit(people.partner, { workspace: 'admin' })
    const row = await one<Record<string, unknown>>(
      db,
      `select submitted_by, organization_id, status, priority, assigned_to, resolved_at, source_workspace from public.feedback_submissions where id = $1`,
      [id],
    )
    assert.deepEqual(row, {
      submitted_by: people.partner.profileId,
      organization_id: orgs.a,
      status: 'new',
      priority: null,
      assigned_to: null,
      resolved_at: null,
      source_workspace: 'organization', // asking for "admin" doesn't make it so
    })
    const history = await db.query(`select previous_status, new_status, changed_by from public.feedback_status_history where feedback_id = $1`, [id])
    assert.deepEqual(history.rows, [{ previous_status: null, new_status: 'new', changed_by: people.partner.profileId }])
  })

  test('a retried send returns the first submission instead of a second one', async () => {
    const requestId = crypto.randomUUID()
    const first = await submit(people.partner, { requestId })
    const again = await submit(people.partner, { requestId, title: 'Changed on retry' })
    assert.equal(again, first)
    const { rows: found } = await db.query(`select count(*)::int as n from public.feedback_submissions where client_request_id = $1`, [requestId])
    assert.deepEqual(found, [{ n: 1 }])
  })

  test('the browser cannot write the table directly, so it cannot pick a submitter, priority or status', async () => {
    const insert = as(db, people.partner, (tx) =>
      tx.query(
        `insert into public.feedback_submissions (client_request_id, submitted_by, feedback_type, title, description, source_workspace, priority)
         values ($1, $2, 'bug', 'x', 'y', 'organization', 'critical')`,
        [crypto.randomUUID(), people.otherPartner.profileId],
      ),
    )
    assert.match(await refusal(insert), /permission denied/)
    const id = await submit(people.partner)
    for (const set of [`status = 'resolved'`, `priority = 'critical'`, `assigned_to = '${people.admin.profileId}'`, `resolved_at = now()`, `submitted_by = '${people.otherPartner.profileId}'`]) {
      assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`update public.feedback_submissions set ${set} where id = $1`, [id]))), /permission denied/)
    }
    assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`delete from public.feedback_submissions where id = $1`, [id]))), /permission denied/)
  })

  test('only an app route is kept as the related page, without its query, fragment or ids', async () => {
    const page = async (raw: string) => {
      const id = await submit(people.partner, { page: raw })
      return (await db.query<{ source_page: string | null }>(`select source_page from public.feedback_submissions where id = $1`, [id])).rows[0]!.source_page
    }
    assert.equal(await page('/workspace/transportation/rides/0b5f8c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f?token=secret#x'), '/workspace/transportation/rides/:id')
    assert.equal(await page('https://evil.example/workspace?access_token=abc'), null)
    assert.equal(await page('/workspace/<script>'), null)
  })

  test('drivers can say the feedback is about driving; update feedback keeps its version', async () => {
    const id = await submit(people.driver, { workspace: 'driver', type: 'release_feedback', release: '1.4.0' })
    const other = await submit(people.driver, { type: 'bug', release: '1.4.0' })
    const { rows: found } = await db.query(`select id, source_workspace, related_release, organization_id from public.feedback_submissions where id in ($1, $2) order by reference`, [id, other])
    assert.deepEqual(found, [
      { id, source_workspace: 'driver', related_release: '1.4.0', organization_id: null },
      { id: other, source_workspace: 'volunteer', related_release: null, organization_id: null },
    ])
  })

  test('the form rules are checked again by the database', async () => {
    assert.match(await refusal(submit(people.partner, { title: '   ' })), /Add a short title/)
    assert.match(await refusal(submit(people.partner, { title: 'x'.repeat(151) })), /150 characters/)
    assert.match(await refusal(submit(people.partner, { description: 'x'.repeat(5001) })), /5,000 characters/)
    assert.match(await refusal(submit(people.partner, { type: 'praise' })), /Choose what kind/)
  })
})

describe('reading feedback', () => {
  test('people see only their own feedback: not a colleague’s, another organization’s, or an organization admin’s view', async () => {
    const id = await submit(people.partner)
    assert.equal((await visible(people.partner, id)).length, 1)
    assert.equal((await visible(people.colleague, id)).length, 0)
    assert.equal((await visible(people.otherPartner, id)).length, 0)
    assert.equal((await visible(people.orgAdmin, id)).length, 0)
    assert.equal((await visible(people.driver, id)).length, 0)
    assert.equal((await visible(people.admin, id)).length, 1)
  })

  test('submitters cannot read priority or assignment, even on their own feedback', async () => {
    const id = await submit(people.partner)
    for (const column of ['priority', 'assigned_to', 'client_request_id']) {
      assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`select ${column} from public.feedback_submissions where id = $1`, [id]))), /permission denied/)
    }
  })

  test('only platform admins can use the admin functions', async () => {
    const id = await submit(people.partner)
    for (const person of [people.partner, people.orgAdmin, people.driver]) {
      assert.match(await refusal(as(db, person, (tx) => tx.query(`select public.admin_list_feedback('{}')`))), /Only Relay Collective admins/)
      assert.match(await refusal(as(db, person, (tx) => tx.query(`select public.admin_get_feedback($1)`, [id]))), /Only Relay Collective admins/)
      assert.match(await refusal(as(db, person, (tx) => tx.query(`select public.admin_feedback_summary()`))), /Only Relay Collective admins/)
      assert.match(await refusal(triage(person, id, 'status', 'new', 'resolved')), /Only Relay Collective admins/)
      assert.match(await refusal(message(person, id, 'Hi', 'public')), /Only Relay Collective admins/)
    }
  })

  test('admins search, filter and page the inbox in the database', async () => {
    const id = await submit(people.otherPartner, { title: 'Wheelchair_option missing 100%', type: 'feature_request' })
    const { reference } = (await db.query<{ reference: number }>(`select reference from public.feedback_submissions where id = $1`, [id])).rows[0]!
    const list = (filters: object, limit = 20, offset = 0) =>
      as(db, people.admin, (tx) => one<{ r: { total: number; rows: { id: string; organization?: { name: string } }[] } }>(tx, `select public.admin_list_feedback($1, $2, $3) as r`, [filters, limit, offset])).then((x) => x.r)

    assert.deepEqual((await list({ search: `FB-${reference}` })).rows.map((r) => r.id), [id])
    assert.deepEqual((await list({ search: '_option missing 100%' })).rows.map((r) => r.id), [id]) // wildcards are literal
    assert.equal((await list({ search: 'wheelchair%option' })).total, 0)
    const byOrg = await list({ organizationId: orgs.b, type: 'feature_request' })
    assert.deepEqual(byOrg.rows.map((r) => [r.id, r.organization?.name]), [[id, 'Grace Mansion']])
    const all = await list({})
    const firstPage = await list({}, 2, 0)
    assert.equal(firstPage.rows.length, 2)
    assert.equal(firstPage.total, all.total)
    const summary = await as(db, people.admin, (tx) => one<{ s: { total: number; new: number } }>(tx, `select public.admin_feedback_summary() as s`))
    assert.equal(summary.s.total, all.total)
  })
})

describe('managing feedback', () => {
  test('status changes are recorded with who made them, and resolving sets the resolution time', async () => {
    const id = await submit(people.partner)
    await triage(people.admin, id, 'status', 'new', 'under_review')
    await triage(people.admin2, id, 'status', 'under_review', 'resolved')
    let row = (await db.query<{ status: string; resolved_at: string | null }>(`select status, resolved_at from public.feedback_submissions where id = $1`, [id])).rows[0]!
    assert.equal(row.status, 'resolved')
    assert.ok(row.resolved_at)
    await triage(people.admin, id, 'status', 'resolved', 'in_progress')
    row = (await db.query<{ status: string; resolved_at: string | null }>(`select status, resolved_at from public.feedback_submissions where id = $1`, [id])).rows[0]!
    assert.equal(row.resolved_at, null) // reopened

    const history = await db.query(`select previous_status, new_status, changed_by from public.feedback_status_history where feedback_id = $1 order by id`, [id])
    assert.deepEqual(history.rows, [
      { previous_status: null, new_status: 'new', changed_by: people.partner.profileId },
      { previous_status: 'new', new_status: 'under_review', changed_by: people.admin.profileId },
      { previous_status: 'under_review', new_status: 'resolved', changed_by: people.admin2.profileId },
      { previous_status: 'resolved', new_status: 'in_progress', changed_by: people.admin.profileId },
    ])
    // The submitter sees the history, without who changed it
    const seen = await as(db, people.partner, (tx) => rows(tx, `select previous_status, new_status from public.feedback_status_history where feedback_id = $1 order by id`, [id]))
    assert.equal(seen.length, 4)
    assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`select changed_by from public.feedback_status_history where feedback_id = $1`, [id]))), /permission denied/)
    assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`insert into public.feedback_status_history (feedback_id, new_status) values ($1, 'closed')`, [id]))), /permission denied/)
  })

  test('a stale screen cannot overwrite another admin’s newer decision', async () => {
    const id = await submit(people.partner)
    await triage(people.admin, id, 'status', 'new', 'planned')
    assert.match(await refusal(triage(people.admin2, id, 'status', 'new', 'closed')), /Another admin changed this feedback/)
    await triage(people.admin, id, 'priority', null, 'high')
    assert.match(await refusal(triage(people.admin2, id, 'priority', null, 'low')), /Another admin changed/)
    const row = (await db.query(`select status, priority from public.feedback_submissions where id = $1`, [id])).rows[0]
    assert.deepEqual(row, { status: 'planned', priority: 'high' })
  })

  test('feedback is only assigned to active platform admins', async () => {
    const id = await submit(people.partner)
    assert.match(await refusal(triage(people.admin, id, 'assigned_to', null, people.partner.profileId)), /only be assigned to a Relay Collective admin/)
    assert.match(await refusal(triage(people.admin, id, 'assigned_to', null, 'not-a-uuid')), /only be assigned/)
    await triage(people.admin, id, 'assigned_to', null, people.admin2.profileId)
    await triage(people.admin, id, 'assigned_to', people.admin2.profileId, null)
    const row = (await db.query(`select assigned_to from public.feedback_submissions where id = $1`, [id])).rows[0]
    assert.deepEqual(row, { assigned_to: null })
  })

  test('internal notes never reach the submitter; public replies do', async () => {
    const id = await submit(people.partner)
    await message(people.admin, id, 'Similar requests from two organizations.', 'internal')
    await message(people.admin, id, 'Thanks, we are looking into it.', 'public')
    const mine = await as(db, people.partner, (tx) => rows<{ message: string; visibility: string }>(tx, `select message, visibility from public.feedback_messages where feedback_id = $1`, [id]))
    assert.deepEqual(mine, [{ message: 'Thanks, we are looking into it.', visibility: 'public' }])
    const asked = await as(db, people.partner, (tx) => rows(tx, `select id from public.feedback_messages where visibility = 'internal'`))
    assert.deepEqual(asked, [])
    assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`select author_id from public.feedback_messages where feedback_id = $1`, [id]))), /permission denied/)
    assert.match(
      await refusal(as(db, people.partner, (tx) => tx.query(`insert into public.feedback_messages (feedback_id, author_id, message, visibility) values ($1, $2, 'x', 'internal')`, [id, people.admin.profileId]))),
      /permission denied/,
    )
    const forAdmin = await as(db, people.admin, (tx) => one<{ d: { messages: { visibility: string; authorName: string }[] } }>(tx, `select public.admin_get_feedback($1) as d`, [id]))
    assert.deepEqual(forAdmin.d.messages.map((m) => [m.visibility, m.authorName]), [['internal', 'admin'], ['public', 'admin']])
    assert.equal((await as(db, people.colleague, (tx) => rows(tx, `select id from public.feedback_messages where feedback_id = $1`, [id]))).length, 0)
  })
})

describe('screenshots', () => {
  async function grant(person: Actor, feedbackId: string, mime = 'image/png', size = 1000) {
    return as(db, person, (tx) =>
      one<{ g: { id: string; storagePath: string } }>(tx, `select public.begin_feedback_attachment($1, $2, $3, $4) as g`, [feedbackId, '../../etc/passwd\u0007.png', mime, size]),
    ).then((r) => r.g)
  }
  const upload = (person: Actor, name: string) =>
    as(db, person, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('feedback-attachments', $1)`, [name]))
  const readable = (person: Actor, name: string) =>
    as(db, person, (tx) => rows(tx, `select name from storage.objects where bucket_id = 'feedback-attachments' and name = $1`, [name]))

  test('the bucket is private and limited to small images', async () => {
    const { rows: [bucket] } = await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'feedback-attachments'`)
    assert.deepEqual(bucket, { public: false, file_size_limit: 5242880, allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'] })
  })

  test('only the submitter can upload, only to the path they were given, only once', async () => {
    const id = await submit(people.partner)
    assert.match(await refusal(grant(people.otherPartner, id)), /your own feedback/)
    assert.match(await refusal(grant(people.admin, id)), /your own feedback/)
    assert.match(await refusal(grant(people.partner, id, 'image/svg+xml')), /PNG, JPEG or WebP/)
    assert.match(await refusal(grant(people.partner, id, 'image/png', 5242881)), /5 MB/)

    const g = await grant(people.partner, id)
    assert.match(g.storagePath, new RegExp(`^${id}/[0-9a-f-]{36}\\.png$`))
    const { rows: [meta] } = await db.query<{ file_name: string }>(`select file_name from public.feedback_attachments where id = $1`, [g.id])
    assert.equal(meta!.file_name, 'passwd.png') // no folders or control characters from the browser

    assert.match(await refusal(upload(people.otherPartner, g.storagePath)), /row-level security/)
    assert.match(await refusal(upload(people.partner, `${id}/${crypto.randomUUID()}.png`)), /row-level security/)
    assert.match(await refusal(upload(people.partner, `${id}/../escape.png`)), /row-level security/)
    // Not confirmable before the file is there
    assert.match(await refusal(as(db, people.partner, (tx) => tx.query(`select public.confirm_feedback_attachment($1)`, [g.id]))), /hasn't finished uploading/)

    await upload(people.partner, g.storagePath)
    assert.match(await refusal(upload(people.partner, g.storagePath)), /duplicate key|row-level security/) // no overwriting
    // No update or delete policy: the file can't be replaced or removed from the browser
    for (const sql of [`update storage.objects set metadata = '{}' where name = $1`, `delete from storage.objects where name = $1`]) {
      const result = await as(db, people.partner, (tx) => tx.query(sql, [g.storagePath]))
      assert.equal(result.affectedRows, 0)
    }
    await as(db, people.partner, (tx) => tx.query(`select public.confirm_feedback_attachment($1)`, [g.id]))
    assert.match(await refusal(grant(people.partner, id)), /already has a screenshot/)
  })

  test('only the submitter and platform admins can read a screenshot', async () => {
    const id = await submit(people.partner)
    const g = await grant(people.partner, id)
    await upload(people.partner, g.storagePath)
    assert.equal((await readable(people.partner, g.storagePath)).length, 1)
    assert.equal((await readable(people.admin, g.storagePath)).length, 1)
    assert.equal((await readable(people.colleague, g.storagePath)).length, 0)
    assert.equal((await readable(people.otherPartner, g.storagePath)).length, 0)
    assert.equal((await readable(people.orgAdmin, g.storagePath)).length, 0)
    assert.equal((await as(db, people.colleague, (tx) => rows(tx, `select id from public.feedback_attachments where feedback_id = $1`, [id]))).length, 0)
    assert.match(await refusal(readable({}, g.storagePath)), /permission denied/)
  })
})

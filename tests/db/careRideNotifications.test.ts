import assert from 'node:assert/strict'
import { test } from 'node:test'
import { as, migratedDatabase, refusal } from './harness'

test('CareRide SQL delivers only eligible offers, protects each inbox, and honors opt-out', async () => {
  const db = await migratedDatabase()
  const partner = { authUserId: '10000000-0000-4000-8000-000000000001' }
  const driver = { authUserId: '10000000-0000-4000-8000-000000000002' }
  const other = { authUserId: '10000000-0000-4000-8000-000000000003' }
  const staff = { authUserId: '10000000-0000-4000-8000-000000000004' }
  const endpoint = 'https://web.push.apple.com/test-endpoint'
  const register = (url: string) =>
    as(db, driver, (tx) => tx.query('select public.careride_register_push($1,$2,$3)',
      [url, 'B' + 'a'.repeat(86), 'a'.repeat(22)]))
  try {
    await db.exec(`
      insert into auth.users (id, email)
      values ('${partner.authUserId}', 'partner@example.org'), ('${driver.authUserId}', 'driver@example.org'),
             ('${other.authUserId}', 'other@example.org'), ('${staff.authUserId}', 'staff@example.org');
      insert into public.organizations (id, name, type, contact_name, contact_phone, status)
      values ('20000000-0000-4000-8000-000000000001', 'Test House', 'PARTNER_ORG', 'Contact', '604-555-0100', 'APPROVED');
      insert into public.houses (id, org_id, name, address, city, phone)
      values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
              'Test House', '555 Homer St', 'Vancouver', '604-555-0101');
      insert into public.profiles (id, auth_user_id, name, role, org_id, house_id)
      values ('40000000-0000-4000-8000-000000000001', '${partner.authUserId}', 'Partner', 'PARTNER',
              '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
             ('40000000-0000-4000-8000-000000000002', '${driver.authUserId}', 'Driver', 'DRIVER', null, null),
             ('40000000-0000-4000-8000-000000000003', '${other.authUserId}', 'Other driver', 'DRIVER', null, null),
             ('40000000-0000-4000-8000-000000000004', '${staff.authUserId}', 'Staff', 'PARTNER',
              '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
      insert into public.drivers (id, profile_id, background, vehicle, seats, service_cities, request_hours, status)
      values ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
              'INDEPENDENT', 'Car', 3, '{Vancouver}', '${JSON.stringify(Array(7).fill({ from: '00:00', to: '23:59' }))}', 'APPROVED');
    `)
    assert.match(await refusal(register('http://127.0.0.1/test')), /supported push subscription/)
    await register(endpoint)
    const ownsDevice = (actor: typeof driver) => as(db, actor, (tx) =>
      tx.query<{ registered: boolean }>('select public.careride_has_push($1) as registered', [endpoint]))
    assert.equal((await ownsDevice(driver)).rows[0].registered, true)
    assert.equal((await ownsDevice(other)).rows[0].registered, false)
    assert.match(await refusal(as(db, driver, (tx) => tx.query('select * from private.careride_push_subscriptions'))), /permission denied/)
    assert.match(await refusal(as(db, driver, (tx) => tx.query('select * from public.careride_claim_push()'))), /permission denied/)

    const booking = await as(db, partner, (tx) => tx.query<{ id: string }>(
      'select (r).id from public.request_ride($1) r',
      [JSON.stringify({
        type: 'SCHEDULED', passengers: 1, riderNames: ['Private Passenger'],
        destinationName: 'Hospital', destinationAddress: '1081 Burrard St, Vancouver',
        pickupTime: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      })],
    ))
    const ride = booking.rows[0].id
    const inbox = (actor: typeof driver) => as(db, actor, (tx) => tx.query<{ id: string; kind: string; read_at: string | null }>(
      'select id, kind, read_at from public.careride_notifications where ride_id = $1 order by created_at', [ride],
    ))
    const offered = (await inbox(driver)).rows
    assert.deepEqual(offered.map((n) => n.kind), ['OFFER'])
    assert.deepEqual((await inbox(staff)).rows.map((n) => n.kind), ['REQUESTED'])
    assert.deepEqual((await inbox(other)).rows, [])
    assert.deepEqual((await inbox(partner)).rows, [])
    await as(db, other, (tx) => tx.query('select public.careride_mark_notifications_read($1)', [offered[0].id]))
    assert.equal((await inbox(driver)).rows[0].read_at, null)

    const claim = () => db.query<{ notification_id: string; subscription_id: string; lease: string }>('select * from public.careride_claim_push()')
    const first = (await claim()).rows
    assert.deepEqual(first.map((x) => x.notification_id), [offered[0].id])
    assert.deepEqual((await claim()).rows, [])
    await db.query('select public.careride_finish_push($1,$2,$3,$4)', [first[0].notification_id, first[0].subscription_id, first[0].lease, 'sent'])
    await as(db, driver, (tx) => tx.query('select public.careride_mark_notifications_read($1)', [offered[0].id]))
    assert.ok((await inbox(driver)).rows[0].read_at)

    const offer = (await db.query<{ id: string }>('select id from public.ride_offers where ride_id = $1', [ride])).rows[0]
    await as(db, driver, (tx) => tx.query('select public.respond_to_offer($1, true)', [offer.id]))
    assert.deepEqual((await inbox(partner)).rows.map((n) => n.kind), ['DRIVER_ACCEPTED'])

    await as(db, driver, (tx) => tx.query('select public.careride_save_notification_preferences(true, false)'))
    await as(db, partner, (tx) => tx.query('select public.cancel_ride($1, $2)', [ride, 'Test cancellation']))
    assert.deepEqual((await inbox(driver)).rows.map((n) => n.kind), ['OFFER', 'CANCELLED'])
    assert.deepEqual((await claim()).rows, [])
    await as(db, driver, (tx) => tx.query('select public.careride_remove_push()'))
    assert.equal((await ownsDevice(driver)).rows[0].registered, false)
  } finally {
    await db.close()
  }
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { dayLabel, greetingFor, startOfDay, timeAgo } from '../src/logic/formatTime'
import * as domain from '../src/modules/careride/domain'
import { careRidePaths, CARERIDE_PAGES, inCareRide } from '../src/modules/careride/paths'
import type { Ride } from '../src/types'
import { CARERIDE, SERVICE_MODULES } from '../src/workspace/modules'
import { WORKSPACE_NAV } from '../src/workspace/navigation'
import { paths } from '../src/workspace/paths'

// CareRide lives in src/modules/careride. These tests pin what must not change when its files move:
// the public URLs, the ride wording other workspaces show, and the direction of its dependencies.

const NOW = new Date('2026-10-20T12:00:00.000Z')
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()

function ride(extra: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    type: 'SCHEDULED',
    orgId: 'org-belkin',
    houseId: 'house-belkin',
    requestedBy: 'u-belkin',
    passengers: 1,
    pickupAddress: '555 Homer St, Vancouver',
    destinationName: "St. Paul's Hospital",
    destinationAddress: '1081 Burrard St, Vancouver',
    pickupTime: hoursFromNow(48),
    needsWheelchair: false,
    needsAssistance: false,
    status: 'OFFERED',
    estimatedFareSaved: 2.58,
    createdAt: hoursFromNow(-24),
    ...extra,
  }
}

// --- Routes ---------------------------------------------------------------------------------------

test('every published CareRide address is exactly what bookmarks and notifications already use', () => {
  assert.equal(paths.transport, '/workspace/transportation')
  assert.equal(paths.requests, '/workspace/requests')
  assert.equal(paths.newRide, '/workspace/transportation/new')
  assert.equal(paths.destinations, '/workspace/transportation/destinations')
  assert.equal(paths.ride('r1'), '/workspace/transportation/rides/r1')
  assert.equal(paths.editRide('r1'), '/workspace/transportation/new?edit=r1')
  assert.equal(paths.returnRide('r1'), '/workspace/transportation/new?returnOf=r1')
  assert.equal(paths.rideAgain('r1'), '/workspace/transportation/new?again=r1')
  assert.equal(paths.overview, '/workspace')
})

test('the workspace address book carries every CareRide address unchanged', () => {
  for (const [key, value] of Object.entries(careRidePaths)) {
    const shared = paths[key as keyof typeof paths]
    if (typeof value === 'function') assert.equal((shared as (id: string) => string)('x'), value('x'), key)
    else assert.equal(shared, value, key)
  }
  assert.deepEqual(CARERIDE_PAGES, [paths.transport, paths.requests])
  assert.equal(inCareRide(paths.ride('x')), true)
  assert.equal(inCareRide('/workspace/transportationx'), false)
})

test('App still mounts every CareRide route and the old /partner redirects, keeping query strings', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  for (const route of [
    '<Route element={<CareRideLayout />}>',
    '<Route path={paths.requests} element={<Requests />} />',
    '<Route path={paths.transport}>',
    '<Route index element={<Dashboard />} />',
    '<Route path="new" element={<RequestRide />} />',
    '<Route path="rides/:id" element={<RideDetail />} />',
    '<Route path="destinations" element={<Destinations />} />',
    '<Route path="/partner" element={<MovedTo to={paths.transport} />} />',
    '<Route path="/partner/request" element={<MovedTo to={paths.newRide} />} />',
    '<Route path="/partner/ride/:id" element={<MovedRide />} />',
    '<Route path="/partner/destinations" element={<MovedTo to={paths.destinations} />} />',
  ])
    assert.ok(app.includes(route), `missing: ${route}`)
  // MovedTo forwards ?edit=, ?returnOf= and the like
  assert.ok(app.includes('<Navigate to={`${to}${search}`} replace />'))
  // CareRide stays inside the partner workspace and its role guard
  const guard = app.indexOf("<RequireRole roles={['PARTNER']} />")
  const shell = app.indexOf('<Route element={<WorkspaceShell />}>')
  const layout = app.indexOf('<Route element={<CareRideLayout />}>')
  assert.ok(guard > 0 && guard < shell && shell < layout)
})

// --- Module registry ------------------------------------------------------------------------------

test('the registry still has one active module, CareRide, and its sidebar entry covers the requests list', () => {
  assert.deepEqual(
    SERVICE_MODULES.filter((m) => m.status === 'active').map((m) => m.id),
    ['careride'],
  )
  assert.ok(SERVICE_MODULES.filter((m) => m.id !== 'careride').every((m) => m.status === 'planned'))
  const entry = WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === CARERIDE.name)
  assert.equal(entry?.to, CARERIDE.route)
  assert.deepEqual(entry?.match, [paths.requests])
})

// --- Ride status presentation ---------------------------------------------------------------------

test('ride badges name transit fallbacks and expired requests; drivers see their trip step', () => {
  assert.equal(domain.rideBadgeLabel(ride({ status: 'CANCELLED', cancelReason: 'Sent on transit. Gave a Compass Ticket.' })), 'Sent on transit')
  assert.equal(domain.rideBadgeLabel(ride({ status: 'CANCELLED', cancelReason: 'Client cancelled' })), undefined)
  assert.equal(domain.rideBadgeLabel(ride({ status: 'NEEDS_ATTENTION', expired: true })), 'No driver found')
  assert.equal(domain.driverRideStatusLabel(ride({ status: 'ACCEPTED' })), 'Accepted')
  assert.equal(domain.driverRideStatusLabel(ride({ status: 'ACCEPTED', driverOnTheWayAt: hoursFromNow(-0.2) })), 'On your way')
  assert.equal(domain.driverRideStatusLabel(ride({ status: 'ACCEPTED', driverArrivedAt: hoursFromNow(-0.1) })), 'At pickup')
  assert.equal(domain.driverRideStatusLabel(ride({ status: 'PICKED_UP' })), 'Driving to drop-off')
  assert.equal(domain.driverRideStatusLabel(ride({ status: 'OFFERED' })), undefined)
  assert.equal(domain.passengersLabel(1), '1 passenger')
  assert.equal(domain.passengersLabel(3), '3 passengers')
  assert.equal(domain.riderLabel(ride({ riderNames: ['Sam Rivera', ' ', 'Alex', 'Jo'] })), 'Sam Rivera, Alex and Jo')
  assert.equal(domain.riderLabel(ride()), undefined)
})

test('a ride needs action when no driver was found, a driver dropped it, or the driver is late', () => {
  assert.equal(domain.needsAction(ride({ status: 'NEEDS_ATTENTION' }), NOW), true)
  assert.equal(domain.needsAction(ride({ status: 'SEARCHING', droppedBy: { driverId: 'd1', at: hoursFromNow(-1) } }), NOW), true)
  const late = ride({ status: 'ACCEPTED', driverId: 'd1', pickupTime: hoursFromNow(-0.5) })
  assert.equal(domain.isDriverLate(late, NOW), true)
  assert.equal(domain.needsAction(late, NOW), true)
  // On-demand rides have no set pickup time, so they're never late
  assert.equal(domain.isDriverLate({ ...late, type: 'ON_DEMAND' }, NOW), false)
  assert.equal(domain.needsAction(ride({ status: 'ACCEPTED', driverId: 'd1' }), NOW), false)
  assert.deepEqual(
    (['COMPLETED', 'NO_SHOW', 'CANCELLED', 'PICKED_UP', 'OFFERED'] as const).map((status) => domain.isFinished(ride({ status }))),
    [true, true, true, false, false],
  )
})

// --- Shared date wording (moved out of the ride logic, unchanged) ---------------------------------

test('day labels, greetings and "time ago" read the same as before', () => {
  const now = new Date(2026, 9, 20, 15, 0).getTime()
  assert.equal(dayLabel(now + 3600_000, now), 'Today')
  assert.equal(dayLabel(new Date(2026, 9, 21, 1, 0).getTime(), now), 'Tomorrow')
  assert.equal(dayLabel(new Date(2026, 9, 19, 23, 0).getTime(), now), 'Yesterday')
  assert.equal(startOfDay(now), new Date(2026, 9, 20).getTime())
  assert.deepEqual([greetingFor(8), greetingFor(12), greetingFor(18)], ['Good morning', 'Good afternoon', 'Good evening'])
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now)
  assert.equal(ago(30_000), 'just now')
  assert.equal(ago(5 * 60_000), '5 min ago')
  assert.equal(ago(3 * 3600_000), '3 h ago')
  assert.equal(ago(26 * 3600_000), 'yesterday')
  assert.equal(ago(3 * 24 * 3600_000), '3 days ago')
})

// --- Module boundary ------------------------------------------------------------------------------

const MODULE = path.resolve('src/modules/careride')
const PUBLIC = ['index.ts', 'domain.ts', 'paths.ts', 'brand.tsx'].map((f) => path.join(MODULE, f))

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8')
  return [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]/g)].map((m) => {
    const base = path.resolve(path.dirname(file), m[1])
    return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? base
  })
}

const SRC = sourceFiles(path.resolve('src'))
const inModule = (f: string) => f.startsWith(MODULE + path.sep)

test('outside the module, code uses only CareRide’s public files', () => {
  const leaks = SRC.filter((f) => !inModule(f)).flatMap((f) =>
    importsOf(f)
      .filter((t) => inModule(t) && !PUBLIC.includes(t))
      .map((t) => `${path.relative('.', f)} -> ${path.relative('.', t)}`),
  )
  assert.deepEqual(leaks, [])
})

test('CareRide depends on the platform and shared code, never on the volunteer or admin workspaces', () => {
  const forbidden = ['src/admin', 'src/volunteer', 'src/pages', 'src/components/admin', 'src/components/volunteer'].map(
    (d) => path.resolve(d) + path.sep,
  )
  const bad = SRC.filter(inModule).flatMap((f) =>
    importsOf(f)
      .filter((t) => forbidden.some((d) => t.startsWith(d)))
      .map((t) => `${path.relative('.', f)} -> ${path.relative('.', t)}`),
  )
  assert.deepEqual(bad, [])
})

test('the shared data layer, contexts and hooks never import a module', () => {
  const shared = ['src/services', 'src/context', 'src/hooks', 'src/types'].map((d) => path.resolve(d) + path.sep)
  const bad = SRC.filter((f) => shared.some((d) => f.startsWith(d))).flatMap((f) =>
    importsOf(f)
      .filter((t) => t.startsWith(path.resolve('src/modules') + path.sep))
      .map((t) => `${path.relative('.', f)} -> ${path.relative('.', t)}`),
  )
  assert.deepEqual(bad, [])
})

test('the registry and navigation reach CareRide only through its light public files, so there is no import cycle', () => {
  const index = path.join(MODULE, 'index.ts')
  for (const f of [
    'src/workspace/modules.ts',
    'src/workspace/navigation.ts',
    'src/workspace/paths.ts',
    'src/admin/navigation.ts',
    'src/volunteer/navigation.ts',
  ])
    assert.ok(!importsOf(path.resolve(f)).includes(index), f)
  // paths.ts and brand.tsx import nothing from the app, so anything may depend on them
  for (const f of [path.join(MODULE, 'paths.ts'), path.join(MODULE, 'brand.tsx')]) assert.deepEqual(importsOf(f), [], f)
  // Inside the module, nothing goes back through the public index
  assert.deepEqual(
    SRC.filter(inModule).filter((f) => importsOf(f).includes(index)),
    [],
  )
})

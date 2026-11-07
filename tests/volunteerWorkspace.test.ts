import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { DataService } from '../src/services/dataService'
import type { Database } from '../src/services/seed'
import type { Driver, User, VolunteerInterest } from '../src/types'

// The adaptive volunteer workspace: what each kind of volunteer is shown (src/volunteer/workspace.ts and
// navigation.ts), and that none of it hands out access. The route guards and the database decide that.

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

const { mockService, resetDemoData, STORAGE_KEY } = (await import('../src/services/mockService')) as {
  mockService: DataService
  resetDemoData: () => void
  STORAGE_KEY: string
}
const { DEMO_PASSWORD, VOLUNTEER_USER } = await import('../src/services/seed')
const { volunteerWorkspace, identityLabel, overviewDescription, interestStatus } = await import('../src/volunteer/workspace')
const { volunteerNav, volunteerTabs, volunteerTitle, isCareRidePath, CARERIDE_PATHS, VOLUNTEER_HELP_NAV, VOLUNTEER_FEEDBACK_NAV } = await import(
  '../src/volunteer/navigation'
)
const { volunteerPaths: paths } = await import('../src/volunteer/paths')
const { canDrive } = await import('../src/volunteer/participation')

const VOLUNTEER: Pick<User, 'role'> = { role: 'VOLUNTEER' }
const DRIVER: Pick<User, 'role'> = { role: 'DRIVER' }
const driverRow = (status: Driver['status'], overrides: Partial<Driver> = {}): Pick<Driver, 'status' | 'background' | 'orgId'> => ({
  status,
  background: 'INDEPENDENT',
  ...overrides,
})
const profile = (...interests: VolunteerInterest[]) => ({ interests })

const destinations = (groups: ReturnType<typeof volunteerNav>) => groups.flatMap((g) => g.items.map((i) => i.to))

function readDb(): Database {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Database
}

beforeEach(async () => {
  resetDemoData()
  await mockService.signOut()
})

describe('workspace presentation', () => {
  test('a general volunteer with several interests and no service', () => {
    const ws = volunteerWorkspace(VOLUNTEER, undefined, profile('TRANSPORTATION', 'COMMUNITY_OUTREACH', 'FOOD_DISTRIBUTION'))
    assert.deepEqual(ws, {
      experience: 'GENERAL_VOLUNTEER',
      hasVolunteerProfile: true,
      interests: ['TRANSPORTATION', 'COMMUNITY_OUTREACH', 'FOOD_DISTRIBUTION'],
      careRide: 'NOT_ENROLLED',
      driverKind: undefined,
      approvedToDrive: false,
    })
    assert.equal(identityLabel(ws), 'Volunteer')
    assert.match(overviewDescription(ws), /^Your willingness to help makes a difference/)
  })

  test('no interests and no volunteer profile are valid states, not errors', () => {
    const none = volunteerWorkspace(VOLUNTEER, undefined, profile())
    assert.equal(none.hasVolunteerProfile, true)
    assert.deepEqual(none.interests, [])
    const missing = volunteerWorkspace(VOLUNTEER, undefined, null)
    assert.equal(missing.hasVolunteerProfile, false)
    assert.deepEqual(missing.interests, [])
    assert.equal(volunteerWorkspace(VOLUNTEER, undefined, undefined).hasVolunteerProfile, false, 'still loading')
  })

  test('an approved driver keeps the CareRide experience', () => {
    const ws = volunteerWorkspace(DRIVER, driverRow('APPROVED'), profile('TRANSPORTATION'))
    assert.equal(ws.experience, 'CARERIDE_DRIVER')
    assert.equal(ws.careRide, 'APPROVED')
    assert.equal(ws.approvedToDrive, true)
    assert.equal(identityLabel(ws), 'Volunteer · CareRide')
    assert.equal(overviewDescription(ws), "Your time makes a difference. Here's what's happening in your workspace.")
  })

  test('a pending driver is in CareRide but not approved to drive', () => {
    const ws = volunteerWorkspace(DRIVER, driverRow('PENDING'), null)
    assert.equal(ws.experience, 'CARERIDE_DRIVER')
    assert.equal(ws.careRide, 'PENDING')
    assert.equal(ws.approvedToDrive, false)
  })

  test('a legacy driver without a volunteer profile still gets the driver workspace', () => {
    const ws = volunteerWorkspace(DRIVER, driverRow('APPROVED', { background: 'RIDESHARE' }), null)
    assert.equal(ws.experience, 'CARERIDE_DRIVER')
    assert.equal(ws.hasVolunteerProfile, false)
    assert.equal(ws.approvedToDrive, true)
    assert.equal(identityLabel(ws), 'Professional transportation provider')
  })

  test('professional and organization drivers keep their own words on the identity card', () => {
    assert.equal(
      identityLabel(volunteerWorkspace(DRIVER, driverRow('APPROVED', { background: 'TAXI' }), null)),
      'Professional transportation provider',
    )
    assert.equal(
      identityLabel(volunteerWorkspace(DRIVER, driverRow('APPROVED', { orgId: 'org-x', background: 'ORG_DRIVER' }), null)),
      'Organization-affiliated driver',
    )
    assert.equal(identityLabel(volunteerWorkspace(DRIVER, undefined, null)), 'Volunteer workspace', 'driver profile not loaded or missing')
  })

  test('interests never make anyone a driver, and a driver profile only counts on a DRIVER account', () => {
    const interested = volunteerWorkspace(VOLUNTEER, undefined, profile('TRANSPORTATION'))
    assert.equal(interested.approvedToDrive, false)
    assert.equal(interested.careRide, 'NOT_ENROLLED')
    const stray = volunteerWorkspace(VOLUNTEER, driverRow('APPROVED'), profile('TRANSPORTATION'))
    assert.equal(stray.experience, 'GENERAL_VOLUNTEER')
    assert.equal(stray.approvedToDrive, false)
    assert.equal(stray.careRide, 'NOT_ENROLLED')
    // Removing Transportation from a driver's interests changes nothing about driving
    const before = volunteerWorkspace(DRIVER, driverRow('APPROVED'), profile('TRANSPORTATION'))
    const after = volunteerWorkspace(DRIVER, driverRow('APPROVED'), profile('GENERAL'))
    assert.equal(after.approvedToDrive, before.approvedToDrive)
    assert.equal(after.careRide, before.careRide)
    assert.equal(canDrive(driverRow('APPROVED')), true, 'eligibility rule unchanged')
    assert.equal(canDrive(driverRow('PENDING')), false)
  })

  test('each interest says what it means for this person, from their actual enrollment', () => {
    const general = volunteerWorkspace(VOLUNTEER, undefined, profile('TRANSPORTATION', 'FOOD_DISTRIBUTION'))
    assert.match(interestStatus('TRANSPORTATION', general), /separate enrollment/)
    assert.match(interestStatus('TRANSPORTATION', general), /apply from your Overview/)
    assert.match(interestStatus('FOOD_DISTRIBUTION', general), /Not on Relay Collective yet/)
    assert.equal(interestStatus('TRANSPORTATION', volunteerWorkspace(DRIVER, driverRow('APPROVED'), null)), 'You drive with CareRide.')
    assert.match(interestStatus('TRANSPORTATION', volunteerWorkspace(DRIVER, driverRow('PENDING'), null)), /being reviewed/)
    assert.match(interestStatus('TRANSPORTATION', volunteerWorkspace(DRIVER, driverRow('REJECTED'), null)), /wasn’t approved/)
    assert.match(interestStatus('FOOD_DISTRIBUTION', volunteerWorkspace(DRIVER, driverRow('APPROVED'), null)), /Not on Relay Collective yet/)
  })
})

describe('navigation', () => {
  test('general volunteers get their own destinations and nothing from CareRide', () => {
    const ws = volunteerWorkspace(VOLUNTEER, undefined, profile('TRANSPORTATION', 'COMMUNITY_OUTREACH'))
    const groups = volunteerNav(ws)
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((i) => i.label)]),
      [
        ['Workspace', ['Overview', 'My interests']],
        ['Personal', ['My profile', 'Settings']],
      ],
    )
    assert.equal(destinations(groups).some(isCareRidePath), false)
    assert.equal(
      volunteerTabs(ws).some((t) => isCareRidePath(t.to)),
      false,
    )
    assert.deepEqual(
      volunteerTabs(ws).map((t) => t.label),
      ['Overview', 'Interests', 'Profile'],
    )
  })

  test('approved drivers keep their navigation, with interests added under Personal', () => {
    const groups = volunteerNav(volunteerWorkspace(DRIVER, driverRow('APPROVED'), null))
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((i) => i.label)]),
      [
        ['Workspace', ['Overview', 'Opportunities', 'My commitments']],
        ['Your modules', ['CareRide']],
        ['Personal', ['Availability', 'My interests', 'My profile', 'Settings']],
      ],
    )
    assert.deepEqual(
      volunteerTabs(volunteerWorkspace(DRIVER, driverRow('APPROVED'), null)).map((t) => t.label),
      ['Overview', 'Requests', 'Rides', 'Availability', 'Profile'],
    )
  })

  test('drivers in review don’t see requests or commitments, which only exist once approved', () => {
    const ws = volunteerWorkspace(DRIVER, driverRow('PENDING'), null)
    const to = destinations(volunteerNav(ws))
    assert.equal(to.includes(paths.opportunities), false)
    assert.equal(to.includes(paths.commitments), false)
    assert.ok(to.includes(paths.transport))
    assert.ok(to.includes(paths.availability))
    assert.equal(
      volunteerTabs(ws).some((t) => t.to === paths.opportunities),
      false,
    )
  })

  test('no section is empty, no destination repeats, and Overview is only active on its own page', () => {
    for (const ws of [
      volunteerWorkspace(VOLUNTEER, undefined, profile('GENERAL')),
      volunteerWorkspace(VOLUNTEER, undefined, null),
      volunteerWorkspace(DRIVER, driverRow('APPROVED'), null),
      volunteerWorkspace(DRIVER, driverRow('PENDING'), profile('TRANSPORTATION')),
    ]) {
      const groups = volunteerNav(ws)
      assert.ok(groups.every((g) => g.items.length > 0))
      const to = [...destinations(groups), VOLUNTEER_HELP_NAV.to, VOLUNTEER_FEEDBACK_NAV.to]
      assert.equal(new Set(to).size, to.length)
      assert.ok(to.every((p) => p.startsWith('/volunteer')))
      const overview = groups.flatMap((g) => g.items).find((i) => i.to === paths.overview)
      assert.equal(overview?.end, true)
    }
  })

  test('CareRide pages are recognised, and shared pages are not', () => {
    for (const p of [...CARERIDE_PATHS, paths.rides, paths.ride('r-1')]) assert.equal(isCareRidePath(p), true, p)
    for (const p of [paths.overview, paths.interests, paths.profile, paths.settings, paths.help, paths.feedback])
      assert.equal(isCareRidePath(p), false, p)
  })

  test('page titles in the header', () => {
    assert.equal(volunteerTitle(paths.interests), 'My interests')
    assert.equal(volunteerTitle(paths.verification), 'Driver verification')
    assert.equal(volunteerTitle(paths.profile), 'My profile')
    assert.equal(volunteerTitle(paths.ride('x')), 'My rides')
  })
})

describe('interests and driving stay separate (demo backend)', () => {
  test('a legacy driver adds interests; their role and driver profile are untouched', async () => {
    const frankBefore = readDb().drivers.find((d) => d.userId === 'u-frank')
    await mockService.signIn('frank@careride.demo', DEMO_PASSWORD)
    assert.equal(await mockService.getVolunteerProfile('u-frank'), undefined, 'drivers from before interests have none')
    const user = await mockService.registerVolunteer({ name: 'Frank', interests: ['FOOD_DISTRIBUTION'] })
    assert.equal(user.role, 'DRIVER')
    assert.deepEqual((await mockService.getVolunteerProfile('u-frank'))?.interests, ['FOOD_DISTRIBUTION'])
    assert.deepEqual(
      readDb().drivers.find((d) => d.userId === 'u-frank'),
      frankBefore,
    )
  })

  test('removing Transportation from a driver’s interests keeps their driver profile and rides', async () => {
    const before = structuredClone(readDb())
    await mockService.signIn('maya@careride.demo', DEMO_PASSWORD)
    assert.deepEqual((await mockService.getVolunteerProfile('u-olive'))?.interests, ['TRANSPORTATION', 'FOOD_DISTRIBUTION'])
    await mockService.updateMyVolunteerInterests(['FOOD_DISTRIBUTION'])
    const after = readDb()
    assert.deepEqual(
      after.drivers.find((d) => d.userId === 'u-olive'),
      before.drivers.find((d) => d.userId === 'u-olive'),
    )
    assert.deepEqual(after.rides, before.rides)
    assert.deepEqual(after.offers, before.offers)
    assert.equal(after.users.find((u) => u.id === 'u-olive')?.role, 'DRIVER')
  })

  test('a general volunteer interested in transportation gets no ride requests from the backend', async () => {
    await mockService.signIn('alex@careride.demo', DEMO_PASSWORD)
    const session = await mockService.restoreSession()
    assert.equal(session?.user?.role, 'VOLUNTEER')
    assert.deepEqual((await mockService.getVolunteerProfile('u-alex'))?.interests, ['TRANSPORTATION', 'COMMUNITY_OUTREACH'])
    assert.equal(
      readDb().drivers.some((d) => d.userId === 'u-alex'),
      false,
    )
  })

  test('the seed holds the volunteer states the workspace adapts to', () => {
    const db = readDb()
    const kinds = Object.fromEntries(
      db.users
        .filter((u) => u.role === 'VOLUNTEER' || u.role === 'DRIVER')
        .map((u) => [
          u.name,
          volunteerWorkspace(
            u,
            db.drivers.find((d) => d.userId === u.id),
            db.volunteerProfiles.find((p) => p.userId === u.id) ?? null,
          ),
        ]),
    )
    assert.equal(kinds.Priya.experience, 'GENERAL_VOLUNTEER')
    assert.equal(kinds['Alex Morgan'].interests.length, 2)
    assert.equal(kinds.Maya.hasVolunteerProfile, true)
    assert.equal(kinds.Frank.hasVolunteerProfile, false, 'a legacy driver')
    assert.equal(kinds.Jordan.careRide, 'PENDING')
  })

  test('a seeded volunteer deleted on purpose stays deleted when the demo data loads again', async () => {
    await mockService.signIn('admin@careride.com', 'abcd1234')
    await mockService.startAccountDeletion(VOLUNTEER_USER.id, { email: VOLUNTEER_USER.email!, password: 'abcd1234' })
    const users = await mockService.listUsers()
    assert.equal(
      users.some((u) => u.id === VOLUNTEER_USER.id),
      false,
    )
  })
})

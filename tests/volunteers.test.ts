import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { DataService } from '../src/services/dataService'
import type { Database } from '../src/services/seed'
import type { Driver, User } from '../src/types'

// General volunteers: identity, interests, and the boundary with CareRide driving, against the demo backend
// and the shared rules. The database enforces the same in 20261104120100_general_volunteers.sql (npm run test:db).

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
const interests = await import('../src/volunteer/interests')
const { canDrive, isGeneralVolunteer, participantKind, serviceRoles, PARTICIPANT_KIND_LABELS } = await import('../src/volunteer/participation')
const { HOME_FOR } = await import('../src/logic/homeFor')
const { homePath, onboardingPaths, pathForIntent } = await import('../src/onboarding/routing')
const { myFeedbackPaths } = await import('../src/feedback/paths')
const { workspaceFor } = await import('../src/feedback/rules')

function readDb(): Database {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Database
}

async function newIdentity(email: string, name = 'Ari Volunteer') {
  const result = await mockService.signUp({ name, email, password: 'a-long-test-password' })
  assert.equal(result.status, 'SIGNED_IN')
  return result.status === 'SIGNED_IN' ? result.identity : undefined!
}

const driverProfile = (overrides: Partial<Driver> = {}): Pick<Driver, 'background' | 'orgId' | 'status'> => ({
  background: 'INDEPENDENT',
  status: 'APPROVED',
  ...overrides,
})

beforeEach(async () => {
  resetDemoData()
  await mockService.signOut()
})

describe('volunteer identity', () => {
  const volunteer: Pick<User, 'role'> = { role: 'VOLUNTEER' }
  const driver: Pick<User, 'role'> = { role: 'DRIVER' }

  test('a general volunteer is classified as one, and never as a driver', () => {
    assert.equal(isGeneralVolunteer(volunteer), true)
    assert.equal(participantKind(volunteer, undefined), 'GENERAL_VOLUNTEER')
    // Even a stray driver row doesn't turn a VOLUNTEER account into a driver
    assert.equal(participantKind(volunteer, driverProfile()), 'GENERAL_VOLUNTEER')
    assert.deepEqual(serviceRoles(volunteer, driverProfile() as Driver), [])
    assert.equal(PARTICIPANT_KIND_LABELS.GENERAL_VOLUNTEER, 'General volunteer')
  })

  test('drivers keep their existing classification', () => {
    assert.equal(isGeneralVolunteer(driver), false)
    assert.equal(participantKind(driver, driverProfile()), 'VOLUNTEER_DRIVER')
    assert.equal(participantKind(driver, driverProfile({ background: 'TAXI' })), 'PROFESSIONAL_PROVIDER')
    assert.equal(participantKind(driver, driverProfile({ orgId: 'org-x' })), 'ORGANIZATION_DRIVER')
    assert.equal(participantKind(driver, undefined), undefined)
    assert.equal(participantKind({ role: 'PARTNER' }, undefined), undefined)
    assert.equal(participantKind({ role: 'PLATFORM_ADMIN' }, undefined), undefined)
  })

  test('general volunteers land in the volunteer workspace, not an onboarding or driver page', () => {
    assert.equal(HOME_FOR.VOLUNTEER, '/volunteer')
    assert.equal(homePath({ id: 'u', name: 'V', phone: '', role: 'VOLUNTEER' }, undefined), '/volunteer')
    assert.equal(HOME_FOR.DRIVER, '/volunteer', 'drivers still land where they did')
    assert.equal(pathForIntent('volunteer'), onboardingPaths.volunteer)
    assert.equal(pathForIntent('driver'), onboardingPaths.provider)
    assert.equal(myFeedbackPaths('VOLUNTEER').list, '/volunteer/feedback')
    assert.equal(workspaceFor('VOLUNTEER', '/volunteer/transportation'), 'volunteer')
    assert.equal(workspaceFor('DRIVER', '/volunteer/transportation'), 'driver')
  })
})

describe('volunteering interests', () => {
  test('every interest has words and only known codes are accepted', () => {
    assert.deepEqual(
      interests.VOLUNTEER_INTERESTS.map((d) => d.id),
      ['TRANSPORTATION', 'FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION', 'GENERAL'],
    )
    for (const d of interests.VOLUNTEER_INTERESTS) assert.ok(d.label && d.description && d.availability)
    assert.equal(interests.isVolunteerInterest('FOOD_DISTRIBUTION'), true)
    assert.equal(interests.isVolunteerInterest('food_distribution'), false)
    assert.equal(interests.isVolunteerInterest('DRIVER'), false)
    assert.equal(interests.isVolunteerInterest(undefined), false)
  })

  test('only CareRide transportation is described as running today', () => {
    assert.deepEqual(
      interests.VOLUNTEER_INTERESTS.filter((d) => d.operational).map((d) => d.id),
      ['TRANSPORTATION'],
    )
    assert.match(interests.interestDefinition('TRANSPORTATION').availability, /separate enrollment/)
  })

  test('validation: at least one, and nothing unknown', () => {
    assert.equal(interests.interestsError([]), interests.INTERESTS_REQUIRED)
    assert.equal(interests.interestsError(['GENERAL', 'ROCKETRY']), interests.INTEREST_UNKNOWN)
    assert.equal(interests.interestsError(['GENERAL']), undefined)
    assert.equal(interests.interestsError(['TRANSPORTATION', 'FOOD_DISTRIBUTION', 'GENERAL']), undefined)
  })

  test('several can be chosen, each once, in a stable order', () => {
    let chosen = interests.toggleInterest([], 'GENERAL')
    chosen = interests.toggleInterest(chosen, 'TRANSPORTATION')
    chosen = interests.toggleInterest(chosen, 'COMMUNITY_OUTREACH')
    assert.deepEqual(chosen, ['TRANSPORTATION', 'COMMUNITY_OUTREACH', 'GENERAL'])
    assert.deepEqual(interests.toggleInterest(chosen, 'TRANSPORTATION'), ['COMMUNITY_OUTREACH', 'GENERAL'])
    assert.deepEqual(interests.normalizeInterests(['GENERAL', 'GENERAL', 'nope', 'FOOD_DISTRIBUTION', 'GENERAL']), ['FOOD_DISTRIBUTION', 'GENERAL'])
    assert.equal(interests.sameInterests(['GENERAL', 'TRANSPORTATION'], ['TRANSPORTATION', 'GENERAL', 'GENERAL']), true)
    assert.equal(interests.sameInterests(['GENERAL'], ['GENERAL', 'TRANSPORTATION']), false)
  })
})

describe('registering and updating (demo backend)', () => {
  test('a new identity registers as a volunteer with several interests and no driver profile', async () => {
    const identity = await newIdentity('ari@example.org')
    const user = await mockService.registerVolunteer({ name: '  Ari Volunteer ', interests: ['GENERAL', 'TRANSPORTATION', 'GENERAL'] })
    assert.equal(user.role, 'VOLUNTEER')
    assert.equal(user.id, identity.id)
    assert.equal(user.name, 'Ari Volunteer')
    assert.equal(user.phone, '')
    assert.equal(user.orgId, undefined)
    const profile = await mockService.getVolunteerProfile(user.id)
    assert.deepEqual(profile?.interests, ['TRANSPORTATION', 'GENERAL'])
    assert.equal(
      readDb().drivers.some((d) => d.userId === user.id),
      false,
      'choosing Transportation creates no driver profile',
    )
    assert.deepEqual((await mockService.restoreSession())?.user?.role, 'VOLUNTEER')
  })

  test('registration is checked, and safe to repeat', async () => {
    await newIdentity('bo@example.org')
    await assert.rejects(mockService.registerVolunteer({ name: 'Bo', interests: [] }), /at least one/)
    await assert.rejects(mockService.registerVolunteer({ name: 'Bo', interests: ['GENERAL', 'X' as never] }), /isn’t one we offer/)
    await assert.rejects(mockService.registerVolunteer({ name: ' ', interests: ['GENERAL'] }), /name is required/)
    await assert.rejects(mockService.registerVolunteer({ name: 'Bo', phone: '12', interests: ['GENERAL'] }), /10-digit/)
    const first = await mockService.registerVolunteer({ name: 'Bo', phone: '604-555-0133', interests: ['FOOD_DISTRIBUTION'] })
    const again = await mockService.registerVolunteer({ name: 'Someone else', interests: ['GENERAL'] })
    assert.equal(again.id, first.id)
    assert.equal(readDb().volunteerProfiles.filter((p) => p.userId === first.id).length, 1)
    assert.deepEqual((await mockService.getVolunteerProfile(first.id))?.interests, ['FOOD_DISTRIBUTION'])
  })

  test('interests can be added and removed, and the change is kept', async () => {
    await mockService.signIn(VOLUNTEER_USER.email!, DEMO_PASSWORD)
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'])
    const updated = await mockService.updateMyVolunteerInterests(['COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION', 'RESOURCE_COORDINATION'])
    assert.deepEqual(updated.interests, ['COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION'])
    assert.ok(updated.updatedAt)
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, ['COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION'])
    await assert.rejects(mockService.updateMyVolunteerInterests([]), /at least one/)
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, ['COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION'])
  })

  test('only your own volunteer profile is readable (platform admins see any)', async () => {
    await mockService.signIn('frank@careride.demo', DEMO_PASSWORD)
    assert.equal(await mockService.getVolunteerProfile(VOLUNTEER_USER.id), undefined)
    await assert.rejects(mockService.updateMyVolunteerInterests(['GENERAL']), /Register as a volunteer first/)
    await mockService.signIn('admin@careride.com', 'abcd1234')
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'])
  })

  test('organization staff cannot also register as volunteers', async () => {
    await mockService.signIn('belkin@careride.demo', DEMO_PASSWORD)
    await assert.rejects(mockService.registerVolunteer({ name: 'Belkin', interests: ['GENERAL'] }), /already has a Relay Collective role/)
  })
})

describe('CareRide stays separate from interests', () => {
  test('a volunteer interested in transportation is not a driver and gets no ride requests', async () => {
    await newIdentity('cy@example.org')
    const user = await mockService.registerVolunteer({ name: 'Cy', interests: ['TRANSPORTATION'] })
    const driver = readDb().drivers.find((d) => d.userId === user.id)
    assert.equal(driver, undefined)
    assert.equal(canDrive(driver), false)
    assert.deepEqual(serviceRoles(user, driver), [])
    // and cannot then sign up as a driver on the same login (driver enrollment for volunteers is a later phase)
    await assert.rejects(
      mockService.registerDriverProfile(
        { name: 'Cy', phone: '604-555-0144' },
        {
          background: 'INDEPENDENT',
          vehicle: 'Car',
          wheelchairAccessible: false,
          seats: 3,
          serviceCities: ['Vancouver'],
          requestHours: [null, null, null, null, null, null, null],
        },
      ),
      /already has a Relay Collective role/,
    )
  })

  test('existing drivers keep their role, driver profile and approval', async () => {
    const before = readDb().drivers.map((d) => ({ id: d.id, userId: d.userId, status: d.status }))
    await mockService.signIn('frank@careride.demo', DEMO_PASSWORD)
    const session = await mockService.restoreSession()
    assert.equal(session?.user?.role, 'DRIVER')
    const frank = readDb().drivers.find((d) => d.userId === session!.user!.id)
    assert.equal(canDrive(frank), true)
    assert.equal(participantKind(session!.user, frank), 'PROFESSIONAL_PROVIDER')
    // A driver who also registers interests stays exactly the driver they were
    const same = await mockService.registerVolunteer({ name: 'ignored', interests: ['FOOD_DISTRIBUTION'] })
    assert.equal(same.role, 'DRIVER')
    await mockService.updateMyVolunteerInterests(['GENERAL'])
    assert.deepEqual(
      readDb().drivers.map((d) => ({ id: d.id, userId: d.userId, status: d.status })),
      before,
    )
  })

  test('the pending driver is still pending, whatever interests exist', () => {
    const jordan = readDb().drivers.find((d) => d.userId === 'u-jordan')
    assert.equal(jordan?.status, 'PENDING')
    assert.equal(canDrive(jordan), false)
  })
})

describe('closing and deleting a volunteer account (demo backend)', () => {
  test('a volunteer can close their own sign-in', async () => {
    await mockService.signIn(VOLUNTEER_USER.email!, DEMO_PASSWORD)
    await mockService.deleteMyAccount()
    await assert.rejects(mockService.signIn(VOLUNTEER_USER.email!, DEMO_PASSWORD))
    assert.equal(readDb().rides.filter((r) => r.status === 'CANCELLED').length, 0, 'nothing of anyone else’s is cancelled')
  })

  test('permanent deletion lists and removes the volunteer profile', async () => {
    await mockService.signIn('admin@careride.com', 'abcd1234')
    const preview = await mockService.previewAccountDeletion(VOLUNTEER_USER.id)
    assert.equal(preview.state, 'READY')
    assert.deepEqual(
      preview.categories.find((c) => c.key === 'volunteer_profile'),
      { key: 'volunteer_profile', action: 'delete', count: 1 },
    )
    const job = await mockService.startAccountDeletion(VOLUNTEER_USER.id, { email: VOLUNTEER_USER.email!, password: 'abcd1234' })
    assert.equal(job.status, 'completed')
    assert.equal(
      readDb().volunteerProfiles.some((p) => p.userId === VOLUNTEER_USER.id),
      false,
    )
    assert.equal(
      readDb().users.some((u) => u.id === VOLUNTEER_USER.id),
      false,
    )
  })
})

describe('demo data saved before volunteers existed', () => {
  test('gains the seeded volunteer and keeps everything else', async () => {
    const db = readDb() as Partial<Database>
    delete db.volunteerProfiles
    db.users = db.users!.filter((u) => u.id !== VOLUNTEER_USER.id)
    db.credentials = db.credentials!.filter((c) => c.userId !== VOLUNTEER_USER.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    const users = await mockService.listUsers()
    assert.ok(users.some((u) => u.id === VOLUNTEER_USER.id && u.role === 'VOLUNTEER'))
    assert.equal(users.filter((u) => u.role === 'DRIVER').length, 4)
    await mockService.signIn(VOLUNTEER_USER.email!, DEMO_PASSWORD)
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'])
  })
})

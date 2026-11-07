import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { CareRideApplication, DataService } from '../src/services/dataService'
import type { Database } from '../src/services/seed'
import type { Driver, User } from '../src/types'

// CareRide driver enrollment for existing general volunteers (Phase 3), against the demo backend and the shared
// rules. The database enforces the same in 20261105120000_careride_volunteer_enrollment.sql (npm run test:db).

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
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
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
const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD, VOLUNTEER_USER } = await import('../src/services/seed')
const { ALL_DAY } = await import('../src/logic/requestHours')
const enrollment = await import('../src/volunteer/enrollment')
const { canDrive, participantKind, serviceRoles, driverApplicationSource } = await import('../src/volunteer/participation')
const { volunteerWorkspace, interestStatus } = await import('../src/volunteer/workspace')
const { volunteerNav, volunteerTabs } = await import('../src/volunteer/navigation')
const { HOME_FOR } = await import('../src/logic/homeFor')
const drafts = await import('../src/onboarding/drafts')

function readDb(): Database {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Database
}

const ALWAYS = [ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY]

const application = (overrides: Partial<CareRideApplication> = {}): CareRideApplication => ({
  vehicle: 'Silver hatchback',
  seats: 3,
  wheelchairAccessible: false,
  serviceCities: ['Vancouver'],
  requestHours: ALWAYS,
  phone: '604-555-0177',
  ...overrides,
})

const signInAs = (email: string, password = DEMO_PASSWORD) => mockService.signIn(email, password)
const priyaDriver = () => readDb().drivers.find((d) => d.userId === VOLUNTEER_USER.id)
const priyaUser = () => readDb().users.find((u) => u.id === VOLUNTEER_USER.id)!
const priyaInterests = () => readDb().volunteerProfiles.find((p) => p.userId === VOLUNTEER_USER.id)?.interests

async function review(driverId: string, status: Driver['status']) {
  await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
  await mockService.setDriverStatus(driverId, status)
}

beforeEach(async () => {
  resetDemoData()
  await mockService.signOut()
  drafts.clearOnboardingDrafts()
})

describe('who may apply', () => {
  test('only an active general volunteer; interests play no part', () => {
    assert.equal(enrollment.canApplyToCareRide({ role: 'VOLUNTEER' }), true)
    for (const role of ['DRIVER', 'PARTNER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const) {
      assert.equal(enrollment.canApplyToCareRide({ role }), false, role)
    }
    assert.equal(enrollment.canApplyToCareRide(undefined), false)
  })

  test('the workspace shows where they stand, and a submitted application always wins over a stale draft', () => {
    const view = enrollment.careRideEnrollmentView
    assert.equal(view({ careRide: 'NOT_ENROLLED' }, false), 'NOT_ENROLLED')
    assert.equal(view({ careRide: 'NOT_ENROLLED' }, true), 'IN_PROGRESS')
    for (const status of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
      assert.equal(view({ careRide: status }, true), status)
      assert.equal(view({ careRide: status }, false), status)
    }
  })

  test('a phone is needed only when the account has none', () => {
    assert.equal(enrollment.needsPhone({ phone: '' }), true)
    assert.equal(enrollment.needsPhone({ phone: '  ' }), true)
    assert.equal(enrollment.needsPhone({ phone: '604-555-0100' }), false)
  })
})

describe('application rules (shared with driver onboarding)', () => {
  test('a complete application has no problems', () => {
    assert.deepEqual(enrollment.careRideApplicationErrors(application(), true), {})
    assert.deepEqual(enrollment.careRideApplicationErrors(application({ phone: undefined }), false), {})
  })

  test('vehicle information is checked', () => {
    assert.match(enrollment.careRideApplicationError(application({ vehicle: '  ' }), false)!, /Describe your vehicle/)
    assert.match(enrollment.careRideApplicationError(application({ vehicle: 'x'.repeat(200) }), false)!, /under 80 characters/)
    assert.match(enrollment.careRideApplicationError(application({ seats: 0 }), false)!, /how many passengers/)
    assert.match(enrollment.careRideApplicationError(application({ seats: 21 }), false)!, /how many passengers/)
    assert.match(enrollment.careRideApplicationError(application({ seats: 2.5 }), false)!, /how many passengers/)
  })

  test('the service area must be known cities, at least one', () => {
    assert.match(enrollment.careRideApplicationError(application({ serviceCities: [] }), false)!, /at least one city/)
    assert.match(enrollment.careRideApplicationError(application({ serviceCities: ['Vancouver', 'Atlantis'] }), false)!, /Choose Vancouver or Richmond/)
  })

  test('driving availability needs at least one valid day', () => {
    const none = [null, null, null, null, null, null, null]
    assert.match(enrollment.careRideApplicationError(application({ requestHours: none }), false)!, /at least one day/)
    const backwards = [{ from: '17:00', to: '09:00' }, null, null, null, null, null, null]
    assert.match(enrollment.careRideApplicationError(application({ requestHours: backwards }), false)!, /end time must be after/)
  })

  test('a missing phone is only a problem when the account has none', () => {
    assert.match(enrollment.careRideApplicationError(application({ phone: '123' }), true)!, /10-digit/)
    assert.equal(enrollment.careRideApplicationError(application({ phone: '123' }), false), undefined)
  })

  test('only what the backend reads is sent: never the acknowledgement or a background', () => {
    const sent = enrollment.toApplication({ ...enrollment.emptyCareRideDraft, ...application(), vehicle: '  Red van ', acknowledged: true }, false)
    assert.deepEqual(Object.keys(sent).sort(), ['requestHours', 'seats', 'serviceCities', 'vehicle', 'wheelchairAccessible'])
    assert.equal(sent.vehicle, 'Red van')
    assert.equal(enrollment.toApplication({ ...enrollment.emptyCareRideDraft, phone: ' 604-555-0100 ' }, true).phone, '604-555-0100')
  })
})

describe('applying (demo backend)', () => {
  test('a general volunteer applies on the same account: pending, never approved, nothing else changed', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const before = priyaUser()
    const interests = priyaInterests()
    const result = await mockService.applyToCareRide(application())
    assert.equal(result.created, true)
    assert.equal(result.status, 'PENDING')

    const after = priyaUser()
    assert.equal(after.id, before.id, 'the same account')
    assert.equal(after.email, before.email)
    assert.equal(after.name, before.name)
    assert.equal(after.role, 'DRIVER', 'now enrolled in CareRide')
    assert.equal(after.phone, '604-555-0177', 'the missing phone was added')
    assert.equal(readDb().users.filter((u) => u.email === before.email).length, 1, 'no second account')
    assert.equal(readDb().credentials.filter((c) => c.email === before.email).length, 1, 'no second login')
    assert.deepEqual(priyaInterests(), interests, 'interests untouched')

    const driver = priyaDriver()!
    assert.equal(driver.id, result.driverId)
    assert.equal(driver.status, 'PENDING')
    assert.equal(driver.background, 'INDEPENDENT')
    assert.equal(driver.appliedAsVolunteer, true)
    assert.equal(driverApplicationSource(driver), 'VOLUNTEER_WORKSPACE')
    assert.equal(canDrive(driver), false)
    assert.equal(participantKind(after, driver), 'VOLUNTEER_DRIVER')
    assert.deepEqual(serviceRoles(after, driver), [{ service: 'TRANSPORTATION', kind: 'VOLUNTEER_DRIVER', status: 'PENDING' }])
    assert.equal(HOME_FOR[after.role], HOME_FOR.VOLUNTEER, 'still lands in the same volunteer workspace')

    // The session carries straight on, as the same person, now with the driver role
    const session = await mockService.restoreSession()
    assert.equal(session?.user?.id, before.id)
    assert.equal(session?.user?.role, 'DRIVER')
  })

  test('a phone already on the account is kept, whatever is sent', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    // Give Priya a phone first, the way the team would
    const db = readDb()
    db.users.find((u) => u.id === VOLUNTEER_USER.id)!.phone = '604-555-0100'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    await mockService.applyToCareRide(application({ phone: '778-555-0199' }))
    assert.equal(priyaUser().phone, '604-555-0100')
  })

  test('invalid applications are refused and leave nothing behind', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    for (const bad of [
      application({ vehicle: '' }),
      application({ seats: 0 }),
      application({ serviceCities: [] }),
      application({ serviceCities: ['Seattle'] }),
      application({ requestHours: [null, null, null, null, null, null, null] }),
      application({ phone: '' }),
    ]) {
      await assert.rejects(mockService.applyToCareRide(bad))
    }
    assert.equal(priyaDriver(), undefined)
    assert.equal(priyaUser().role, 'VOLUNTEER')
  })

  test('repeating returns the same application, never a second driver profile', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const first = await mockService.applyToCareRide(application())
    const again = await mockService.applyToCareRide(application({ vehicle: 'Something else', seats: 7 }))
    assert.deepEqual(again, { driverId: first.driverId, status: 'PENDING', created: false })
    assert.equal(readDb().drivers.filter((d) => d.userId === VOLUNTEER_USER.id).length, 1)
    assert.equal(priyaDriver()!.vehicle, 'Silver hatchback', 'the first application stands')
    // Two at once from two tabs: still one
    const both = await Promise.all([mockService.applyToCareRide(application()), mockService.applyToCareRide(application())])
    assert.ok(both.every((r) => r.driverId === first.driverId && !r.created))
    assert.equal(readDb().drivers.filter((d) => d.userId === VOLUNTEER_USER.id).length, 1)
  })

  test('an existing driver gets their own application back, unchanged', async () => {
    await signInAs('frank@careride.demo')
    const before = readDb().drivers.find((d) => d.id === 'd-frank')
    const result = await mockService.applyToCareRide(application())
    assert.deepEqual(result, { driverId: 'd-frank', status: 'APPROVED', created: false })
    assert.deepEqual(
      readDb().drivers.find((d) => d.id === 'd-frank'),
      before,
    )
    await signInAs('jordan@careride.demo')
    assert.deepEqual(await mockService.applyToCareRide(application()), { driverId: 'd-jordan', status: 'PENDING', created: false })
  })

  test('nobody else can apply: signed out, organization staff, admins', async () => {
    await assert.rejects(mockService.applyToCareRide(application()), /volunteer first/)
    await signInAs('belkin@careride.demo')
    await assert.rejects(mockService.applyToCareRide(application()), /can’t apply/)
    await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
    await assert.rejects(mockService.applyToCareRide(application()), /can’t apply/)
    assert.equal(readDb().drivers.filter((d) => d.appliedAsVolunteer).length, 0)
  })

  test('an applicant can’t approve themselves; only a platform admin decides', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const { driverId } = await mockService.applyToCareRide(application())
    await assert.rejects(mockService.setDriverStatus(driverId, 'APPROVED'), /Only a CareRide admin/)
    await signInAs('maya@careride.demo')
    await assert.rejects(mockService.setDriverStatus(driverId, 'APPROVED'), /Only a CareRide admin/)
    assert.equal(priyaDriver()!.status, 'PENDING')
  })
})

describe('after applying: pending, approved, rejected', () => {
  async function bookRide() {
    await signInAs('belkin@careride.demo')
    return mockService.requestRide({
      type: 'ON_DEMAND',
      orgId: 'org-belkin',
      houseId: 'house-belkin',
      requestedBy: 'u-belkin',
      passengers: 1,
      riderNames: ['Sam'],
      pickupAddress: '555 Homer St, Vancouver',
      destinationName: "St. Paul's Hospital",
      destinationAddress: '1081 Burrard St, Vancouver',
      pickupTime: new Date().toISOString(),
      needsWheelchair: false,
      needsAssistance: false,
      estimatedFareSaved: 2.58,
    })
  }
  const offersFor = (driverId: string) => readDb().offers.filter((o) => o.driverId === driverId)

  test('pending: no ride requests, and an offer couldn’t be answered anyway', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const { driverId } = await mockService.applyToCareRide(application())
    const ride = await bookRide()
    assert.equal(offersFor(driverId).length, 0, 'not asked while pending')
    // Even an offer planted in the data is refused, as respond_to_offer() refuses it
    const db = readDb()
    db.offers.push({ id: 'offer-planted', rideId: ride.id, driverId, status: 'PENDING', sentAt: new Date().toISOString() } as Database['offers'][number])
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    await signInAs(VOLUNTEER_USER.email!)
    await assert.rejects(mockService.respondToOffer('offer-planted', true), /needs to be approved/)
    assert.notEqual((await mockService.getRide(ride.id))?.driverId, driverId)
  })

  test('approved: asked for rides, and keeps every interest and the same account', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const interests = priyaInterests()
    const { driverId } = await mockService.applyToCareRide(application())
    await review(driverId, 'APPROVED')
    assert.equal(canDrive(priyaDriver()), true)
    assert.deepEqual(priyaInterests(), interests)
    assert.equal(priyaUser().id, VOLUNTEER_USER.id)

    await bookRide()
    const offer = offersFor(driverId).find((o) => o.status === 'PENDING')
    assert.ok(offer, 'an approved volunteer driver is asked like any other')
    await signInAs(VOLUNTEER_USER.email!)
    const accepted = await mockService.respondToOffer(offer.id, true)
    assert.equal(accepted.driverId, driverId)

    // Interests stay theirs to change, and changing them leaves driving alone
    await mockService.updateMyVolunteerInterests(['GENERAL'])
    assert.equal(priyaDriver()!.status, 'APPROVED')
    await mockService.updateMyVolunteerInterests(interests!)
    assert.deepEqual(priyaInterests(), interests)
  })

  test('rejected: no rides, interests and the volunteer profile kept', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    const interests = priyaInterests()
    const { driverId } = await mockService.applyToCareRide(application())
    await review(driverId, 'REJECTED')
    await bookRide()
    assert.equal(offersFor(driverId).length, 0)
    assert.deepEqual(priyaInterests(), interests)
    await signInAs(VOLUNTEER_USER.email!)
    assert.deepEqual((await mockService.getVolunteerProfile(VOLUNTEER_USER.id))?.interests, interests)
    // A decision isn't reset by applying again
    assert.deepEqual(await mockService.applyToCareRide(application()), { driverId, status: 'REJECTED', created: false })
  })
})

describe('the workspace after enrollment', () => {
  const volunteer: Pick<User, 'role'> = { role: 'VOLUNTEER' }
  const driverAccount: Pick<User, 'role'> = { role: 'DRIVER' }
  const applied = (status: Driver['status']) => ({ status, background: 'INDEPENDENT' as const, appliedAsVolunteer: true })
  const profile = { interests: ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'] as const }

  test('before applying: the general volunteer workspace, no driving pages', () => {
    const ws = volunteerWorkspace(volunteer, undefined, { interests: [...profile.interests] })
    assert.equal(ws.experience, 'GENERAL_VOLUNTEER')
    assert.equal(ws.careRide, 'NOT_ENROLLED')
    const links = volunteerNav(ws).flatMap((g) => g.items.map((i) => i.label))
    assert.deepEqual(links, ['Overview', 'My interests', 'My profile', 'Settings'])
  })

  test('pending: the CareRide workspace in review, interests still there, no requests or commitments', () => {
    const ws = volunteerWorkspace(driverAccount, applied('PENDING'), { interests: [...profile.interests] })
    assert.equal(ws.experience, 'CARERIDE_DRIVER')
    assert.equal(ws.careRide, 'PENDING')
    assert.equal(ws.approvedToDrive, false)
    assert.deepEqual(ws.interests, profile.interests)
    const links = volunteerNav(ws).flatMap((g) => g.items.map((i) => i.label))
    assert.ok(!links.includes('Opportunities') && !links.includes('My commitments'))
    assert.ok(links.includes('My interests') && links.includes('My profile'))
    assert.ok(!volunteerTabs(ws).some((t) => t.label === 'Requests'))
  })

  test('approved: the full driving workspace, with general volunteering kept', () => {
    const ws = volunteerWorkspace(driverAccount, applied('APPROVED'), { interests: [...profile.interests] })
    assert.equal(ws.approvedToDrive, true)
    assert.equal(ws.driverKind, 'VOLUNTEER_DRIVER')
    const links = volunteerNav(ws).flatMap((g) => g.items.map((i) => i.label))
    for (const l of ['Overview', 'Opportunities', 'My commitments', 'CareRide', 'Availability', 'My interests', 'My profile', 'Settings']) {
      assert.ok(links.includes(l), l)
    }
    assert.ok(volunteerTabs(ws).some((t) => t.label === 'Requests'))
    // Transportation isn't needed to stay a driver; without it the interests just don't mention driving
    assert.ok(!ws.interests.includes('TRANSPORTATION'))
    assert.equal(interestStatus('TRANSPORTATION', ws), 'You drive with CareRide.')
  })

  test('rejected: no driving pages that act on rides', () => {
    const ws = volunteerWorkspace(driverAccount, applied('REJECTED'), { interests: [...profile.interests] })
    assert.equal(ws.approvedToDrive, false)
    const links = volunteerNav(ws).flatMap((g) => g.items.map((i) => i.label))
    assert.ok(!links.includes('Opportunities') && !links.includes('My commitments'))
    assert.ok(links.includes('My interests'))
  })
})

describe('application drafts', () => {
  test('are per identity, survive a reload, and can be cleared', () => {
    drafts.saveDraft('careride', 'u-a', { ...enrollment.emptyCareRideDraft, vehicle: 'Blue van' }, 'vehicle')
    assert.equal(drafts.hasDraft('careride', 'u-a'), true)
    assert.equal(drafts.hasDraft('careride', 'u-b'), false, 'another person on this device sees nothing')
    const back = drafts.loadDraft('careride', 'u-a', enrollment.emptyCareRideDraft)
    assert.equal(back.value.vehicle, 'Blue van')
    assert.equal(back.step, 'vehicle')
    drafts.clearDraft('careride', 'u-a')
    assert.equal(drafts.hasDraft('careride', 'u-a'), false)
  })

  test('sign-out clears them with every other onboarding draft', () => {
    drafts.saveDraft('careride', 'u-a', enrollment.emptyCareRideDraft, 'intro')
    drafts.clearOnboardingDrafts()
    assert.equal(drafts.hasDraft('careride', 'u-a'), false)
  })
})

describe('deleting an enrolled volunteer (demo backend)', () => {
  test('the deletion plan lists both the driver profile and the volunteer profile, and removes them', async () => {
    await signInAs(VOLUNTEER_USER.email!)
    await mockService.applyToCareRide(application())
    await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
    const preview = await mockService.previewAccountDeletion(VOLUNTEER_USER.id)
    assert.equal(preview.state, 'READY')
    const count = (key: string) => preview.categories.find((c) => c.key === key)?.count
    assert.equal(count('volunteer_profile'), 1)
    assert.equal(count('driver_profile'), 1)
    const job = await mockService.startAccountDeletion(VOLUNTEER_USER.id, { email: VOLUNTEER_USER.email!, password: ADMIN_PASSWORD })
    assert.equal(job.status, 'completed')
    assert.equal(readDb().volunteerProfiles.some((p) => p.userId === VOLUNTEER_USER.id), false)
    assert.equal(readDb().drivers.some((d) => d.userId === VOLUNTEER_USER.id && d.vehicle), false)
  })
})

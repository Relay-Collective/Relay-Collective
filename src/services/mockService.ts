import { MIN_PASSWORD_LENGTH } from '../constants'
import { DEMO_FRAME_USER } from '../context/demoFrame'
import { CAPACITY_LOCKED, maxPassengers } from '../logic/capacity'
import {
  NO_SHOW_NOT_HERE,
  NO_SHOW_TOO_SOON,
  UNDO_FINISH_MINUTES,
  canMarkNoShow,
  canWaitForDrivers,
  driversToAsk,
  editSendsRideAgain,
  isExpired,
  noDriverDeadline,
  offerExpiry,
  partnerCloseCancelsRide,
  pickupTimeAfterEdit,
} from '../logic/dispatch'
import { etaTimestamp } from '../logic/driverEta'
import { BLOCKER_MESSAGES, DELETED_NAME, emailMatches } from '../logic/accountDeletion'
import { faresSavedFor } from '../logic/estimateFare'
import {
  FEEDBACK_NOT_YET,
  ISSUE_REQUIRED,
  MAX_FEEDBACK_NOTE,
  NOTE_TOO_LONG,
  RATING_REQUIRED,
  canGiveFeedback,
} from '../logic/feedback'
import { rideEventsBetween, type RideEventDraft } from '../logic/rideEvents'
import { EMAIL, MAX_NAME, isPhone } from '../logic/validate'
import { MIN_SEARCH_LENGTH, optionalText, rankDirectory } from '../logic/membership'
import type {
  AccountDeletionAction,
  AccountDeletionBlocker,
  AccountDeletionCategory,
  AccountDeletionCategoryKey,
  AccountDeletionJob,
  AccountDeletionPreview,
  Driver,
  House,
  Identity,
  Invitation,
  InvitationState,
  JoinRequest,
  MyJoinRequest,
  OfferStatus,
  OrgRole,
  Organization,
  OrganizationMember,
  Ride,
  RideFeedback,
  RideStatus,
  User,
} from '../types'
import {
  ALL_RIDES_LIMIT,
  type DataService,
  type NewAccount,
  type NewDriver,
  type NewDriverUser,
  type RideChanges,
  type Session,
  MAX_DIRECTORY_DESCRIPTION,
  MAX_JOIN_MESSAGE,
  MAX_JOIN_POSITION,
  MAX_REVIEW_NOTE,
} from './dataService'
import { deleteDemoFile, getDemoFile, putDemoFile } from './demoFiles'
import * as feedbackStore from './mockFeedback'
import { backfilledEvents, seed, VOLUNTEER_PROFILE, VOLUNTEER_USER, demoPasswordFor, type Database, type StoredJoinRequest } from './seed'
import { interestsError, normalizeInterests } from '../volunteer/interests'

// Hackathon backend: keeps everything in the browser's localStorage.
// Swap this file for a real backend later; screens won't need to change.

// v5: houses and their organizations became single partner organizations.
// Older saves can't be mapped onto that, so they start again from the seed.
// v6: real house addresses and each house's frequent destinations.
// v7: each completed trip counts as a one-zone Vancouver bus fare.
// v8: the Relay Collective Admin signs in as admin@careride.com with its own password.
export const STORAGE_KEY = 'careride-db-v8'
const OLD_STORAGE_KEYS = ['careride-db-v7', 'careride-db-v6', 'careride-db-v5', 'careride-db-v4', 'careride-db-v3']

// Still waiting for a driver: these expire if nobody accepts in time
const WAITING: RideStatus[] = ['SEARCHING', 'OFFERED', 'NEEDS_ATTENTION']

function load(): Database {
  try {
    for (const key of OLD_STORAGE_KEYS) localStorage.removeItem(key)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return upgrade(JSON.parse(raw) as Database)
  } catch {
    // Storage unavailable or corrupt: fall back to seed data
  }
  return structuredClone(seed)
}

// Demo data saved before ride history and feedback existed keeps its rides and gains both.
function upgrade(db: Database): Database {
  db.events ??= backfilledEvents(db)
  db.feedback ??= []
  db.identities ??= []
  db.applications ??= []
  db.invitations ??= []
  db.productFeedback ??= feedbackStore.emptyFeedbackStore()
  db.joinRequests ??= []
  db.removals ??= []
  db.deletionJobs ??= []
  db.volunteerProfiles ??= []
  // Demo data saved before general volunteers existed gains the seeded volunteer, so it can be signed in to
  if (!db.users.some((u) => u.id === VOLUNTEER_USER.id) && !db.credentials.some((c) => c.email === VOLUNTEER_USER.email)) {
    db.users.push(structuredClone(VOLUNTEER_USER))
    db.credentials.push({ email: VOLUNTEER_USER.email!, userId: VOLUNTEER_USER.id, password: demoPasswordFor(VOLUNTEER_USER.email!) })
    db.volunteerProfiles.push(structuredClone(VOLUNTEER_PROFILE))
  }
  // Like the database migration: every existing member keeps managing their organization, and demo
  // partners stay findable in search as the fresh seed has them
  for (const user of db.users) if (user.role === 'PARTNER') user.orgRole ??= 'ADMIN'
  for (const org of db.organizations) {
    const seeded = seed.organizations.find((o) => o.id === org.id)
    org.discoverability ??= seeded?.discoverability ?? 'invitation_only'
    org.directoryDescription ??= seeded?.directoryDescription
  }
  return db
}

function save(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Storage unavailable: changes last only for this session
  }
}

// The demo session is saved in localStorage so people stay signed in when they come back
// to the site or reopen the phone app. Each tab also keeps its own copy in
// sessionStorage, which wins on reload, so two tabs signed in as different people
// (e.g. a house and a driver) don't swap accounts. A new tab picks up whoever
// signed in last. A /demo frame is always the person the deck asked for.
const SESSION_KEY = 'careride-session-v3'
const sessionListeners = new Set<() => void>()

function readSession(): string {
  if (DEMO_FRAME_USER) return DEMO_FRAME_USER
  try {
    const tabSession = sessionStorage.getItem(SESSION_KEY)
    if (tabSession) return tabSession
    const saved = localStorage.getItem(SESSION_KEY) ?? ''
    if (saved) sessionStorage.setItem(SESSION_KEY, saved)
    return saved
  } catch {
    return ''
  }
}

function writeSession(userId: string): void {
  if (DEMO_FRAME_USER) return
  try {
    if (userId) {
      sessionStorage.setItem(SESSION_KEY, userId)
      localStorage.setItem(SESSION_KEY, userId)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // Ignore: the session just won't survive a reload
  }
}

export function resetDemoData(): void {
  save(structuredClone(seed))
  // The signed-in account may not exist in the fresh data
  sessionListeners.forEach((listener) => listener())
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

// Each step of a ride can only follow the one before it, e.g. no pickup on a cancelled ride.
// Two tabs (or a slow refresh) can show a button for a step that no longer applies.
function requireStatus(ride: Ride, allowed: RideStatus[], message: string): void {
  if (!allowed.includes(ride.status)) throw new Error(message)
}

function cantChange(ride: Ride): string {
  switch (ride.status) {
    case 'CANCELLED':
      return 'This ride was cancelled.'
    case 'PICKED_UP':
      return 'The client is already in the car.'
    case 'COMPLETED':
    case 'NO_SHOW':
      return 'This ride is already finished.'
    default:
      return 'This ride has changed. Please check it again.'
  }
}

function findOrThrow<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((i) => i.id === id)
  if (!item) throw new Error(`${label} not found: ${id}`)
  return item
}

// Forgets where the driver was up to, e.g. when the ride goes back out to other drivers.
function clearDriverProgress(ride: Ride): void {
  ride.driverId = undefined
  ride.acceptedAt = undefined
  ride.driverOnTheWayAt = undefined
  ride.driverEta = undefined
  ride.driverArrivedAt = undefined
}

function checkPassengers(db: Database, passengers: number): void {
  const max = maxPassengers(db.drivers)
  if (!Number.isInteger(passengers) || passengers < 1) throw new Error('Add at least 1 passenger.')
  if (passengers > max) throw new Error(`A ride can take up to ${max} passengers. Book two rides for a bigger group.`)
}

function checkPickupTime(ride: Pick<Ride, 'type' | 'pickupTime'>): void {
  // On-demand rides are picked up as soon as possible, so their pickup time is the booking time.
  if (ride.type === 'SCHEDULED' && new Date(ride.pickupTime).getTime() <= Date.now()) {
    throw new Error('Pick a time in the future.')
  }
}

function cleanNames(names: string[] | undefined, passengers: number): string[] | undefined {
  const kept = (names ?? []).slice(0, passengers).map((n) => n.trim())
  return kept.some(Boolean) ? kept : undefined
}

function closePendingOffers(db: Database, rideId: string, status: OfferStatus = 'EXPIRED'): void {
  for (const o of db.offers) {
    if (o.rideId === rideId && o.status === 'PENDING') o.status = status
  }
}

function hasPendingOffers(db: Database, rideId: string): boolean {
  return db.offers.some((o) => o.rideId === rideId && o.status === 'PENDING')
}

// Drivers on their way to an on-demand pickup, or with a client in the car, can't take an on-demand ride right now.
// The outbound trip of a return doesn't count: that driver is the best one to bring the client back.
function busyDriverIds(db: Database, ride: Ride): string[] {
  if (ride.type !== 'ON_DEMAND') return []
  return db.rides
    .filter((r) => r.id !== ride.returnOfRideId)
    .filter((r) => r.driverId && (r.status === 'PICKED_UP' || (r.status === 'ACCEPTED' && r.type === 'ON_DEMAND')))
    .map((r) => r.driverId!)
}

// Sends the ride to every driver who can take it right now, or flags it for the house.
function dispatch(db: Database, ride: Ride): void {
  const house = db.houses.find((h) => h.id === ride.houseId)
  const drivers = driversToAsk(ride, house, db.drivers, db.offers, busyDriverIds(db, ride))
  if (drivers.length === 0) {
    if (hasPendingOffers(db, ride.id)) ride.status = 'OFFERED'
    else if (canWaitForDrivers(ride, house, db.drivers, db.offers)) ride.status = 'SEARCHING'
    else ride.status = 'NEEDS_ATTENTION'
    return
  }
  const sentAt = now()
  for (const driver of drivers) {
    db.offers.push({
      id: newId('offer'),
      rideId: ride.id,
      driverId: driver.id,
      status: 'PENDING',
      sentAt,
      expiresAt: offerExpiry(ride.type),
    })
  }
  ride.status = 'OFFERED'
}

// Moves a driver's open work to other drivers. Throws if a client is in the car.
function releaseDriverWork(db: Database, driverId: string): void {
  if (db.rides.some((r) => r.driverId === driverId && r.status === 'PICKED_UP')) {
    throw new Error('You have a client in the car right now. Finish that ride, then close your account.')
  }
  for (const offer of db.offers.filter((o) => o.driverId === driverId && o.status === 'PENDING')) {
    offer.status = 'EXPIRED'
    dispatchIfUnanswered(db, offer.rideId)
  }
  for (const ride of db.rides.filter((r) => r.driverId === driverId && r.status === 'ACCEPTED')) {
    clearDriverProgress(ride)
    dispatch(db, ride)
  }
}

// Once nobody is left to answer, asks the next drivers (if any).
function dispatchIfUnanswered(db: Database, rideId: string): void {
  const ride = db.rides.find((r) => r.id === rideId)
  if (ride?.status === 'OFFERED' && !hasPendingOffers(db, rideId)) dispatch(db, ride)
}

// Moves timed-out offers on, asks drivers whose request hours just opened,
// and cancels rides nobody accepted in time (see noDriverDeadline).
function checkDeadlines(db: Database): void {
  const expired = db.offers.filter((o) => isExpired(o))
  for (const offer of expired) offer.status = 'EXPIRED'
  for (const rideId of new Set(expired.map((o) => o.rideId))) dispatchIfUnanswered(db, rideId)
  const now = new Date()
  for (const ride of db.rides) {
    if (WAITING.includes(ride.status) && noDriverDeadline(ride) <= now) {
      closePendingOffers(db, ride.id)
      ride.status = 'CANCELLED'
      ride.expired = true
      ride.cancelledAt = now.toISOString()
      ride.cancelReason =
        ride.type === 'ON_DEMAND' ? 'No driver accepted in time.' : 'No driver accepted before the pickup time.'
    } else if (ride.status === 'SEARCHING') {
      dispatch(db, ride)
    }
  }
}

function signedInUser(db: Database): User | undefined {
  return db.users.find((u) => u.id === readSession())
}

// The signed-in identity and its profile. An identity id becomes the profile id when onboarding finishes.
function sessionFor(db: Database, id: string): Session | undefined {
  // Removed from their organization: the login carries on as an identity without a role, like a new sign-up
  const removal = db.removals.find((r) => r.userId === id)
  if (removal) return sessionFor(db, removal.identityId)
  const user = db.users.find((u) => u.id === id)
  if (user) return { identity: { id: user.id, email: user.email ?? '', name: user.name }, user }
  const identity = db.identities.find((i) => i.id === id)
  return identity && { identity }
}

// The signed-in identity that hasn't got a role yet. Onboarding turns it into a profile.
function identityToOnboard(db: Database): Identity {
  const id = readSession()
  if (!id) throw new Error('Please sign in first.')
  const identity = db.identities.find((i) => i.id === id)
  if (!identity) throw new Error('This account already has a Relay Collective role.')
  return identity
}

function finishOnboarding(db: Database, identity: Identity, user: User): User {
  db.identities = db.identities.filter((i) => i.id !== identity.id)
  db.users.push(user)
  // Joined some way: any request still waiting is no longer needed (approval marks its own one afterwards)
  for (const r of db.joinRequests) {
    if (r.userId === identity.id && r.status === 'pending') Object.assign(r, { status: 'cancelled', cancelledAt: now() })
  }
  return user
}

// ---- Permanent account deletion. Same rules and counts as the database functions
// (20261029150000_account_deletion.sql). Ride history here records names, not profile ids, so it's matched by both.

function requireDeletionAdmin(db: Database): User {
  const me = signedInUser(db)
  if (me?.role !== 'PLATFORM_ADMIN') throw new Error('Only Relay Collective admins can delete accounts.')
  return me
}

function checkAdminPassword(db: Database, admin: User, password: string): void {
  if (!password) throw new Error('Enter your password to confirm it’s you.')
  if (!db.credentials.some((c) => c.userId === admin.id && c.password === password)) throw new Error('That password isn’t right.')
}

function deletedProfile(db: Database, userId: string): AccountDeletionJob | undefined {
  return db.deletionJobs.find((j) => j.profileId === userId && j.status === 'completed')
}

const OPEN_RIDE: RideStatus[] = ['SEARCHING', 'OFFERED', 'ACCEPTED', 'NEEDS_ATTENTION', 'PICKED_UP']

function deletionPlan(db: Database, me: User, user: User) {
  const login = db.credentials.find((c) => c.userId === user.id)
  const driver = db.drivers.find((d) => d.userId === user.id)
  const store = db.productFeedback
  const submissions = store.submissions.filter((f) => f.submittedBy === user.id)
  const files = [
    ...store.attachments.filter((a) => a.uploadedAt && submissions.some((f) => f.id === a.feedbackId)).map((a) => a.storagePath),
  ]
  const removed = db.removals.some((r) => r.userId === user.id)
  const canSignIn = (u: User) => db.credentials.some((c) => c.userId === u.id) && !db.removals.some((r) => r.userId === u.id)
  const colleagues = db.users.filter((u) => u.id !== user.id && u.orgId === user.orgId && u.role === user.role && canSignIn(u))

  const blockers: AccountDeletionBlocker[] = []
  if (user.id === me.id) blockers.push('SELF')
  if (user.role === 'PLATFORM_ADMIN' && !db.users.some((u) => u.id !== user.id && u.role === 'PLATFORM_ADMIN' && canSignIn(u))) {
    blockers.push('LAST_PLATFORM_ADMIN')
  }
  if (user.role === 'PARTNER' && user.orgRole === 'ADMIN' && canSignIn(user) && colleagues.length && !colleagues.some((u) => u.orgRole === 'ADMIN')) {
    blockers.push('LAST_ORG_ADMIN')
  }
  if (user.role === 'PARTNER' && canSignIn(user) && !colleagues.length && db.rides.some((r) => r.orgId === user.orgId && OPEN_RIDE.includes(r.status))) {
    blockers.push('ORG_OPEN_RIDES')
  }
  if (user.role === 'ORG_ADMIN' && !colleagues.length && db.drivers.some((d) => d.orgId === user.orgId)) blockers.push('LAST_PROVIDER_ADMIN')
  if (driver && db.rides.some((r) => r.driverId === driver.id && r.status === 'PICKED_UP')) blockers.push('DRIVER_ON_TRIP')
  if (!login) blockers.push('NO_SIGN_IN_EMAIL')

  const n = (count: number | boolean) => Number(count)
  const counts: [AccountDeletionCategoryKey, AccountDeletionAction, number][] = [
    ['auth_account', 'delete', n(!!login)],
    ['profile', 'anonymize', 1],
    ['volunteer_profile', 'delete', n(db.volunteerProfiles.some((p) => p.userId === user.id))],
    ['organization_membership', 'remove', n((user.role === 'PARTNER' || user.role === 'ORG_ADMIN') && !!user.orgId && !removed)],
    ['driver_profile', 'delete', n(!!driver)],
    ['driver_documents', 'delete', n(!!driver?.licenceFile) + n(!!driver?.proofFile)],
    [
      'open_rides',
      'reassign',
      driver
        ? db.rides.filter(
            (r) =>
              (r.driverId === driver.id && r.status === 'ACCEPTED') ||
              db.offers.some((o) => o.rideId === r.id && o.driverId === driver.id && o.status === 'PENDING'),
          ).length
        : 0,
    ],
    ['product_feedback', 'delete', submissions.length],
    ['personal_files', 'delete', files.length],
    ['feedback_assignments', 'detach', store.submissions.filter((f) => f.assignedTo === user.id).length],
    ['feedback_replies', 'retain', store.messages.filter((m) => m.authorId === user.id && !submissions.some((f) => f.id === m.feedbackId)).length],
    ['join_requests', 'delete', db.joinRequests.filter((r) => r.userId === user.id).length],
    ['invitations', 'delete', db.invitations.filter((i) => login && i.email === normalizeEmail(login.email)).length],
    ['ride_issue_reports', 'delete', driver ? db.feedback.filter((f) => f.authorRole === 'DRIVER' && f.driverId === driver.id).length : 0],
    ['rides_requested', 'retain', db.rides.filter((r) => r.requestedBy === user.id).length],
    ['rides_driven', 'retain', driver ? db.rides.filter((r) => r.driverId === driver.id && ['PICKED_UP', 'COMPLETED', 'NO_SHOW'].includes(r.status)).length : 0],
    ['ride_ratings', 'retain', 0], // the demo doesn't record which staff member rated a ride
    ['ride_history', 'anonymize', db.events.filter((e) => e.actorRole === user.role && e.actorName === user.name).length],
    ['organization_applications', 'retain', db.applications.filter((a) => a.submittedBy === user.id).length],
    ['preferences', 'none', 0],
    ['deletion_record', 'retain', 1],
  ]
  const categories: AccountDeletionCategory[] = counts.map(([key, action, count]) => ({ key, action, count }))
  return { blockers, categories, files }
}

function deletionPreview(db: Database, me: User, userId: string): AccountDeletionPreview {
  const done = deletedProfile(db, userId)
  const user = db.users.find((u) => u.id === userId)
  if (done) return { state: 'DELETED', profileId: userId, role: user?.role ?? 'PARTNER', blockers: [], categories: [], job: done }
  if (!user) throw new Error('Account not found. It may already have been deleted.')
  const plan = deletionPlan(db, me, user)
  return {
    state: plan.blockers.length ? 'BLOCKED' : 'READY',
    profileId: user.id,
    name: user.name,
    email: db.credentials.find((c) => c.userId === user.id)?.email,
    role: user.role,
    orgName: db.organizations.find((o) => o.id === user.orgId)?.name,
    blockers: plan.blockers,
    categories: plan.categories,
  }
}

// Everything about the person goes or loses its name. Their profile stays as a placeholder while rides,
// invitations or replies point at it, like the database's.
function eraseAccount(db: Database, user: User): void {
  const login = db.credentials.find((c) => c.userId === user.id)
  const driver = db.drivers.find((d) => d.userId === user.id)
  if (driver) {
    releaseDriverWork(db, driver.id)
    for (const ride of db.rides) {
      if (['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(ride.status)) continue
      if (ride.preferredDriverId === driver.id) ride.preferredDriverId = undefined
      if (ride.reconfirmDriverId === driver.id) ride.reconfirmDriverId = undefined
    }
    db.feedback = db.feedback.filter((f) => !(f.authorRole === 'DRIVER' && f.driverId === driver.id))
    db.drivers = db.drivers.filter((d) => d.id !== driver.id)
  }

  db.volunteerProfiles = db.volunteerProfiles.filter((p) => p.userId !== user.id)

  const store = db.productFeedback
  const theirs = new Set(store.submissions.filter((f) => f.submittedBy === user.id).map((f) => f.id))
  store.submissions = store.submissions.filter((f) => !theirs.has(f.id))
  store.messages = store.messages.filter((m) => !theirs.has(m.feedbackId))
  store.attachments = store.attachments.filter((a) => !theirs.has(a.feedbackId))
  store.history = store.history.filter((h) => !theirs.has(h.feedbackId))
  for (const f of store.submissions) if (f.assignedTo === user.id) f.assignedTo = undefined

  for (const e of db.events) if (e.actorRole === user.role && e.actorName === user.name) e.actorName = DELETED_NAME
  db.joinRequests = db.joinRequests.filter((r) => r.userId !== user.id)
  if (login) db.invitations = db.invitations.filter((i) => i.email !== normalizeEmail(login.email))
  db.credentials = db.credentials.filter((c) => c.userId !== user.id)
  db.identities = db.identities.filter((i) => i.id !== user.id)

  const pointedAt =
    db.rides.some((r) => r.requestedBy === user.id) ||
    db.invitations.some((i) => i.invitedBy === user.id) ||
    db.applications.some((a) => a.submittedBy === user.id) ||
    store.messages.some((m) => m.authorId === user.id) ||
    db.removals.some((r) => r.userId === user.id || r.by === user.id)
  if (pointedAt) Object.assign(user, { name: DELETED_NAME, email: undefined, phone: '' })
  else db.users = db.users.filter((u) => u.id !== user.id)
}

// ---- Organization membership. Same rules as the database functions (20261029120000_organization_membership.sql).

const MAX_REQUESTS_PER_DAY = 5

function isActiveMember(db: Database, u: User): boolean {
  return u.role === 'PARTNER' && !db.removals.some((r) => r.userId === u.id) && db.credentials.some((c) => c.userId === u.id)
}

// The signed-in administrator's organization, or a refusal in their words
function adminOrgId(db: Database, action: string): string {
  const user = signedInUser(db)
  if (!user || !isActiveMember(db, user) || user.orgRole !== 'ADMIN' || !user.orgId) {
    throw new Error(`Only your organization's administrators can ${action}.`)
  }
  return user.orgId
}

function discoverable(db: Database, org: Organization): boolean {
  return org.status === 'APPROVED' && org.type === 'PARTNER_ORG' && org.discoverability === 'discoverable' && db.houses.some((h) => h.orgId === org.id)
}

// An organization with active members always keeps an active administrator
function keepAnAdmin(db: Database, leaving: User): void {
  if (leaving.orgRole !== 'ADMIN') return
  const others = db.users.filter((u) => u.id !== leaving.id && u.orgId === leaving.orgId && isActiveMember(db, u))
  if (others.length && !others.some((u) => u.orgRole === 'ADMIN')) {
    throw new Error('Your organization needs at least one administrator. Make another member an administrator first.')
  }
}

function applicantOf(db: Database, userId: string): Identity | undefined {
  const user = db.users.find((u) => u.id === userId)
  return db.identities.find((i) => i.id === userId) ?? (user && { id: user.id, email: user.email ?? '', name: user.name })
}

function toMyJoinRequest(db: Database, r: StoredJoinRequest): MyJoinRequest {
  return {
    id: r.id,
    orgId: r.orgId,
    orgName: db.organizations.find((o) => o.id === r.orgId)?.name ?? 'Organization',
    orgCity: db.houses.find((h) => h.orgId === r.orgId)?.city,
    status: r.status,
    requestedPosition: r.requestedPosition,
    message: r.message,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    cancelledAt: r.cancelledAt,
  }
}

function findJoinRequest(db: Database, requestId: string, orgId: string): StoredJoinRequest {
  const request = db.joinRequests.find((r) => r.id === requestId && r.orgId === orgId)
  if (!request) throw new Error("This request wasn't found.")
  return request
}

function activeMemberOf(db: Database, profileId: string, orgId: string): User {
  const member = db.users.find((u) => u.id === profileId && u.orgId === orgId && isActiveMember(db, u))
  if (!member) throw new Error("This person isn't an active member of your organization.")
  return member
}

function withoutToken({ token, ...invitation }: Invitation & { token: string }): Invitation {
  void token
  return invitation
}

const INVITATION_DAYS = 7
const MAX_OPEN_INVITATIONS = 25

function invitationState(db: Database, inv: Invitation, identity: Identity | undefined): InvitationState {
  if (inv.revokedAt) return 'REVOKED'
  if (inv.acceptedAt) return 'USED'
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return 'EXPIRED'
  if (!identity || inv.email !== normalizeEmail(identity.email)) return 'WRONG_ACCOUNT'
  if (db.users.some((u) => u.id === identity.id)) return 'HAS_ACCOUNT'
  if (db.organizations.find((o) => o.id === inv.orgId)?.status !== 'APPROVED') return 'UNAVAILABLE'
  return 'VALID'
}

// Adds one line to a ride's history. No actor means Relay Collective made the change on its own.
function logEvent(db: Database, rideId: string, actor: User | undefined, { kind, detail }: RideEventDraft): void {
  db.events.push({ id: newId('event'), rideId, kind, at: now(), actorRole: actor?.role, actorName: actor?.name, detail })
}

// Runs a change and writes what it did to each ride's history, the way the database trigger does.
function logChanges<T>(db: Database, actor: User | undefined, change: () => T): T {
  const before = new Map(db.rides.map((r) => [r.id, structuredClone(r)]))
  const result = change()
  for (const ride of db.rides) {
    for (const event of rideEventsBetween(before.get(ride.id), ride)) logEvent(db, ride.id, actor, event)
  }
  return result
}

// Runs a change against the database and saves it.
// Nothing is saved if the change throws.
function transact<T>(fn: (db: Database) => T): Promise<T> {
  try {
    const db = load()
    logChanges(db, undefined, () => checkDeadlines(db))
    const result = logChanges(db, signedInUser(db), () => fn(db))
    save(db)
    return Promise.resolve(result)
  } catch (err) {
    return Promise.reject(err)
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function addLogin(db: Database, userId: string, email: string, password: string): void {
  const normalized = normalizeEmail(email)
  if (db.credentials.some((c) => c.email === normalized)) {
    throw new Error('An account with this email already exists.')
  }
  db.credentials.push({ email: normalized, userId, password })
}

// Readable temporary password, e.g. "ride-4821".
function tempPassword(): string {
  return `ride-${Math.floor(1000 + Math.random() * 9000)}`
}

function addDriver(
  db: Database,
  newUser: NewDriverUser,
  driver: NewDriver,
  login?: Pick<NewAccount, 'email' | 'password'>,
): { driver: Driver; user: User } {
  const user: User = {
    ...newUser,
    id: newId('u'),
    email: login ? normalizeEmail(login.email) : undefined,
    role: 'DRIVER',
    orgId: driver.orgId,
  }
  if (login) addLogin(db, user.id, login.email, login.password)
  const created: Driver = { ...driver, id: newId('d'), userId: user.id, status: 'PENDING', createdAt: now() }
  db.users.push(user)
  db.drivers.push(created)
  return { driver: created, user }
}

function driverIdsForOrg(db: Database, orgId: string): string[] {
  return db.drivers.filter((d) => d.orgId === orgId).map((d) => d.id)
}

export const mockService: DataService = {
  restoreSession: () =>
    transact((db) => {
      const id = readSession()
      const session = id ? sessionFor(db, id) : undefined
      if (id && !session) writeSession('') // account was removed or the demo was reset
      // Removed from their organization: carry on as the identity their login moved to
      if (session && session.identity.id !== id) writeSession(session.identity.id)
      return session
    }),

  signIn: (email, password) =>
    transact((db) => {
      const login = db.credentials.find((c) => c.email === normalizeEmail(email))
      const session = login && login.password === password ? sessionFor(db, login.userId) : undefined
      if (!session) throw new Error("That email and password don't match. Please try again.")
      writeSession(session.identity.id)
      return session
    }),

  signOut: () => {
    writeSession('')
    return Promise.resolve()
  },

  onSessionChange: (listener) => {
    sessionListeners.add(listener)
    return () => sessionListeners.delete(listener)
  },

  // Tabs share localStorage, so the app's storage listener and polling already cover this.
  onDataChange: () => () => {},

  // The demo can't send email; the sign-in page tells people to ask their admin instead.
  requestPasswordReset: () => Promise.reject(new Error("Ask your organization's admin to reset your password.")),

  updatePassword: (newPassword) =>
    transact((db) => {
      if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      const login = db.credentials.find((c) => c.userId === readSession())
      if (!login) throw new Error('Please sign in first.')
      login.password = newPassword
    }),

  signUp: (account) =>
    transact((db) => {
      const email = normalizeEmail(account.email)
      if (!EMAIL.test(email)) throw new Error('Enter a valid email address.')
      if (account.password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      if (db.credentials.some((c) => c.email === email)) {
        throw new Error("We couldn't create an account with that email. If you've signed up before, sign in instead.")
      }
      // The demo can't send email, so new identities are signed in straight away
      const identity: Identity = { id: newId('u'), email, name: account.name.trim() }
      db.identities.push(identity)
      addLogin(db, identity.id, email, account.password)
      writeSession(identity.id)
      return { status: 'SIGNED_IN' as const, identity }
    }),

  resendVerification: () => Promise.resolve(),

  submitOrganizationApplication: (app) =>
    transact((db) => {
      const id = readSession()
      const existing = db.users.find((u) => u.id === id)
      // A retry after the first call went through returns the same account, never a second organization
      if (existing?.role === 'PARTNER' && db.applications.some((a) => a.submittedBy === existing.id)) return existing
      const identity = identityToOnboard(db)
      if (!app.serviceCategories.length) throw new Error('Choose at least one kind of work your organization does.')
      const org: Organization = {
        id: newId('org'),
        name: app.orgName.trim(),
        type: 'PARTNER_ORG',
        contactName: app.contactName.trim(),
        contactPhone: app.contactPhone.trim(),
        status: 'PENDING',
        createdAt: now(),
      }
      const house: House = { id: newId('house'), orgId: org.id, name: org.name, address: app.address.trim(), city: app.city, phone: org.contactPhone }
      db.organizations.push(org)
      db.houses.push(house)
      db.applications.push({
        orgId: org.id,
        kind: app.kind,
        website: app.website?.trim() || undefined,
        description: app.description.trim(),
        contactEmail: normalizeEmail(app.contactEmail),
        contactRole: app.contactRole.trim(),
        serviceCategories: [...new Set(app.serviceCategories)],
        platformInterests: [...new Set(app.platformInterests)],
        submittedBy: identity.id,
        submittedAt: now(),
      })
      return finishOnboarding(db, identity, {
        id: identity.id,
        name: identity.name,
        email: identity.email,
        phone: org.contactPhone,
        role: 'PARTNER',
        orgId: org.id,
        houseId: house.id,
        orgRole: 'ADMIN',
      })
    }),

  registerDriverProfile: (newUser, driver) =>
    transact((db) => {
      const existing = db.users.find((u) => u.id === readSession())
      if (existing?.role === 'DRIVER') return existing
      const identity = identityToOnboard(db)
      const user: User = { ...newUser, id: identity.id, email: identity.email, role: 'DRIVER' }
      db.drivers.push({ ...driver, orgId: undefined, id: newId('d'), userId: user.id, status: 'PENDING', createdAt: now() })
      return finishOnboarding(db, identity, user)
    }),

  // Same rules as register_volunteer() (20261104120100_general_volunteers.sql). Never adds a driver profile.
  registerVolunteer: (volunteer) =>
    transact((db) => {
      const existing = signedInUser(db)
      if (existing?.role === 'VOLUNTEER') return existing
      if (existing && existing.role !== 'DRIVER') {
        throw new Error('This account already has a Relay Collective role, so it can’t also register as a volunteer.')
      }
      const problem = interestsError(volunteer.interests)
      if (problem) throw new Error(problem)
      const interests = normalizeInterests(volunteer.interests)
      // A driver who also volunteers keeps their role and driver profile
      if (existing) {
        if (!db.volunteerProfiles.some((p) => p.userId === existing.id)) {
          db.volunteerProfiles.push({ id: newId('vp'), userId: existing.id, interests, createdAt: now() })
        }
        return existing
      }
      const identity = identityToOnboard(db)
      const name = volunteer.name.trim()
      const phone = volunteer.phone?.trim() ?? ''
      if (!name) throw new Error('Your name is required.')
      if (name.length > MAX_NAME) throw new Error('Your name is too long.')
      if (phone && !isPhone(phone)) throw new Error('Please enter a 10-digit phone number.')
      db.volunteerProfiles.push({ id: newId('vp'), userId: identity.id, interests, createdAt: now() })
      return finishOnboarding(db, identity, { id: identity.id, name, email: identity.email, phone, role: 'VOLUNTEER' })
    }),

  getVolunteerProfile: (userId) =>
    transact((db) => {
      const me = signedInUser(db)
      if (!me || (me.id !== userId && me.role !== 'PLATFORM_ADMIN')) return undefined
      return db.volunteerProfiles.find((p) => p.userId === userId)
    }),

  updateMyVolunteerInterests: (interests) =>
    transact((db) => {
      const me = signedInUser(db)
      const profile = me && db.volunteerProfiles.find((p) => p.userId === me.id)
      if (!profile) throw new Error('Register as a volunteer first.')
      const problem = interestsError(interests)
      if (problem) throw new Error(problem)
      profile.interests = normalizeInterests(interests)
      profile.updatedAt = now()
      return { ...profile, interests: [...profile.interests] }
    }),

  getOrganizationApplication: (orgId) =>
    transact((db) => {
      const user = signedInUser(db)
      if (user?.role !== 'PLATFORM_ADMIN' && user?.orgId !== orgId) return undefined
      return db.applications.find((a) => a.orgId === orgId)
    }),

  createInvitation: (email) =>
    transact((db) => {
      const user = signedInUser(db)
      const org = db.organizations.find((o) => o.id === adminOrgId(db, 'invite colleagues'))
      if (!user || !org) throw new Error("Only your organization's administrators can invite colleagues.")
      if (org.status !== 'APPROVED') throw new Error('You can invite colleagues once your organization is approved.')
      const normalized = normalizeEmail(email)
      if (!EMAIL.test(normalized)) throw new Error('Enter a valid email address.')
      const open = (i: Invitation) => i.orgId === org.id && !i.acceptedAt && !i.revokedAt
      for (const i of db.invitations) if (open(i) && i.email === normalized) i.revokedAt = now()
      if (db.invitations.filter((i) => open(i) && new Date(i.expiresAt).getTime() > Date.now()).length >= MAX_OPEN_INVITATIONS) {
        throw new Error(`Your organization has ${MAX_OPEN_INVITATIONS} open invitations. Revoke some before sending more.`)
      }
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      const invitation: Invitation = {
        id: newId('invite'),
        orgId: org.id,
        email: normalized,
        role: 'PARTNER',
        invitedBy: user.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString(),
      }
      db.invitations.push({ ...invitation, token })
      return { invitation, token }
    }),

  listInvitations: () =>
    transact((db) => {
      const user = signedInUser(db)
      const mine = (i: Invitation) => user?.role === 'PLATFORM_ADMIN' || (user?.role === 'PARTNER' && user.orgRole === 'ADMIN' && i.orgId === user.orgId)
      // The token never leaves the backend after creation
      return db.invitations
        .filter(mine)
        .map(withoutToken)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }),

  revokeInvitation: (invitationId) =>
    transact((db) => {
      const user = signedInUser(db)
      const inv = db.invitations.find((i) => i.id === invitationId)
      const allowed = inv && (user?.role === 'PLATFORM_ADMIN' || (user?.role === 'PARTNER' && user.orgRole === 'ADMIN' && inv.orgId === user.orgId))
      if (!inv || !allowed || inv.acceptedAt || inv.revokedAt) {
        throw new Error("That invitation can't be withdrawn. It may already be used or withdrawn.")
      }
      inv.revokedAt = now()
    }),

  previewInvitation: (token) =>
    transact((db) => {
      const id = readSession()
      if (!id) throw new Error('Please sign in first.')
      const inv = db.invitations.find((i) => i.token === token)
      if (!inv) return { state: 'INVALID' as const }
      const identity = sessionFor(db, id)?.identity
      const state = invitationState(db, inv, identity)
      if (state === 'WRONG_ACCOUNT') {
        const [local, domain] = inv.email.split('@')
        return { state, emailHint: `${local[0]}•••@${domain}` }
      }
      if (state !== 'VALID' && state !== 'HAS_ACCOUNT') return { state }
      return {
        state,
        orgName: db.organizations.find((o) => o.id === inv.orgId)?.name,
        role: inv.role,
        invitedBy: db.users.find((u) => u.id === inv.invitedBy)?.name,
        email: inv.email,
        expiresAt: inv.expiresAt,
      }
    }),

  acceptInvitation: (token) =>
    transact((db) => {
      const id = readSession()
      if (!id) throw new Error('Please sign in first.')
      const inv = db.invitations.find((i) => i.token === token)
      if (!inv) throw new Error("This invitation link isn't valid.")
      const identity = sessionFor(db, id)?.identity
      const messages: Partial<Record<InvitationState, string>> = {
        REVOKED: 'This invitation was withdrawn. Ask your organization for a new one.',
        USED: 'This invitation has already been used.',
        EXPIRED: 'This invitation has expired. Ask your organization for a new one.',
        WRONG_ACCOUNT: 'This invitation was sent to a different email address.',
        HAS_ACCOUNT: 'This account already belongs to Relay Collective, and an account can join one organization.',
        UNAVAILABLE: "This organization isn't accepting new members right now.",
      }
      const state = invitationState(db, inv, identity)
      if (state !== 'VALID') throw new Error(messages[state])
      const house = db.houses.find((h) => h.orgId === inv.orgId)
      if (!house) throw new Error("This organization isn't set up for staff yet. Contact Relay Collective.")
      const onboarding = identityToOnboard(db)
      inv.acceptedAt = now()
      return finishOnboarding(db, onboarding, {
        id: onboarding.id,
        name: onboarding.name,
        email: onboarding.email,
        phone: '',
        role: inv.role,
        orgId: inv.orgId,
        houseId: house.id,
        orgRole: 'STAFF',
      })
    }),

  searchOrganizations: (query) =>
    transact((db) => {
      if (!readSession()) throw new Error('Please sign in first.')
      if (query.trim().length < MIN_SEARCH_LENGTH) return []
      const entries = db.organizations
        .filter((o) => discoverable(db, o))
        .map((o) => ({ id: o.id, name: o.name, city: db.houses.find((h) => h.orgId === o.id)?.city, description: o.directoryDescription }))
      return rankDirectory(entries, query)
    }),

  submitJoinRequest: ({ orgId, requestedPosition, message }) =>
    transact((db) => {
      const id = readSession()
      if (!id) throw new Error('Please sign in first.')
      const user = sessionFor(db, id)?.user
      if (user) {
        if (user.orgId === orgId) throw new Error('You’re already a member of this organization.')
        throw new Error('This account already has a Relay Collective role, and an account can belong to one organization.')
      }
      const identity = identityToOnboard(db)
      const org = db.organizations.find((o) => o.id === orgId)
      if (!org || !discoverable(db, org)) throw new Error('This organization isn’t accepting requests to join right now.')
      const pending = db.joinRequests.find((r) => r.userId === identity.id && r.status === 'pending')
      if (pending?.orgId === orgId) return toMyJoinRequest(db, pending)
      if (pending) throw new Error('You already have a request waiting with another organization. Withdraw it first to ask somewhere else.')
      const today = db.joinRequests.filter((r) => r.userId === identity.id && Date.now() - new Date(r.createdAt).getTime() < 86_400_000)
      if (today.length >= MAX_REQUESTS_PER_DAY) throw new Error('You’ve sent several requests today. Please try again tomorrow.')
      const position = optionalText(requestedPosition)
      const note = optionalText(message)
      if (position && position.length > MAX_JOIN_POSITION) throw new Error('Keep your role or position under 120 characters.')
      if (note && note.length > MAX_JOIN_MESSAGE) throw new Error('Keep your message under 1,000 characters.')
      const request: StoredJoinRequest = { id: newId('join'), orgId, userId: identity.id, requestedPosition: position, message: note, status: 'pending', createdAt: now() }
      db.joinRequests.push(request)
      return toMyJoinRequest(db, request)
    }),

  listMyJoinRequests: () =>
    transact((db) => {
      const id = readSession()
      const me = id ? sessionFor(db, id)?.identity.id : undefined
      return db.joinRequests
        .filter((r) => r.userId === me)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map((r) => toMyJoinRequest(db, r))
    }),

  cancelJoinRequest: (requestId) =>
    transact((db) => {
      const id = readSession()
      const me = id ? sessionFor(db, id)?.identity.id : undefined
      const request = db.joinRequests.find((r) => r.id === requestId && r.userId === me && r.status === 'pending')
      if (!request) throw new Error('This request can’t be withdrawn. It may already have been reviewed.')
      Object.assign(request, { status: 'cancelled', cancelledAt: now() })
    }),

  listJoinRequests: (status) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'see requests to join')
      return db.joinRequests
        .filter((r) => r.orgId === orgId && (status === 'all' || r.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r): JoinRequest => {
          const applicant = applicantOf(db, r.userId)
          return {
            id: r.id,
            orgId: r.orgId,
            applicantName: applicant?.name ?? 'Applicant',
            applicantEmail: applicant?.email ?? '',
            emailVerified: true, // the demo can't send email, so sign-up counts as confirmed
            requestedPosition: r.requestedPosition,
            message: r.message,
            status: r.status,
            assignedRole: r.assignedRole,
            reviewNote: r.reviewNote,
            reviewedByName: db.users.find((u) => u.id === r.reviewedBy)?.name,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
          }
        })
    }),

  approveJoinRequest: (requestId, role) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'review requests to join')
      if (role !== 'ADMIN' && role !== 'STAFF') throw new Error('Choose a role for this member.')
      const request = findJoinRequest(db, requestId, orgId)
      if (request.status !== 'pending') {
        const was = { approved: 'approved', rejected: 'declined', cancelled: 'withdrawn' }[request.status]
        throw new Error(`This request was already ${was}. Refresh to see the latest.`)
      }
      if (db.organizations.find((o) => o.id === orgId)?.status !== 'APPROVED') throw new Error('Your organization needs to be approved before it can add members.')
      const identity = db.identities.find((i) => i.id === request.userId)
      if (!identity) throw new Error('This person already has a Relay Collective role, so they can’t join through this request.')
      const house = db.houses.find((h) => h.orgId === orgId)
      if (!house) throw new Error('Your organization isn’t set up for staff yet. Contact Relay Collective.')
      finishOnboarding(db, identity, { id: identity.id, name: identity.name, email: identity.email, phone: '', role: 'PARTNER', orgId, houseId: house.id, orgRole: role })
      Object.assign(request, { status: 'approved', cancelledAt: undefined, assignedRole: role, reviewedBy: readSession(), reviewedAt: now() })
    }),

  rejectJoinRequest: (requestId, note) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'review requests to join')
      const text = optionalText(note)
      if (text && text.length > MAX_REVIEW_NOTE) throw new Error('Keep the note under 500 characters.')
      const request = findJoinRequest(db, requestId, orgId)
      if (request.status !== 'pending') throw new Error('This request was already reviewed or withdrawn. Refresh to see the latest.')
      Object.assign(request, { status: 'rejected', reviewNote: text, reviewedBy: readSession(), reviewedAt: now() })
    }),

  listOrganizationMembers: (includeFormer = false) =>
    transact((db) => {
      const me = signedInUser(db)
      if (!me || !isActiveMember(db, me)) throw new Error('Only members of a partner organization can see its team.')
      const admin = me.orgRole === 'ADMIN'
      return db.users
        .filter((u) => u.role === 'PARTNER' && u.orgId === me.orgId)
        .map((u): OrganizationMember => {
          const removal = db.removals.find((r) => r.userId === u.id)
          const status = removal ? 'removed' : isActiveMember(db, u) ? 'active' : 'closed'
          return {
            id: u.id,
            name: u.name,
            email: admin ? u.email : undefined,
            role: u.orgRole ?? 'STAFF',
            status,
            joinedAt: db.applications.find((a) => a.submittedBy === u.id)?.submittedAt ?? db.joinRequests.find((r) => r.userId === u.id && r.status === 'approved')?.reviewedAt ?? '2026-09-01T16:00:00.000Z',
            removedAt: removal?.at,
            isYou: u.id === me.id,
          }
        })
        .filter((m) => includeFormer || m.status === 'active')
        .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name))
    }),

  setMemberRole: (profileId, role) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'change roles')
      if (role !== 'ADMIN' && role !== 'STAFF') throw new Error('Choose a role.')
      const member = activeMemberOf(db, profileId, orgId)
      if (member.id === readSession()) throw new Error('You can’t change your own role. Ask another administrator.')
      if (member.orgRole === role) return
      if (role === 'STAFF') keepAnAdmin(db, member)
      member.orgRole = role as OrgRole
    }),

  removeMember: (profileId) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'remove members')
      const member = activeMemberOf(db, profileId, orgId)
      const by = readSession()
      if (member.id === by) throw new Error('You can’t remove yourself. Ask another administrator.')
      keepAnAdmin(db, member)
      // The login moves to a fresh identity with no role; the profile stays on the organization's history
      const identity: Identity = { id: newId('u'), email: member.email ?? '', name: member.name }
      db.identities.push(identity)
      for (const c of db.credentials) if (c.userId === member.id) c.userId = identity.id
      db.removals.push({ userId: member.id, at: now(), by, identityId: identity.id })
    }),

  setOrganizationVisibility: (discoverability, description) =>
    transact((db) => {
      const orgId = adminOrgId(db, 'change its visibility')
      if (discoverability !== 'discoverable' && discoverability !== 'invitation_only') throw new Error('Choose who can find your organization.')
      const text = optionalText(description)
      if (text && text.length > MAX_DIRECTORY_DESCRIPTION) throw new Error('Keep the description under 280 characters.')
      const org = findOrThrow(db.organizations, orgId, 'Organization')
      if (discoverability === 'discoverable' && org.status !== 'APPROVED') {
        throw new Error('Your organization can be found in search once Relay Collective approves it.')
      }
      Object.assign(org, { discoverability, directoryDescription: text })
    }),

  listUsers: () => transact((db) => db.users),

  isEmailAvailable: (email) =>
    transact((db) => !db.credentials.some((c) => c.email === normalizeEmail(email))),

  registerOrganization: (org, account, location, destinations = []) =>
    transact((db) => {
      const created: Organization = { ...org, id: newId('org'), status: 'PENDING', createdAt: now() }
      const isPartner = org.type === 'PARTNER_ORG'
      if (isPartner && !location) throw new Error('Add the address where rides start.')
      // A partner organization is one location: its account is shared by the staff there, so it carries the org's name
      const house: House | undefined =
        isPartner && location ? { ...location, id: newId('house'), orgId: created.id, name: org.name } : undefined
      const user: User = {
        id: newId('u'),
        name: isPartner ? org.name : account.name,
        email: normalizeEmail(account.email),
        phone: org.contactPhone,
        role: isPartner ? 'PARTNER' : 'ORG_ADMIN',
        orgId: created.id,
        houseId: house?.id,
        orgRole: isPartner ? 'ADMIN' : undefined,
      }
      addLogin(db, user.id, account.email, account.password)
      db.organizations.push(created)
      if (house) db.houses.push(house)
      db.users.push(user)
      for (const dest of destinations) db.destinations.push({ ...dest, id: newId('dest'), orgId: created.id })
      return { status: 'SIGNED_IN', user }
    }),

  listOrganizations: () => transact((db) => db.organizations),

  listHouses: (orgId) => transact((db) => db.houses.filter((h) => !orgId || h.orgId === orgId)),

  registerDriver: (newUser, driver, login) =>
    transact((db) => {
      const { user } = addDriver(db, newUser, driver, login)
      return { status: 'SIGNED_IN', user }
    }),

  // Transport providers can add a driver without a login. Partner organizations cannot.
  addOrgDriver: (newUser, driver) =>
    transact((db) => {
      const user = db.users.find((u) => u.id === readSession())
      if (user?.role !== 'ORG_ADMIN' || !user.orgId) {
        throw new Error('Only a transport provider can add drivers.')
      }
      return addDriver(db, newUser, { ...driver, orgId: user.orgId }).driver
    }),

  listDrivers: (orgId) => transact((db) => db.drivers.filter((d) => !orgId || d.orgId === orgId)),

  listDriverPool: () => transact((db) => db.drivers.filter((d) => d.status === 'APPROVED')),

  updateDriver: (driverId, changes) =>
    transact((db) => {
      const driver = findOrThrow(db.drivers, driverId, 'Driver')
      if (
        driver.status === 'APPROVED' &&
        ((changes.seats !== undefined && changes.seats !== driver.seats) ||
          (changes.wheelchairAccessible !== undefined && changes.wheelchairAccessible !== driver.wheelchairAccessible))
      ) {
        throw new Error(CAPACITY_LOCKED)
      }
      Object.assign(driver, changes)
      return driver
    }),

  listAccounts: () =>
    transact((db) => {
      const withLogin = new Set(db.credentials.map((c) => c.userId))
      return db.users.filter((u) => withLogin.has(u.id))
    }),

  resetPassword: (userId, newPassword) =>
    transact((db) => {
      const login = db.credentials.find((c) => c.userId === userId)
      if (!login) throw new Error("This account doesn't have a sign-in.")
      const password = newPassword ?? tempPassword()
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      login.password = password
      return { kind: 'NEW_PASSWORD', email: login.email, password }
    }),

  previewAccountDeletion: (userId) => transact((db) => deletionPreview(db, requireDeletionAdmin(db), userId)),

  // The demo has no Storage or Auth to fail, so every step runs at once and the job completes
  async startAccountDeletion(userId, { email, password }) {
    const { job, files } = await transact((db) => {
      const admin = requireDeletionAdmin(db)
      checkAdminPassword(db, admin, password)
      const user = db.users.find((u) => u.id === userId)
      if (!user || deletedProfile(db, userId)) throw new Error('Account not found. It may already have been deleted.')
      const login = db.credentials.find((c) => c.userId === userId)
      if (!emailMatches(email, login?.email)) throw new Error('The email you typed doesn’t match this account.')
      const plan = deletionPlan(db, admin, user)
      if (plan.blockers.length) throw new Error(BLOCKER_MESSAGES[plan.blockers[0]!])
      eraseAccount(db, user)
      const at = now()
      const done: AccountDeletionJob = {
        id: crypto.randomUUID(),
        profileId: userId,
        status: 'completed',
        step: 'done',
        attempts: 1,
        plan: plan.categories,
        startedAt: at,
        updatedAt: at,
        completedAt: at,
      }
      db.deletionJobs.push(done)
      return { job: done, files: plan.files }
    })
    await Promise.all(files.map((path) => deleteDemoFile(path)))
    return job
  },

  retryAccountDeletion: (jobId, password) =>
    transact((db) => {
      checkAdminPassword(db, requireDeletionAdmin(db), password)
      const job = db.deletionJobs.find((j) => j.id === jobId)
      if (!job) throw new Error('That deletion wasn’t found.')
      return job
    }),

  getAccountDeletion: (jobId) =>
    transact((db) => {
      requireDeletionAdmin(db)
      return db.deletionJobs.find((j) => j.id === jobId)
    }),

  // Keeps the person on past rides. Only the sign-in goes away.
  deleteMyAccount: () =>
    transact((db) => {
      const userId = readSession()
      const user = db.users.find((u) => u.id === userId)
      if (!user) throw new Error('Please sign in.')
      if (user.role !== 'DRIVER' && user.role !== 'PARTNER' && user.role !== 'VOLUNTEER') {
        throw new Error("This account can't be closed from here.")
      }
      // A general volunteer has no rides or organization to hand over: only the sign-in closes

      if (user.role === 'PARTNER') keepAnAdmin(db, user)

      if (user.role === 'DRIVER') {
        const driver = db.drivers.find((d) => d.userId === userId)
        if (driver) releaseDriverWork(db, driver.id)
      } else if (
        user.role === 'PARTNER' &&
        // Colleagues who can still sign in keep managing the organization's rides
        !db.users.some((u) => u.id !== userId && u.orgId === user.orgId && u.role === 'PARTNER' && db.credentials.some((c) => c.userId === u.id))
      ) {
        for (const ride of db.rides) {
          if (ride.orgId !== user.orgId || !partnerCloseCancelsRide(ride)) continue
          ride.status = 'CANCELLED'
          ride.cancelReason = 'The organization closed its Relay Collective account.'
          ride.cancelledAt = now()
          closePendingOffers(db, ride.id)
        }
      }

      db.credentials = db.credentials.filter((c) => c.userId !== userId)
      user.email = undefined
      writeSession('')
    }),

  listPending: () =>
    transact((db) => ({
      orgs: db.organizations.filter((o) => o.status === 'PENDING'),
      drivers: db.drivers.filter((d) => d.status === 'PENDING'),
    })),

  setOrgStatus: (orgId, status) =>
    transact((db) => {
      const org = findOrThrow(db.organizations, orgId, 'Organization')
      Object.assign(org, { status, reviewedAt: now(), reviewedBy: readSession() })
      return org
    }),

  setDriverStatus: (driverId, status) =>
    transact((db) => {
      const driver = findOrThrow(db.drivers, driverId, 'Driver')
      Object.assign(driver, { status, reviewedAt: now(), reviewedBy: readSession() })
      return driver
    }),

  listDestinations: (orgId) =>
    transact((db) => db.destinations.filter((d) => !orgId || d.orgId === orgId)),

  saveDestination: (dest) =>
    transact((db) => {
      const created = { ...dest, id: newId('dest') }
      db.destinations.push(created)
      return created
    }),

  updateDestination: (id, changes) =>
    transact((db) => {
      const dest = findOrThrow(db.destinations, id, 'Destination')
      dest.name = changes.name.trim()
      dest.address = changes.address.trim()
      dest.city = changes.city.trim()
      dest.notes = changes.notes?.trim() || undefined
      return dest
    }),

  deleteDestination: (id) =>
    transact((db) => {
      const index = db.destinations.findIndex((d) => d.id === id)
      if (index < 0) throw new Error(`Destination not found: ${id}`)
      db.destinations.splice(index, 1)
    }),

  requestRide: (input) =>
    transact((db) => {
      checkPickupTime(input)
      checkPassengers(db, input.passengers)
      if (!input.destinationAddress.trim()) throw new Error('Choose where the ride is going.')
      const ride: Ride = {
        ...input,
        riderNames: cleanNames(input.riderNames, input.passengers),
        id: newId('ride'),
        status: 'SEARCHING',
        createdAt: now(),
      }
      db.rides.push(ride)
      dispatch(db, ride)
      return ride
    }),

  updateRide: (rideId, changes) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['SEARCHING', 'OFFERED', 'NEEDS_ATTENTION', 'ACCEPTED'], cantChange(ride))
      // Notes and names keep an on-demand ride's give-up clock. A real change starts it again.
      const resend = editSendsRideAgain(ride, changes)
      const next: RideChanges = { ...changes, pickupTime: pickupTimeAfterEdit(ride, changes, now()) }
      checkPickupTime(next)
      checkPassengers(db, next.passengers)
      if (!next.destinationAddress.trim()) throw new Error('Choose where the ride is going.')

      Object.assign(ride, next, { riderNames: cleanNames(next.riderNames, next.passengers), changedAt: now() })
      if (!resend) return ride

      // Earlier answers were about the old ride: ask again, with the driver who had accepted asked first.
      // Drivers who dropped it already said they can't make it, so they stay out.
      const previousDriverId = ride.driverId
      closePendingOffers(db, rideId)
      db.offers = db.offers.filter((o) => o.rideId !== rideId || o.status === 'WITHDRAWN')
      if (previousDriverId) {
        clearDriverProgress(ride)
        ride.preferredDriverId = previousDriverId
        ride.reconfirmDriverId = previousDriverId
      }
      ride.status = 'SEARCHING'
      dispatch(db, ride)
      return ride
    }),

  getRide: (rideId) => transact((db) => db.rides.find((r) => r.id === rideId)),

  listRidesForHouse: (houseId) => transact((db) => db.rides.filter((r) => r.houseId === houseId)),

  listOffersForRide: (rideId) => transact((db) => db.offers.filter((o) => o.rideId === rideId)),

  retryRide: (rideId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['NEEDS_ATTENTION'], cantChange(ride))
      if (noDriverDeadline(ride) <= new Date()) throw new Error('The pickup time has passed. Please book a new ride.')
      // Clear previous answers so everyone can be asked again, except drivers who already dropped it
      db.offers = db.offers.filter(
        (o) => o.rideId !== rideId || o.status === 'ACCEPTED' || o.status === 'WITHDRAWN',
      )
      // Logged here: a retry that finds nobody leaves the ride as it was, so comparing can't see it
      logEvent(db, ride.id, signedInUser(db), { kind: 'SENT_AGAIN' })
      dispatch(db, ride)
      return ride
    }),

  cancelRide: (rideId, reason) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['SEARCHING', 'OFFERED', 'ACCEPTED', 'NEEDS_ATTENTION'], cantChange(ride))
      ride.status = 'CANCELLED'
      ride.cancelReason = reason
      ride.cancelledAt = now()
      closePendingOffers(db, rideId)
      return ride
    }),

  listMyOffers: (driverId) =>
    transact((db) => db.offers.filter((o) => o.driverId === driverId && o.status === 'PENDING')),

  listOffersForOrg: (orgId) =>
    transact((db) => {
      const ids = driverIdsForOrg(db, orgId)
      return db.offers.filter((o) => ids.includes(o.driverId) && o.status === 'PENDING')
    }),

  listMyRides: (driverId) => transact((db) => db.rides.filter((r) => r.driverId === driverId)),

  listRidesForOrg: (orgId) =>
    transact((db) => {
      const ids = driverIdsForOrg(db, orgId)
      return db.rides.filter((r) => r.driverId && ids.includes(r.driverId))
    }),

  // Mirrors the database rule: only a platform admin reads every ride
  listAllRides: () =>
    transact((db) => {
      if (signedInUser(db)?.role !== 'PLATFORM_ADMIN') throw new Error('Only a Relay Collective admin can see every ride.')
      return [...db.rides].sort((a, b) => b.pickupTime.localeCompare(a.pickupTime)).slice(0, ALL_RIDES_LIMIT)
    }),

  respondToOffer: (offerId, accept) =>
    transact((db) => {
      const offer = findOrThrow(db.offers, offerId, 'Offer')
      const ride = findOrThrow(db.rides, offer.rideId, 'Ride')
      if (offer.status !== 'PENDING') {
        throw new Error(ride.driverId ? 'Another driver already accepted this ride.' : 'This request is no longer open.')
      }
      offer.respondedAt = now()
      if (accept) {
        // Only one driver can accept a ride: the first yes wins, everyone else's request closes
        if (ride.driverId) throw new Error('Another driver already accepted this ride.')
        offer.status = 'ACCEPTED'
        closePendingOffers(db, ride.id, 'TAKEN')
        ride.status = 'ACCEPTED'
        ride.driverId = offer.driverId
        ride.acceptedAt = offer.respondedAt
        ride.reconfirmDriverId = undefined
      } else {
        offer.status = 'DECLINED'
        dispatchIfUnanswered(db, ride.id)
      }
      return ride
    }),

  dropRide: (rideId, driverId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      if (ride.driverId !== driverId) throw new Error('This ride belongs to another driver.')
      requireStatus(ride, ['ACCEPTED'], cantChange(ride))
      // Mark their acceptance as withdrawn, so they aren't asked again and the house can see it
      for (const o of db.offers) {
        if (o.rideId === rideId && o.driverId === driverId && o.status === 'ACCEPTED') o.status = 'WITHDRAWN'
      }
      ride.droppedBy = { driverId, at: now() }
      clearDriverProgress(ride)
      dispatch(db, ride)
      return ride
    }),

  markOnTheWay: (rideId, eta) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['ACCEPTED'], cantChange(ride))
      ride.driverOnTheWayAt = now()
      ride.driverEta = eta ? etaTimestamp(ride, eta) : undefined
      return ride
    }),

  markDriverArrived: (rideId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      if (ride.status !== 'ACCEPTED') throw new Error('You can only say you are here on a confirmed ride.')
      ride.driverOnTheWayAt ??= now()
      ride.driverArrivedAt = now()
      return ride
    }),

  markPickedUp: (rideId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['ACCEPTED'], cantChange(ride))
      ride.status = 'PICKED_UP'
      ride.pickedUpAt = now()
      return ride
    }),

  markCompleted: (rideId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['PICKED_UP'], ride.status === 'ACCEPTED' ? 'Mark the client as picked up first.' : cantChange(ride))
      ride.status = 'COMPLETED'
      ride.completedAt = now()
      return ride
    }),

  markNoShow: (rideId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      requireStatus(ride, ['ACCEPTED'], cantChange(ride))
      if (!ride.driverArrivedAt) throw new Error(NO_SHOW_NOT_HERE)
      if (!canMarkNoShow(ride)) throw new Error(NO_SHOW_TOO_SOON)
      ride.status = 'NO_SHOW'
      ride.cancelReason = 'Client did not show up. The ride is lost.'
      ride.cancelledAt = now()
      return ride
    }),

  undoDriverStep: (rideId, driverId) =>
    transact((db) => {
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      if (ride.driverId !== driverId) throw new Error('This ride belongs to another driver.')
      const recent = (at?: string) => !!at && Date.now() - new Date(at).getTime() < UNDO_FINISH_MINUTES * 60_000
      switch (ride.status) {
        case 'COMPLETED':
          if (!recent(ride.completedAt)) throw new Error('This ride finished a while ago, so it can no longer be changed.')
          ride.status = 'PICKED_UP'
          ride.completedAt = undefined
          break
        case 'NO_SHOW':
          if (!recent(ride.cancelledAt)) throw new Error('This ride finished a while ago, so it can no longer be changed.')
          ride.status = 'ACCEPTED'
          ride.cancelReason = undefined
          ride.cancelledAt = undefined
          break
        case 'PICKED_UP':
          ride.status = 'ACCEPTED'
          ride.pickedUpAt = undefined
          break
        case 'ACCEPTED':
          if (ride.driverArrivedAt) ride.driverArrivedAt = undefined
          else if (ride.driverOnTheWayAt) {
            ride.driverOnTheWayAt = undefined
            ride.driverEta = undefined
          } else throw new Error("There's nothing to undo. To give up the ride, choose “I can't make it”.")
          break
        default:
          throw new Error(cantChange(ride))
      }
      return ride
    }),

  listRideEvents: (rideId) => transact((db) => db.events.filter((e) => e.rideId === rideId)),

  giveFeedback: (rideId, input) =>
    transact((db) => {
      const user = signedInUser(db)
      const ride = findOrThrow(db.rides, rideId, 'Ride')
      const isPartner = user?.role === 'PARTNER' && ride.orgId === user.orgId
      const isDriver = user?.role === 'DRIVER' && !!ride.driverId && db.drivers.find((d) => d.id === ride.driverId)?.userId === user.id
      if (!isPartner && !isDriver) throw new Error('You can only give feedback on your own rides.')
      if (!canGiveFeedback(ride)) throw new Error(FEEDBACK_NOT_YET)
      const note = input.note?.trim() || undefined
      if (note && note.length > MAX_FEEDBACK_NOTE) throw new Error(NOTE_TOO_LONG)
      if (isPartner && !input.rating) throw new Error(RATING_REQUIRED)
      if (isDriver && !note) throw new Error(ISSUE_REQUIRED)

      // One each per ride: the partner organization's account and the ride's driver
      const authorRole = isPartner ? 'PARTNER' : 'DRIVER'
      const existing = db.feedback.find((f) => f.rideId === rideId && f.authorRole === authorRole)
      const entry: RideFeedback = {
        id: existing?.id ?? newId('feedback'),
        rideId,
        authorRole,
        orgId: ride.orgId,
        driverId: ride.driverId,
        rating: isPartner ? input.rating : undefined,
        note,
        at: now(),
      }
      db.feedback = [...db.feedback.filter((f) => f !== existing), entry]
      return entry
    }),

  listMyFeedback: () =>
    transact((db) => {
      const user = signedInUser(db)
      if (user?.role === 'PARTNER') return db.feedback.filter((f) => f.authorRole === 'PARTNER' && f.orgId === user.orgId)
      const driver = user?.role === 'DRIVER' ? db.drivers.find((d) => d.userId === user.id) : undefined
      return driver ? db.feedback.filter((f) => f.authorRole === 'DRIVER' && f.driverId === driver.id) : []
    }),

  listFeedback: ({ driverId, orgId }) =>
    transact((db) => {
      if (signedInUser(db)?.role !== 'PLATFORM_ADMIN') throw new Error('Only Relay Collective admins can see feedback.')
      return db.feedback.filter((f) => (!driverId || f.driverId === driverId) && (!orgId || f.orgId === orgId))
    }),

  submitProductFeedback: (feedback, clientRequestId) =>
    transact((db) => feedbackStore.submitFeedback(db, signedInUser(db), feedback, clientRequestId)),

  // Grant, store the file, then confirm: the same three steps as the real backend
  attachFeedbackScreenshot: async (feedbackId, file, fileName) => {
    const grant = await transact((db) => feedbackStore.beginAttachment(db, signedInUser(db), feedbackId, file, fileName))
    await putDemoFile(grant.storagePath, file)
    return transact((db) => feedbackStore.confirmAttachment(db, signedInUser(db), grant.id))
  },

  listMyProductFeedback: () => transact((db) => feedbackStore.listMine(db, signedInUser(db))),

  getMyProductFeedback: (feedbackId) => transact((db) => feedbackStore.getMine(db, signedInUser(db), feedbackId)),

  getFeedbackScreenshotUrl: async (attachment) => {
    const allowed = await transact((db) => feedbackStore.canReadAttachment(db, signedInUser(db), attachment.storagePath))
    const file = allowed ? await getDemoFile(attachment.storagePath) : undefined
    if (!file) throw new Error('This screenshot isn’t available in this browser.')
    return URL.createObjectURL(file)
  },

  getFeedbackSummary: () => transact((db) => feedbackStore.summary(db, signedInUser(db))),

  listProductFeedback: (query) => transact((db) => feedbackStore.list(db, signedInUser(db), query)),

  getProductFeedback: (feedbackId) => transact((db) => feedbackStore.detail(db, signedInUser(db), feedbackId)),

  listFeedbackAssignees: () => transact((db) => feedbackStore.assignees(db, signedInUser(db))),

  updateFeedbackTriage: (feedbackId, change) => transact((db) => feedbackStore.updateTriage(db, signedInUser(db), feedbackId, change)),

  addFeedbackMessage: (feedbackId, message, visibility) =>
    transact((db) => feedbackStore.addMessage(db, signedInUser(db), feedbackId, message, visibility)),

  getImpact: () =>
    transact((db) => {
      const completed = db.rides.filter((r) => r.status === 'COMPLETED')
      return {
        ridesCompleted: completed.length,
        moneySaved: faresSavedFor(completed.length),
        // Deleting an account keeps its organization for history, so only count ones someone can still sign in to
        organizations: db.organizations.filter(
          (o) => o.status === 'APPROVED' && db.users.some((u) => u.orgId === o.id && (u.role === 'PARTNER' || u.role === 'ORG_ADMIN')),
        ).length,
        verifiedDrivers: db.drivers.filter((d) => d.status === 'APPROVED').length,
      }
    }),
}

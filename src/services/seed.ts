import { ALL_DAY, hoursOn } from '../logic/requestHours'
import { knownPlace } from '../logic/places'
import { backfillRideEvents } from '../logic/rideEvents'
import { emptyFeedbackStore, type ProductFeedbackStore } from './mockFeedback'
import type {
  AccountDeletionJob,
  Destination,
  Driver,
  House,
  Identity,
  Invitation,
  JoinRequestStatus,
  OrgRole,
  Organization,
  OrganizationApplication,
  Ride,
  RideEvent,
  RideFeedback,
  RideOffer,
  User,
  VolunteerProfile,
} from '../types'

// Demo data. Everything here is fictional except public place names and addresses.
// House addresses are from https://belkintsa.ca/services/overview.

// Demo only: the mock backend keeps passwords in plain text in the browser.
// A real backend must use a proper auth provider (e.g. Supabase Auth).
export interface Credential {
  email: string
  userId: string
  password: string
}

export const DEMO_PASSWORD = 'careride'
export const DEMO_EMAIL_DOMAIN = '@careride.demo'

// The Relay Collective Admin has its own login, separate from the shared demo password.
export const ADMIN_EMAIL = 'admin@careride.com'
export const ADMIN_PASSWORD = 'abcd1234'

export function demoPasswordFor(email: string): string {
  return email === ADMIN_EMAIL ? ADMIN_PASSWORD : DEMO_PASSWORD
}

export interface Database {
  credentials: Credential[]
  users: User[]
  organizations: Organization[]
  houses: House[]
  drivers: Driver[]
  destinations: Destination[]
  rides: Ride[]
  offers: RideOffer[]
  events: RideEvent[] // each ride's change history, oldest first
  feedback: RideFeedback[]
  // Signed up, but no role yet (onboarding not finished). Their login is in credentials under the same id.
  identities: Identity[]
  applications: OrganizationApplication[]
  invitations: (Invitation & { token: string })[] // demo only: the real backend keeps a hash, never the token
  productFeedback: ProductFeedbackStore // Feedback & Suggestions; screenshots themselves live in demoFiles
  joinRequests: StoredJoinRequest[]
  // Members an administrator removed. Their profile stays on past rides; their login moved to a new identity.
  removals: { userId: string; at: string; by: string; identityId: string }[]
  deletionJobs: AccountDeletionJob[] // permanent deletions; like the database's, they hold no name or email
  volunteerProfiles: VolunteerProfile[] // general volunteering: interests, by profile. Never a driver profile.
}

// A request to join an organization, as the demo backend keeps it. userId is the applicant's identity id,
// which becomes their profile id if they're approved (as with every onboarding path in the demo).
export interface StoredJoinRequest {
  id: string
  orgId: string
  userId: string
  requestedPosition?: string
  message?: string
  status: JoinRequestStatus
  assignedRole?: OrgRole
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  cancelledAt?: string
  createdAt: string
}

// History for rides that don't have any yet (the seed, or demo data saved before the log existed),
// worked out from the times stored on each ride.
export function backfilledEvents(db: Pick<Database, 'rides' | 'users' | 'drivers'>): RideEvent[] {
  return db.rides.flatMap((ride) =>
    backfillRideEvents(ride).map((e, i): RideEvent => {
      const userId =
        e.actor === 'REQUESTER' ? ride.requestedBy : e.actor === 'DRIVER' ? db.drivers.find((d) => d.id === ride.driverId)?.userId : undefined
      const actor = db.users.find((u) => u.id === userId)
      return {
        id: `event-${ride.id}-${i}`,
        rideId: ride.id,
        kind: e.kind,
        at: e.at,
        actorRole: actor?.role,
        actorName: actor?.name,
        detail: e.detail,
      }
    }),
  )
}

// Frank takes requests any time so the demo always has someone to ask
const ANY_TIME = hoursOn([0, 1, 2, 3, 4, 5, 6], ALL_DAY)
const DAYS_AND_EVENINGS = hoursOn([0, 1, 2, 3, 4, 5, 6], { from: '07:00', to: '22:00' })
const WEEKDAYS = hoursOn([1, 2, 3, 4, 5], { from: '09:00', to: '17:00' })

const BELKIN_ADDRESS = '555 Homer St'

function pastRide(id: string, destinationId: string, name: string, address: string, date: string): Ride {
  return {
    id,
    type: 'SCHEDULED',
    orgId: 'org-belkin',
    houseId: 'house-belkin',
    requestedBy: 'u-belkin',
    passengers: 1,
    pickupAddress: `${BELKIN_ADDRESS}, Vancouver`,
    destinationId,
    destinationName: name,
    destinationAddress: address,
    pickupTime: date,
    needsWheelchair: false,
    needsAssistance: false,
    status: 'COMPLETED',
    driverId: 'd-olive',
    estimatedFareSaved: 2.58,
    createdAt: date,
    acceptedAt: date,
    pickedUpAt: date,
    completedAt: date,
  }
}

// Each partner organization is one location with one shared account.
function partner(
  id: string,
  name: string,
  phone: string,
  address: string,
  city: string,
  status: Organization['status'] = 'APPROVED',
  directoryDescription?: string,
): { org: Organization; house: House } {
  // Approved demo partners can be found in organization search; the pending one can't be yet
  const discoverability = status === 'APPROVED' ? 'discoverable' : 'invitation_only'
  return {
    org: { id: `org-${id}`, name, type: 'PARTNER_ORG', contactName: name, contactPhone: phone, status, discoverability, directoryDescription },
    house: { id: `house-${id}`, orgId: `org-${id}`, name, address, city, phone },
  }
}

const partners = [
  partner('belkin', 'Belkin House', '604-555-0120', BELKIN_ADDRESS, 'Vancouver', 'APPROVED', 'Transitional housing and support for women and families.'),
  partner('richmond', 'Richmond House', '604-555-0121', '12040 Horseshoe Way', 'Richmond', 'APPROVED', 'Emergency shelter and meals in Richmond.'),
  partner('grace', 'Grace Mansion', '604-555-0122', '596 E Hastings St', 'Vancouver'),
  partner('example', 'Example Shelter Society (Fictional)', '604-555-0130', 'Address to confirm', 'Vancouver', 'PENDING'),
]

// Common hospitals, saved for every demo partner
const HOSPITALS = ['stp', 'vgh', 'rh']

// Places each house's case workers said they send clients most (see PARTNER_ORG_NOTES.md)
const FREQUENT_PLACES: Record<string, string[]> = {
  belkin: ['3b', 'raven', 'ground', 'aac', 'reach', 'gather', 'vpl', 'dewc'],
  richmond: ['msdpr-rmd', 'workbc', 'icbc', 'upcc', 'vogel', 'trans', 'brig', 'caring', 'ironlib', 'thrive'],
  grace: ['3b', 'raven', 'ground', 'belkin', 'carn', 'kettle', 'junc', 'rcafe', 'mposs', 'south', 'vcc', 'msdpr', 'svc'],
}

// The seeded general volunteers: no vehicle, no driver profile, no CareRide access. Also added to demo data saved
// before volunteers existed (see mockService upgrade).
// Priya doesn't drive and would like to help with food and outreach. Alex is interested in transportation as well,
// which still doesn't make them a driver.
export const VOLUNTEER_USER: User = { id: 'u-priya', name: 'Priya', email: 'priya@careride.demo', phone: '', role: 'VOLUNTEER' }
export const VOLUNTEER_PROFILE: VolunteerProfile = {
  id: 'vp-priya',
  userId: VOLUNTEER_USER.id,
  interests: ['FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH'],
  createdAt: '2026-10-01T17:00:00.000Z',
}
const ALEX: User = { id: 'u-alex', name: 'Alex Morgan', email: 'alex@careride.demo', phone: '', role: 'VOLUNTEER' }
// A driver can save interests too: Maya drives and would also help with food. Frank and the others have none
// (as for every driver from before general volunteering).
export const SEEDED_VOLUNTEERS: { user?: User; profile: VolunteerProfile }[] = [
  { user: VOLUNTEER_USER, profile: VOLUNTEER_PROFILE },
  { user: ALEX, profile: { id: 'vp-alex', userId: ALEX.id, interests: ['TRANSPORTATION', 'COMMUNITY_OUTREACH'], createdAt: '2026-10-02T17:00:00.000Z' } },
  { profile: { id: 'vp-olive', userId: 'u-olive', interests: ['TRANSPORTATION', 'FOOD_DISTRIBUTION'], createdAt: '2026-10-03T17:00:00.000Z' } },
]

const demoUsers: User[] = [
  { id: 'u-admin', name: 'Relay Collective Admin', email: ADMIN_EMAIL, phone: '604-555-0100', role: 'PLATFORM_ADMIN' },
  { id: 'u-belkin', name: 'Belkin House', email: 'belkin@careride.demo', phone: '604-555-0120', role: 'PARTNER', orgId: 'org-belkin', houseId: 'house-belkin', orgRole: 'ADMIN' },
  { id: 'u-richmond', name: 'Richmond House', email: 'richmond@careride.demo', phone: '604-555-0121', role: 'PARTNER', orgId: 'org-richmond', houseId: 'house-richmond', orgRole: 'ADMIN' },
  { id: 'u-grace', name: 'Grace Mansion', email: 'grace@careride.demo', phone: '604-555-0122', role: 'PARTNER', orgId: 'org-grace', houseId: 'house-grace', orgRole: 'ADMIN' },
  { id: 'u-vanshare-admin', name: 'Community Van Share Admin', email: 'vanshare@careride.demo', phone: '604-555-0110', role: 'ORG_ADMIN', orgId: 'org-vanshare' },
  { id: 'u-frank', name: 'Frank', email: 'frank@careride.demo', phone: '604-555-0103', role: 'DRIVER' },
  { id: 'u-olive', name: 'Maya', email: 'maya@careride.demo', phone: '604-555-0104', role: 'DRIVER' },
  { id: 'u-sam', name: 'Sam', email: 'sam@careride.demo', phone: '604-555-0105', role: 'DRIVER', orgId: 'org-vanshare' },
  { id: 'u-jordan', name: 'Jordan', email: 'jordan@careride.demo', phone: '604-555-0106', role: 'DRIVER' },
  // General volunteers: no vehicle, no driver profile, no CareRide access
  VOLUNTEER_USER,
  ALEX,
]

const seedBase: Omit<
  Database,
  'events' | 'feedback' | 'identities' | 'applications' | 'invitations' | 'productFeedback' | 'joinRequests' | 'removals' | 'deletionJobs' | 'volunteerProfiles'
> = {
  credentials: demoUsers.map((u) => ({ email: u.email!, userId: u.id, password: demoPasswordFor(u.email!) })),
  users: demoUsers,
  organizations: [
    ...partners.map((p) => p.org),
    // Transport providers are hidden from sign-up for now. Kept so Sam's accessible van stays in the demo.
    {
      id: 'org-vanshare',
      name: 'Community Van Share (Fictional)',
      type: 'TRANSPORT_PROVIDER',
      contactName: 'Community Van Share Admin',
      contactPhone: '604-555-0110',
      bookingNotifications: 'bookings@vanshare.example',
      status: 'APPROVED',
    },
  ],
  houses: partners.map((p) => p.house),
  drivers: [
    {
      id: 'd-frank',
      userId: 'u-frank',
      background: 'RIDESHARE',
      vehicle: 'Black SUV',
      wheelchairAccessible: false,
      seats: 3,
      serviceCities: ['Vancouver', 'Richmond'],
      requestHours: ANY_TIME,
      licenceFile: 'licence.pdf',
      proofFile: 'rideshare-permit.pdf',
      status: 'APPROVED',
    },
    {
      id: 'd-olive',
      userId: 'u-olive',
      background: 'TAXI',
      vehicle: 'White sedan',
      wheelchairAccessible: false,
      seats: 3,
      serviceCities: ['Vancouver', 'Richmond'],
      requestHours: DAYS_AND_EVENINGS,
      licenceFile: 'licence.pdf',
      proofFile: 'taxi-permit.pdf',
      status: 'APPROVED',
    },
    {
      id: 'd-sam',
      userId: 'u-sam',
      orgId: 'org-vanshare',
      background: 'ORG_DRIVER',
      vehicle: 'Grey accessible van',
      wheelchairAccessible: true,
      seats: 6,
      serviceCities: ['Vancouver'],
      requestHours: WEEKDAYS,
      licenceFile: 'licence.pdf',
      status: 'APPROVED',
    },
    {
      id: 'd-jordan',
      userId: 'u-jordan',
      background: 'TAXI',
      vehicle: 'Blue hatchback',
      wheelchairAccessible: false,
      seats: 3,
      serviceCities: ['Richmond'],
      requestHours: DAYS_AND_EVENINGS,
      licenceFile: 'licence.pdf',
      proofFile: 'taxi-permit.pdf',
      status: 'PENDING',
    },
  ],
  destinations: partners.flatMap(({ org }) => {
    const id = org.id.slice(4)
    return [...(FREQUENT_PLACES[id] ?? []), ...HOSPITALS].map((key) => {
      const { name, address, city } = knownPlace(key)
      return { name, address, city, id: `dest-${key}-${id}`, orgId: org.id }
    })
  }),
  // A few past trips so the impact counter and "most visited" list aren't empty
  rides: [
    pastRide('ride-past-1', 'dest-stp-belkin', "St. Paul's Hospital", '1081 Burrard St, Vancouver', '2026-09-28T16:30:00.000Z'),
    pastRide('ride-past-2', 'dest-stp-belkin', "St. Paul's Hospital", '1081 Burrard St, Vancouver', '2026-09-30T17:00:00.000Z'),
    pastRide('ride-past-3', 'dest-vgh-belkin', 'Vancouver General Hospital', '899 W 12th Ave, Vancouver', '2026-10-01T18:15:00.000Z'),
  ],
  offers: [],
}

export const seed: Database = {
  ...seedBase,
  events: backfilledEvents(seedBase),
  // So the admin's account details show what feedback looks like
  feedback: [
    {
      id: 'feedback-past-1',
      rideId: 'ride-past-1',
      authorRole: 'PARTNER',
      orgId: 'org-belkin',
      driverId: 'd-olive',
      rating: 'UP',
      note: 'Maya waited in the lobby and helped with the walker.',
      at: '2026-09-28T18:00:00.000Z',
    },
  ],
  identities: [],
  applications: [],
  invitations: [],
  // Starts empty: the admin console shows real submissions only
  productFeedback: emptyFeedbackStore(),
  joinRequests: [],
  removals: [],
  deletionJobs: [],
  volunteerProfiles: SEEDED_VOLUNTEERS.map((v) => v.profile),
}

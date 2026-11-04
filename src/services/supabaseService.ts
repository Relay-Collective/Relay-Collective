import { FunctionsHttpError, type AuthError, type PostgrestError, type User as AuthUser } from '@supabase/supabase-js'
import { MIN_PASSWORD_LENGTH } from '../constants'
import { faresSavedFor } from '../logic/estimateFare'
import { SEARCH_RESULT_LIMIT, canSearch, normalizeSearch, optionalText } from '../logic/membership'
import { isNative } from '../native/platform'
import type {
  AccountDeletionJob,
  AccountDeletionPreview,
  AccountDeletionStatus,
  AdminFeedbackDetail,
  AdminFeedbackRow,
  Destination,
  Driver,
  DriverBackground,
  FeedbackAttachment,
  FeedbackMessage,
  FeedbackPerson,
  FeedbackStatusChange,
  FeedbackSummary,
  FeedbackWorkspace,
  FeedbackRating,
  House,
  Identity,
  Invitation,
  InvitationPreview,
  JoinRequest,
  MyJoinRequest,
  OfferStatus,
  OrgDiscoverability,
  OrgRole,
  OrganizationDirectoryEntry,
  OrganizationMember,
  OrganizationApplication,
  Organization,
  OrgType,
  ProductFeedback,
  ProductFeedbackPriority,
  ProductFeedbackStatus,
  ProductFeedbackType,
  RequestHours,
  Ride,
  RideEvent,
  RideEventDetail,
  RideEventKind,
  RideFeedback,
  RideOffer,
  RideStatus,
  RideType,
  User,
  UserRole,
  VerificationStatus,
  VolunteerProfile,
} from '../types'
import { interestsError, normalizeInterests } from '../volunteer/interests'
import {
  ALL_RIDES_LIMIT,
  type DataService,
  type DriverSettings,
  type FeedbackPage,
  type NewDriver,
  type NewDriverUser,
  type Registration,
  type Session,
  UnconfirmedEmailError,
} from './dataService'
import { getSupabase } from './supabaseClient'

// Real backend. Identity comes from Supabase Auth; the Relay Collective profile is looked up from it.
// Methods not built yet fail loudly instead of falling back to the local mock (guide Step 10).

// ---------------------------------------------------------------------------
// Rows and mapping (database snake_case -> app camelCase)
// ---------------------------------------------------------------------------

// profiles.email is not readable from the browser (see the access-policies migration),
// so always list columns instead of select('*').
const PROFILE_COLUMNS = 'id, name, phone, role, org_id, house_id, org_role'
const ORG_COLUMNS =
  'id, name, type, contact_name, contact_phone, booking_notifications, status, discoverability, directory_description, created_at, reviewed_at, reviewed_by'
const HOUSE_COLUMNS = 'id, org_id, name, address, city, phone'
// A volunteer profile with its interests, embedded through volunteer_interests' foreign key
const VOLUNTEER_COLUMNS = 'id, profile_id, created_at, updated_at, volunteer_interests(interest)'
const DRIVER_COLUMNS =
  'id, profile_id, org_id, background, vehicle, wheelchair_accessible, seats, service_cities, request_hours, status, created_at, reviewed_at, reviewed_by'
const DESTINATION_COLUMNS = 'id, org_id, name, address, city, notes'
const RIDE_COLUMNS = [
  'id, type, org_id, house_id, requested_by, rider_names, passengers, pickup_address, pickup_instructions',
  'destination_id, destination_name, destination_address, pickup_time, needs_wheelchair, needs_assistance, notes',
  'status, driver_id, preferred_driver_id, reconfirm_driver_id, return_of_ride_id, cancel_reason, expired',
  'estimated_fare_saved, dropped_by_driver_id, dropped_at, created_at, accepted_at, driver_on_the_way_at',
  'driver_eta, driver_arrived_at, picked_up_at, completed_at, cancelled_at, changed_at',
].join(', ')
const OFFER_COLUMNS = 'id, ride_id, driver_id, status, sent_at, expires_at, responded_at'
// Who made each change is kept as a name and role, so the browser never needs the actor's profile.
const EVENT_COLUMNS = 'id, ride_id, kind, actor_role, actor_name, detail, created_at'
const FEEDBACK_COLUMNS = 'id, ride_id, author_role, org_id, driver_id, rating, note, updated_at'
const APPLICATION_COLUMNS =
  'org_id, kind, website, description, contact_email, contact_role, service_categories, platform_interests, submitted_by, submitted_at'
// token_hash is not readable from the browser
const INVITATION_COLUMNS = 'id, org_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at'

interface VolunteerRow {
  id: string
  profile_id: string
  created_at: string
  updated_at: string
  volunteer_interests: { interest: string }[]
}

interface ProfileRow {
  id: string
  name: string
  phone: string | null
  role: UserRole
  org_id: string | null
  house_id: string | null
  org_role?: OrgRole | null
}

interface OrgRow {
  id: string
  name: string
  type: OrgType
  contact_name: string
  contact_phone: string
  booking_notifications: string | null
  status: VerificationStatus
  discoverability: OrgDiscoverability
  directory_description: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface HouseRow {
  id: string
  org_id: string
  name: string
  address: string
  city: string
  phone: string
}

interface DriverRow {
  id: string
  profile_id: string
  org_id: string | null
  background: DriverBackground
  vehicle: string
  wheelchair_accessible: boolean
  seats: number
  service_cities: string[]
  request_hours: RequestHours
  status: VerificationStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface DestinationRow {
  id: string
  org_id: string
  name: string
  address: string
  city: string
  notes: string | null
}

interface RideRow {
  id: string
  type: RideType
  org_id: string
  house_id: string
  requested_by: string
  rider_names: string[] | null
  passengers: number
  pickup_address: string
  pickup_instructions: string | null
  destination_id: string | null
  destination_name: string
  destination_address: string
  pickup_time: string
  needs_wheelchair: boolean
  needs_assistance: boolean
  notes: string | null
  status: RideStatus
  driver_id: string | null
  preferred_driver_id: string | null
  reconfirm_driver_id: string | null
  return_of_ride_id: string | null
  cancel_reason: string | null
  expired: boolean
  estimated_fare_saved: number | string
  dropped_by_driver_id: string | null
  dropped_at: string | null
  created_at: string
  accepted_at: string | null
  driver_on_the_way_at: string | null
  driver_eta: string | null
  driver_arrived_at: string | null
  picked_up_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  changed_at: string | null
}

interface OfferRow {
  id: string
  ride_id: string
  driver_id: string
  status: OfferStatus
  sent_at: string
  expires_at: string
  responded_at: string | null
}

interface RideEventRow {
  id: number
  ride_id: string
  kind: RideEventKind
  actor_role: UserRole | null
  actor_name: string | null
  detail: RideEventDetail | null
  created_at: string
}

interface FeedbackRow {
  id: string
  ride_id: string
  author_role: RideFeedback['authorRole']
  org_id: string
  driver_id: string | null
  rating: FeedbackRating | null
  note: string | null
  updated_at: string
}

interface ApplicationRow {
  org_id: string
  kind: OrganizationApplication['kind']
  website: string | null
  description: string
  contact_email: string
  contact_role: string
  service_categories: OrganizationApplication['serviceCategories']
  platform_interests: OrganizationApplication['platformInterests']
  submitted_by: string
  submitted_at: string
}

interface InvitationRow {
  id: string
  org_id: string
  email: string
  role: 'PARTNER'
  invited_by: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

// What the membership functions return (jsonb): camelCase already, nulls for missing values
type Nullable<T> = { [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K] }

function toMyJoinRequest(row: Nullable<MyJoinRequest>): MyJoinRequest {
  return {
    id: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    orgCity: row.orgCity ?? undefined,
    status: row.status,
    requestedPosition: row.requestedPosition ?? undefined,
    message: row.message ?? undefined,
    createdAt: iso(row.createdAt),
    reviewedAt: iso(row.reviewedAt),
    cancelledAt: iso(row.cancelledAt),
  }
}

function toJoinRequest(row: Nullable<JoinRequest>): JoinRequest {
  return {
    id: row.id,
    orgId: row.orgId,
    applicantName: row.applicantName,
    applicantEmail: row.applicantEmail,
    emailVerified: row.emailVerified,
    requestedPosition: row.requestedPosition ?? undefined,
    message: row.message ?? undefined,
    status: row.status,
    assignedRole: row.assignedRole ?? undefined,
    reviewNote: row.reviewNote ?? undefined,
    reviewedByName: row.reviewedByName ?? undefined,
    reviewedAt: iso(row.reviewedAt),
    createdAt: iso(row.createdAt),
  }
}

function toMember(row: Nullable<OrganizationMember>): OrganizationMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    role: row.role,
    status: row.status,
    joinedAt: iso(row.joinedAt),
    removedAt: iso(row.removedAt),
    isYou: row.isYou,
  }
}

async function readMyJoinRequests(): Promise<MyJoinRequest[]> {
  const { data, error } = await getSupabase().rpc('my_join_requests')
  if (error) fail(error, "We couldn't load your request.")
  return (data as Nullable<MyJoinRequest>[]).map(toMyJoinRequest)
}

// Postgres returns "2026-10-03 12:00:00+00"-style times; the app compares ISO strings like the mock's.
function iso(value: string): string
function iso(value: string | null): string | undefined
function iso(value: string | null): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

function toUser(row: ProfileRow, email?: string): User {
  return {
    id: row.id,
    name: row.name,
    email,
    phone: row.phone ?? '',
    role: row.role,
    orgId: row.org_id ?? undefined,
    houseId: row.house_id ?? undefined,
    orgRole: row.org_role ?? undefined,
  }
}

function toVolunteerProfile(row: VolunteerRow): VolunteerProfile {
  return {
    id: row.id,
    userId: row.profile_id,
    interests: normalizeInterests(row.volunteer_interests.map((i) => i.interest)),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

// Access rules return only the caller's own (or any, for platform admins)
async function readVolunteerProfile(profileId: string): Promise<VolunteerProfile | undefined> {
  const { data, error } = await getSupabase()
    .from('volunteer_profiles')
    .select(VOLUNTEER_COLUMNS)
    .eq('profile_id', profileId)
    .maybeSingle<VolunteerRow>()
  if (error) fail(error, "We couldn't load the volunteer profile.")
  return data ? toVolunteerProfile(data) : undefined
}

function toOrganization(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    bookingNotifications: row.booking_notifications ?? undefined,
    status: row.status,
    discoverability: row.discoverability,
    directoryDescription: row.directory_description ?? undefined,
    createdAt: iso(row.created_at),
    reviewedAt: iso(row.reviewed_at),
    reviewedBy: row.reviewed_by ?? undefined,
  }
}

function toHouse(row: HouseRow): House {
  return { id: row.id, orgId: row.org_id, name: row.name, address: row.address, city: row.city, phone: row.phone }
}

// Documents are uploaded separately (guide Step 13), so licenceFile/proofFile stay empty for now.
function toDriver(row: DriverRow): Driver {
  return {
    id: row.id,
    userId: row.profile_id,
    orgId: row.org_id ?? undefined,
    background: row.background,
    vehicle: row.vehicle,
    wheelchairAccessible: row.wheelchair_accessible,
    seats: row.seats,
    serviceCities: row.service_cities,
    requestHours: row.request_hours,
    status: row.status,
    createdAt: iso(row.created_at),
    reviewedAt: iso(row.reviewed_at),
    reviewedBy: row.reviewed_by ?? undefined,
  }
}

function toDestination(row: DestinationRow): Destination {
  return { id: row.id, orgId: row.org_id, name: row.name, address: row.address, city: row.city, notes: row.notes ?? undefined }
}

function toRide(row: RideRow): Ride {
  return {
    id: row.id,
    type: row.type,
    orgId: row.org_id,
    houseId: row.house_id,
    requestedBy: row.requested_by,
    riderNames: row.rider_names ?? undefined,
    passengers: row.passengers,
    pickupAddress: row.pickup_address,
    pickupInstructions: row.pickup_instructions ?? undefined,
    destinationId: row.destination_id ?? undefined,
    destinationName: row.destination_name,
    destinationAddress: row.destination_address,
    pickupTime: iso(row.pickup_time),
    needsWheelchair: row.needs_wheelchair,
    needsAssistance: row.needs_assistance,
    notes: row.notes ?? undefined,
    status: row.status,
    driverId: row.driver_id ?? undefined,
    preferredDriverId: row.preferred_driver_id ?? undefined,
    reconfirmDriverId: row.reconfirm_driver_id ?? undefined,
    returnOfRideId: row.return_of_ride_id ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    expired: row.expired || undefined,
    estimatedFareSaved: Number(row.estimated_fare_saved),
    droppedBy: row.dropped_by_driver_id && row.dropped_at ? { driverId: row.dropped_by_driver_id, at: iso(row.dropped_at) } : undefined,
    createdAt: iso(row.created_at),
    acceptedAt: iso(row.accepted_at),
    driverOnTheWayAt: iso(row.driver_on_the_way_at),
    driverEta: iso(row.driver_eta),
    driverArrivedAt: iso(row.driver_arrived_at),
    pickedUpAt: iso(row.picked_up_at),
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    changedAt: iso(row.changed_at),
  }
}

function toOffer(row: OfferRow): RideOffer {
  return {
    id: row.id,
    rideId: row.ride_id,
    driverId: row.driver_id,
    status: row.status,
    sentAt: iso(row.sent_at),
    expiresAt: iso(row.expires_at),
    respondedAt: iso(row.responded_at),
  }
}

function toRideEvent(row: RideEventRow): RideEvent {
  const detail = row.detail ?? undefined
  return {
    id: String(row.id),
    rideId: row.ride_id,
    kind: row.kind,
    at: iso(row.created_at),
    actorRole: row.actor_role ?? undefined,
    actorName: row.actor_name ?? undefined,
    // Times inside the detail come from Postgres too
    detail: detail && {
      ...detail,
      fromPickupTime: iso(detail.fromPickupTime ?? null),
      toPickupTime: iso(detail.toPickupTime ?? null),
      eta: iso(detail.eta ?? null),
    },
  }
}

function toFeedback(row: FeedbackRow): RideFeedback {
  return {
    id: row.id,
    rideId: row.ride_id,
    authorRole: row.author_role,
    orgId: row.org_id,
    driverId: row.driver_id ?? undefined,
    rating: row.rating ?? undefined,
    note: row.note ?? undefined,
    at: iso(row.updated_at),
  }
}

function toApplication(row: ApplicationRow): OrganizationApplication {
  return {
    orgId: row.org_id,
    kind: row.kind,
    website: row.website ?? undefined,
    description: row.description,
    contactEmail: row.contact_email,
    contactRole: row.contact_role,
    serviceCategories: row.service_categories,
    platformInterests: row.platform_interests,
    submittedBy: row.submitted_by,
    submittedAt: iso(row.submitted_at),
  }
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    acceptedAt: iso(row.accepted_at),
    revokedAt: iso(row.revoked_at),
  }
}

async function readFeedback(query: PromiseLike<{ data: FeedbackRow[] | null; error: PostgrestError | null }>): Promise<RideFeedback[]> {
  const { data, error } = await query
  if (error) fail(error, "We couldn't load feedback.")
  return (data ?? []).map(toFeedback)
}

// The only driver columns the browser may change (matches the column grant in the policies migration).
const DRIVER_SETTING_COLUMNS: Record<keyof DriverSettings, string> = {
  vehicle: 'vehicle',
  seats: 'seats',
  wheelchairAccessible: 'wheelchair_accessible',
  serviceCities: 'service_cities',
  requestHours: 'request_hours',
}

// What the database functions read when building a driver (see private.insert_driver).
function driverDetails(user: NewDriverUser, driver: NewDriver) {
  return {
    name: user.name,
    phone: user.phone,
    background: driver.background,
    vehicle: driver.vehicle,
    seats: driver.seats,
    wheelchairAccessible: driver.wheelchairAccessible,
    serviceCities: driver.serviceCities,
    requestHours: driver.requestHours,
  }
}

// ---------------------------------------------------------------------------
// Feedback & Suggestions
// ---------------------------------------------------------------------------

// What a submitter may read of their own feedback (matches the column grants in the product feedback migration)
const PRODUCT_FEEDBACK_COLUMNS =
  'id, reference, feedback_type, title, description, source_page, source_workspace, related_release, status, created_at, updated_at, resolved_at'
const FEEDBACK_ATTACHMENT_COLUMNS = 'id, storage_path, file_name, mime_type, file_size, uploaded_at'
const FEEDBACK_BUCKET = 'feedback-attachments'
// Long enough to load the image, short enough that a copied link soon stops working
const SCREENSHOT_LINK_SECONDS = 300

interface ProductFeedbackRow {
  id: string
  reference: number | string
  feedback_type: ProductFeedbackType
  title: string
  description: string
  source_page: string | null
  source_workspace: FeedbackWorkspace
  related_release: string | null
  status: ProductFeedbackStatus
  created_at: string
  updated_at: string
  resolved_at: string | null
}

interface FeedbackAttachmentRow {
  id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  uploaded_at: string | null
}

// The admin functions answer in JSON, already camelCase; only times and nulls need care
interface AdminFeedbackJson extends Omit<AdminFeedbackRow, 'sourcePage' | 'relatedRelease' | 'resolvedAt' | 'priority' | 'organization' | 'assignedTo'> {
  sourcePage: string | null
  relatedRelease: string | null
  resolvedAt: string | null
  priority: ProductFeedbackPriority | null
  organization: FeedbackPerson | null
  assignedTo: FeedbackPerson | null
}

interface AdminFeedbackDetailJson extends AdminFeedbackJson {
  description: string
  submittedBy: AdminFeedbackDetail['submittedBy'] & { email: string | null }
  attachment: (Omit<FeedbackAttachment, 'uploadedAt'> & { uploadedAt: string | null }) | null
  messages: (Omit<FeedbackMessage, 'authorName'> & { authorName: string | null })[]
  history: { id: string; previousStatus: ProductFeedbackStatus | null; newStatus: ProductFeedbackStatus; changedAt: string; changedByName: string | null }[]
}

function toProductFeedback(row: ProductFeedbackRow): ProductFeedback {
  return {
    id: row.id,
    reference: Number(row.reference),
    feedbackType: row.feedback_type,
    title: row.title,
    description: row.description,
    sourcePage: row.source_page ?? undefined,
    sourceWorkspace: row.source_workspace,
    relatedRelease: row.related_release ?? undefined,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    resolvedAt: iso(row.resolved_at),
  }
}

function toFeedbackAttachment(row: FeedbackAttachmentRow): FeedbackAttachment {
  return {
    id: row.id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedAt: iso(row.uploaded_at),
  }
}

function toAdminFeedbackRow(row: AdminFeedbackJson): AdminFeedbackRow {
  return {
    ...row,
    reference: Number(row.reference),
    sourcePage: row.sourcePage ?? undefined,
    relatedRelease: row.relatedRelease ?? undefined,
    priority: row.priority ?? undefined,
    organization: row.organization ?? undefined,
    assignedTo: row.assignedTo ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    resolvedAt: iso(row.resolvedAt),
  }
}

function toAdminFeedbackDetail(row: AdminFeedbackDetailJson): AdminFeedbackDetail {
  const { hasAttachment, ...base } = toAdminFeedbackRow(row)
  void hasAttachment
  return {
    ...base,
    description: row.description,
    submittedBy: { ...row.submittedBy, email: row.submittedBy.email ?? undefined },
    attachment: row.attachment ? { ...row.attachment, uploadedAt: iso(row.attachment.uploadedAt) } : undefined,
    messages: row.messages.map((m) => ({ ...m, createdAt: iso(m.createdAt), authorName: m.authorName ?? undefined })),
    history: row.history.map(
      (h): FeedbackStatusChange => ({
        id: h.id,
        previousStatus: h.previousStatus ?? undefined,
        newStatus: h.newStatus,
        changedAt: iso(h.changedAt),
        changedByName: h.changedByName ?? undefined,
      }),
    ),
  }
}

// The signed-in person's profile id. Admins can read everyone's feedback, so "mine" has to be asked for.
async function myProfileId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const row = data.session ? await queryProfile(data.session.user.id) : null
  if (!row) throw new Error('Please sign in to see your feedback.')
  return row.id
}

async function readProductFeedback(feedbackId: string): Promise<ProductFeedback> {
  const { data, error } = await getSupabase()
    .from('feedback_submissions')
    .select(PRODUCT_FEEDBACK_COLUMNS)
    .eq('id', feedbackId)
    .single<ProductFeedbackRow>()
  if (error) fail(error, "We couldn't load your feedback.")
  return toProductFeedback(data)
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const CONNECTION = 'Check your connection and try again.'

// Our database functions raise P0001 with a message written for people; anything else gets the fallback.
function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.code === 'P0001' ? error.message : `${fallback} ${CONNECTION}`)
}

function ridesQuery() {
  return getSupabase().from('rides').select(RIDE_COLUMNS)
}

async function readRides(query: PromiseLike<{ data: RideRow[] | null; error: PostgrestError | null }>): Promise<Ride[]> {
  const { data, error } = await query
  if (error) fail(error, "We couldn't load rides.")
  return (data ?? []).map(toRide)
}

function signInMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return "That email and password don't match. Please try again."
    case 'email_not_confirmed':
      return 'Please confirm your email first. Check your inbox for the link we sent.'
    default:
      return `We couldn't sign you in right now. ${CONNECTION}`
  }
}

const EMAIL_TAKEN = 'An account with this email already exists. Try signing in instead.'

function signUpMessage(error: AuthError): string {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return EMAIL_TAKEN
    case 'weak_password':
      return 'Please choose a stronger password.'
    case 'email_address_invalid':
      return "That email address can't be used. Please check it."
    // Supabase's built-in test mailer only sends to the project team. Needs real email (SMTP) set up for everyone else.
    case 'email_address_not_authorized':
      return "We can't send a confirmation email to that address yet. Please contact Relay Collective."
    case 'over_email_send_rate_limit':
      return 'Too many sign-up emails were sent recently. Please wait a while and try again.'
    case 'signup_disabled':
      return "New sign-ups are turned off right now. Please contact Relay Collective."
    default:
      return `We couldn't create your account. ${CONNECTION}`
  }
}

// ---------------------------------------------------------------------------
// Session and onboarding
// ---------------------------------------------------------------------------

const ACCOUNT_UNAVAILABLE =
  "This login doesn't have an active Relay Collective account. If you think this is a mistake, contact Relay Collective."

async function queryProfile(authUserId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle<ProfileRow>()
  if (error) fail(error, "We couldn't load your Relay Collective account.")
  return data
}

function toIdentity(authUser: AuthUser): Identity {
  const email = authUser.email ?? ''
  const name = typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name.trim() : ''
  return { id: authUser.id, email, name: name || email.split('@')[0] }
}

// The session for a login: its identity, plus its Relay Collective profile once onboarding has made one.
// A sign-up from before identity-first onboarding carries its form in metadata: finish it here. Safe to repeat.
async function loadSession(authUser: AuthUser): Promise<Session> {
  const identity = toIdentity(authUser)
  let row = await queryProfile(authUser.id)
  if (!row && authUser.user_metadata?.careride_onboarding) {
    const { error } = await getSupabase().rpc('complete_onboarding')
    if (error) fail(error, "We couldn't finish setting up your account.")
    row = await queryProfile(authUser.id)
  }
  if (row) return { identity, user: toUser(row, authUser.email) }

  // Access rules hide a closed account's profile the same way as a missing one: ask which it is.
  const { data: state, error } = await getSupabase().rpc('my_account_state')
  if (error) fail(error, "We couldn't load your Relay Collective account.")
  if (state === 'NONE') return { identity } // a new identity: onboarding comes next
  // Closed (or otherwise unusable). Don't leave a half-signed-in session.
  await getSupabase().auth.signOut({ scope: 'local' })
  throw new Error(ACCOUNT_UNAVAILABLE)
}

async function requireUser(authUser: AuthUser | null | undefined): Promise<User> {
  if (!authUser) throw new Error('Please sign in first.')
  const { user } = await loadSession(authUser)
  if (!user) throw new Error("We couldn't load your new account. Please refresh the page.")
  return user
}

async function currentAuthUser(): Promise<AuthUser | null> {
  const { data } = await getSupabase().auth.getSession()
  return data.session?.user ?? null
}

// Where the confirmation link lands. /welcome finishes signing in and sends people on (see AuthLanding).
function confirmRedirect(next?: string): string | undefined {
  const site = siteUrl()
  if (!site) return undefined
  return next ? `${site}/welcome?next=${encodeURIComponent(next)}` : `${site}/welcome`
}

// Legacy one-step sign-up: the login with the whole form attached. complete_onboarding() turns it into records.
async function signUp(email: string, password: string, details: Record<string, unknown>): Promise<Registration> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { careride_onboarding: details }, emailRedirectTo: confirmRedirect() },
  })
  if (error) throw new Error(signUpMessage(error))
  if (data.user && data.user.identities?.length === 0) throw new Error(EMAIL_TAKEN)
  if (!data.session || !data.user) return { status: 'CONFIRM_EMAIL', email: email.trim() }
  return { status: 'SIGNED_IN', user: await requireUser(data.user) }
}

// Every ride change goes through a database function that locks the ride and returns its new state.
async function rideCall(fn: string, args: Record<string, unknown>, fallback: string): Promise<Ride> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) fail(error, fallback)
  return toRide(data as RideRow)
}

// The ride fields a partner sends; the database derives the rest (org, location, requester, fare, status, times).
function rideDetails(ride: Partial<Ride>) {
  return {
    type: ride.type,
    pickupTime: ride.pickupTime,
    passengers: ride.passengers,
    riderNames: ride.riderNames ?? [],
    needsWheelchair: ride.needsWheelchair,
    needsAssistance: ride.needsAssistance,
    pickupInstructions: ride.pickupInstructions ?? null,
    notes: ride.notes ?? null,
    destinationId: ride.destinationId ?? null,
    destinationName: ride.destinationName,
    destinationAddress: ride.destinationAddress,
  }
}

// Tables whose changes should refresh open screens. Realtime only sends rows this person may read.
const LIVE_TABLES = ['rides', 'ride_offers', 'organizations', 'drivers', 'destinations', 'profiles', 'organization_join_requests']

// The website that email links (confirm, reset password) open. On the website that's wherever the person is,
// so localhost and the live site both work. The Android app's own address is https://localhost, which a
// link can't open, so app builds use VITE_PUBLIC_SITE_URL instead. Each address must be allowed under
// Supabase Auth > URL Configuration > Redirect URLs.
function siteUrl(): string | undefined {
  if (!isNative) return window.location.origin
  return import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || undefined
}

function resetPasswordUrl(): string {
  const site = siteUrl()
  if (!site) throw new Error("This app can't send reset links yet. Reset your password on the Relay Collective website instead.")
  return `${site}/reset-password`
}

function passwordMessage(error: AuthError): string {
  switch (error.code) {
    case 'weak_password':
      return 'Please choose a stronger password.'
    case 'same_password':
      return 'Choose a password you haven’t used for this account before.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many reset emails were sent recently. Please wait a while and try again.'
    case 'email_address_not_authorized':
      return "We can't send email to that address yet. Please contact Relay Collective."
    default:
      return `That didn't work. ${CONNECTION}`
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

// A deletion job as the database functions return it (camelCase already; missing values are null)
type DeletionJobRow = { [K in keyof AccountDeletionJob]-?: AccountDeletionJob[K] | null }

function toDeletionJob(row: DeletionJobRow): AccountDeletionJob {
  return {
    id: row.id!,
    profileId: row.profileId!,
    status: row.status!,
    step: row.step!,
    errorCode: row.errorCode ?? undefined,
    attempts: row.attempts ?? 1,
    plan: row.plan ?? [],
    startedAt: row.startedAt!,
    updatedAt: row.updatedAt!,
    completedAt: row.completedAt ?? undefined,
    failedAt: row.failedAt ?? undefined,
  }
}

// The Edge Function answers with the job however it went, or an error written for people
async function runAccountDeletion(body: Record<string, string>): Promise<AccountDeletionJob> {
  const { data, error } = await getSupabase().functions.invoke('admin-delete-account', { body })
  if (!error) return toDeletionJob((data as { job: DeletionJobRow }).job)
  if (error instanceof FunctionsHttpError) {
    const answer = (await error.context.json().catch(() => ({}))) as { error?: string }
    throw new Error(answer.error ?? "We couldn't delete this account. Please try again.")
  }
  throw new Error(`We couldn't reach Relay Collective to delete this account. ${CONNECTION}`)
}

export const supabaseService: DataService = {
  async restoreSession() {
    const { data, error } = await getSupabase().auth.getSession()
    if (error) throw new Error(`We couldn't check your sign-in. ${CONNECTION}`)
    return data.session ? loadSession(data.session.user) : undefined
  },

  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      if (error.code === 'email_not_confirmed') throw new UnconfirmedEmailError(signInMessage(error))
      throw new Error(signInMessage(error))
    }
    return loadSession(data.user)
  },

  async signOut() {
    // 'local' signs out this browser only, not the person's other devices.
    const { error } = await getSupabase().auth.signOut({ scope: 'local' })
    if (error) throw new Error("We couldn't sign you out. Please try again.")
  },

  onSessionChange(listener) {
    let lastUserId: string | undefined
    // Keep this callback light: no awaiting other Auth calls inside it. The app reloads the profile itself.
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id
      if (event === 'INITIAL_SESSION') {
        lastUserId = userId // restoreSession already handled the starting session
        return
      }
      // Token refreshes keep the same person; only a different (or no) person needs a reload.
      if (userId === lastUserId) return
      lastUserId = userId
      setTimeout(listener, 0)
    })
    return () => data.subscription.unsubscribe()
  },

  onDataChange(listener) {
    const supabase = getSupabase()
    let connectedBefore = false
    // A unique name, so React's double effects in development never share a channel
    const channel = supabase.channel(`careride-changes-${crypto.randomUUID()}`)
    for (const table of LIVE_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => listener())
    }
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      // Reconnected after a drop: reload in case something changed while we weren't listening
      if (connectedBefore) listener()
      connectedBefore = true
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  },

  // Always looks the same whether or not the email has an account, so nobody can probe who uses Relay Collective.
  async requestPasswordReset(email) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: resetPasswordUrl() })
    if (error && error.code !== 'user_not_found') throw new Error(passwordMessage(error))
  },

  async updatePassword(newPassword) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    const { error } = await getSupabase().auth.updateUser({ password: newPassword })
    if (error) throw new Error(passwordMessage(error))
  },

  async signUp(account) {
    const email = account.email.trim()
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: account.password,
      options: { data: { full_name: account.name.trim() }, emailRedirectTo: confirmRedirect(account.next) },
    })
    if (error) {
      // Only reachable with email confirmation off, where Auth can't hide a taken email. Stay neutral anyway.
      if (error.code === 'user_already_exists' || error.code === 'email_exists') {
        throw new Error("We couldn't create an account with that email. If you've signed up before, sign in or reset your password.")
      }
      throw new Error(signUpMessage(error))
    }
    // With confirmation on, Auth answers a taken email with a user that has no identities and sends nothing.
    // Treat it like any other sign-up ("check your email"), so the form can't tell anyone who has an account.
    if (!data.session || !data.user || data.user.identities?.length === 0) return { status: 'CONFIRM_EMAIL', email }
    return { status: 'SIGNED_IN', identity: toIdentity(data.user) }
  },

  async resendVerification(email) {
    const { error } = await getSupabase().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmRedirect() } })
    if (error && error.code !== 'user_not_found') throw new Error(passwordMessage(error))
  },

  async submitOrganizationApplication(app) {
    const { error } = await getSupabase().rpc('submit_organization_application', {
      p_details: {
        orgName: app.orgName,
        kind: app.kind,
        website: app.website ?? null,
        description: app.description,
        address: app.address,
        city: app.city,
        contactName: app.contactName,
        contactEmail: app.contactEmail,
        contactPhone: app.contactPhone,
        contactRole: app.contactRole,
        serviceCategories: app.serviceCategories,
        platformInterests: app.platformInterests,
      },
    })
    if (error) {
      if (error.code === '23514') throw new Error('Please check your organization details and try again.')
      fail(error, "We couldn't submit your application.")
    }
    return requireUser(await currentAuthUser())
  },

  async registerDriverProfile(user, driver) {
    const { error } = await getSupabase().rpc('register_driver_profile', { p_details: driverDetails(user, driver) })
    if (error) {
      if (error.code === '23514') throw new Error('Please check your details and try again.')
      fail(error, "We couldn't create your driver account.")
    }
    return requireUser(await currentAuthUser())
  },

  async registerVolunteer(volunteer) {
    const problem = interestsError(volunteer.interests)
    if (problem) throw new Error(problem)
    const { error } = await getSupabase().rpc('register_volunteer', {
      p_details: { name: volunteer.name.trim(), phone: volunteer.phone?.trim() ?? '', interests: normalizeInterests(volunteer.interests) },
    })
    if (error) {
      if (error.code === '23514') throw new Error('Please check your details and try again.')
      fail(error, "We couldn't create your volunteer profile.")
    }
    return requireUser(await currentAuthUser())
  },

  getVolunteerProfile: (userId) => readVolunteerProfile(userId),

  async updateMyVolunteerInterests(interests) {
    const problem = interestsError(interests)
    if (problem) throw new Error(problem)
    const { error } = await getSupabase().rpc('set_my_volunteer_interests', { p_interests: normalizeInterests(interests) })
    if (error) fail(error, "We couldn't save your interests.")
    const user = await requireUser(await currentAuthUser())
    const saved = await readVolunteerProfile(user.id)
    if (!saved) throw new Error("We couldn't load your interests. Please refresh the page.")
    return saved
  },

  async getOrganizationApplication(orgId) {
    const { data, error } = await getSupabase()
      .from('organization_applications')
      .select(APPLICATION_COLUMNS)
      .eq('org_id', orgId)
      .maybeSingle<ApplicationRow>()
    if (error) fail(error, "We couldn't load the application.")
    return data ? toApplication(data) : undefined
  },

  async createInvitation(email) {
    const { data, error } = await getSupabase().rpc('create_invitation', { p_email: email.trim() })
    if (error) fail(error, "We couldn't create the invitation.")
    const created = data as { id: string; token: string }
    const { data: row, error: readError } = await getSupabase()
      .from('organization_invitations')
      .select(INVITATION_COLUMNS)
      .eq('id', created.id)
      .single<InvitationRow>()
    if (readError) fail(readError, 'The invitation was created, but we couldn’t load it.')
    return { invitation: toInvitation(row), token: created.token }
  },

  async listInvitations() {
    const { data, error } = await getSupabase()
      .from('organization_invitations')
      .select(INVITATION_COLUMNS)
      .order('created_at', { ascending: false })
      .returns<InvitationRow[]>()
    if (error) fail(error, "We couldn't load invitations.")
    return data.map(toInvitation)
  },

  async revokeInvitation(invitationId) {
    const { error } = await getSupabase().rpc('revoke_invitation', { p_invitation_id: invitationId })
    if (error) fail(error, "We couldn't withdraw the invitation.")
  },

  async previewInvitation(token) {
    const { data, error } = await getSupabase().rpc('get_invitation', { p_token: token })
    if (error) fail(error, "We couldn't check this invitation.")
    const preview = data as InvitationPreview
    return { ...preview, expiresAt: preview.expiresAt ? iso(preview.expiresAt) : undefined }
  },

  async acceptInvitation(token) {
    const { error } = await getSupabase().rpc('accept_invitation', { p_token: token })
    if (error) fail(error, "We couldn't accept the invitation.")
    return requireUser(await currentAuthUser())
  },

  async searchOrganizations(query) {
    const q = normalizeSearch(query)
    if (!canSearch(q)) return []
    const { data, error } = await getSupabase().rpc('search_organizations', { p_query: q, p_limit: SEARCH_RESULT_LIMIT })
    if (error) fail(error, "We couldn't search organizations.")
    return (data as Nullable<OrganizationDirectoryEntry>[]).map((o) => ({
      id: o.id,
      name: o.name,
      city: o.city ?? undefined,
      description: o.description ?? undefined,
    }))
  },

  async submitJoinRequest({ orgId, requestedPosition, message }) {
    const { data, error } = await getSupabase().rpc('submit_join_request', {
      p_org_id: orgId,
      p_position: optionalText(requestedPosition) ?? null,
      p_message: optionalText(message) ?? null,
    })
    if (error) {
      if (error.code === '23514') throw new Error('Please check your request and try again.')
      fail(error, "We couldn't send your request.")
    }
    const sent = (await readMyJoinRequests()).find((r) => r.id === data)
    if (!sent) throw new Error('Your request was sent, but we couldn’t load it. Please refresh the page.')
    return sent
  },

  listMyJoinRequests: readMyJoinRequests,

  async cancelJoinRequest(requestId) {
    const { error } = await getSupabase().rpc('cancel_join_request', { p_request_id: requestId })
    if (error) fail(error, "We couldn't withdraw your request.")
  },

  async listJoinRequests(status) {
    const { data, error } = await getSupabase().rpc('list_join_requests', { p_status: status })
    if (error) fail(error, "We couldn't load requests to join.")
    return (data as Nullable<JoinRequest>[]).map(toJoinRequest)
  },

  async approveJoinRequest(requestId, role) {
    const { error } = await getSupabase().rpc('approve_join_request', { p_request_id: requestId, p_role: role })
    if (error) fail(error, "We couldn't approve this request.")
  },

  async rejectJoinRequest(requestId, note) {
    const { error } = await getSupabase().rpc('reject_join_request', { p_request_id: requestId, p_note: optionalText(note) ?? null })
    if (error) fail(error, "We couldn't decline this request.")
  },

  async listOrganizationMembers(includeFormer = false) {
    const { data, error } = await getSupabase().rpc('list_organization_members', { p_include_former: includeFormer })
    if (error) fail(error, "We couldn't load your team.")
    return (data as Nullable<OrganizationMember>[]).map(toMember)
  },

  async setMemberRole(profileId, role) {
    const { error } = await getSupabase().rpc('set_member_role', { p_profile_id: profileId, p_role: role })
    if (error) fail(error, "We couldn't change this member's role.")
  },

  async removeMember(profileId) {
    const { error } = await getSupabase().rpc('remove_member', { p_profile_id: profileId })
    if (error) fail(error, "We couldn't remove this member.")
  },

  async setOrganizationVisibility(discoverability, description) {
    const { error } = await getSupabase().rpc('set_organization_visibility', {
      p_discoverability: discoverability,
      p_description: optionalText(description) ?? null,
    })
    if (error) {
      if (error.code === '23514') throw new Error('Please check the description and try again.')
      fail(error, "We couldn't save your organization's visibility.")
    }
  },

  // Only the profiles this caller may see (access rules decide). Emails are never included.
  async listUsers() {
    const { data, error } = await getSupabase().from('profiles').select(PROFILE_COLUMNS).order('name').returns<ProfileRow[]>()
    if (error) fail(error, "We couldn't load accounts.")
    return data.map((row) => toUser(row))
  },

  // Auth reports a taken email at sign-up; a public "is this email registered?" check would leak who uses Relay Collective.
  isEmailAvailable: () => Promise.resolve(true),

  registerOrganization(org, account, location, destinations = []) {
    if (org.type !== 'PARTNER_ORG') {
      return Promise.reject(new Error('Only partner organizations can register right now.'))
    }
    if (!location) return Promise.reject(new Error('Add the address where rides start.'))
    return signUp(account.email, account.password, {
      role: 'PARTNER',
      orgName: org.name,
      contactName: org.contactName,
      contactPhone: org.contactPhone,
      address: location.address,
      city: location.city,
      destinations: destinations.map(({ name, address, city }) => ({ name, address, city })),
    })
  },

  async listOrganizations() {
    const { data, error } = await getSupabase().from('organizations').select(ORG_COLUMNS).order('name').returns<OrgRow[]>()
    if (error) fail(error, "We couldn't load organizations.")
    return data.map(toOrganization)
  },

  async listHouses(orgId) {
    let query = getSupabase().from('houses').select(HOUSE_COLUMNS).order('name')
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query.returns<HouseRow[]>()
    if (error) fail(error, "We couldn't load locations.")
    return data.map(toHouse)
  },

  registerDriver(user, driver, login) {
    return signUp(login.email, login.password, { role: 'DRIVER', ...driverDetails(user, driver) })
  },

  async addOrgDriver(user, driver) {
    const supabase = getSupabase()
    const { data: driverId, error } = await supabase.rpc('add_org_driver', { p_details: driverDetails(user, driver) })
    if (error) fail(error, "We couldn't add this driver.")
    const { data, error: readError } = await supabase.from('drivers').select(DRIVER_COLUMNS).eq('id', driverId).single<DriverRow>()
    if (readError) fail(readError, 'The driver was added, but we couldn’t load them.')
    return toDriver(data)
  },

  // Anonymous rows: the preview only needs to know what kinds of drivers exist, not who they are.
  async listDriverPool() {
    const { data, error } = await getSupabase().rpc('booking_driver_pool')
    if (error) fail(error, "We couldn't check which drivers are available.")
    type PoolRow = Pick<DriverRow, 'seats' | 'wheelchair_accessible' | 'service_cities' | 'request_hours'>
    return (data as PoolRow[]).map((row, i) =>
      toDriver({ ...row, id: `pool-${i}`, profile_id: '', org_id: null, background: 'INDEPENDENT', vehicle: '', status: 'APPROVED', created_at: '', reviewed_at: null, reviewed_by: null }),
    )
  },

  async listDrivers(orgId) {
    // Erased drivers (a deleted account) stay in the table only for finished rides to point at
    let query = getSupabase().from('drivers').select(DRIVER_COLUMNS).is('deleted_at', null).order('created_at')
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query.returns<DriverRow[]>()
    if (error) fail(error, "We couldn't load drivers.")
    return data.map(toDriver)
  },

  async updateDriver(driverId, changes) {
    const patch: Record<string, unknown> = {}
    for (const [key, column] of Object.entries(DRIVER_SETTING_COLUMNS)) {
      const value = changes[key as keyof DriverSettings]
      if (value !== undefined) patch[column] = value
    }
    const { data, error } = await getSupabase()
      .from('drivers')
      .update(patch)
      .eq('id', driverId)
      .select(DRIVER_COLUMNS)
      .maybeSingle<DriverRow>()
    if (error) {
      // 23514: a table check failed (seats, cities, vehicle). Request-hour problems arrive as P0001 with their own message.
      if (error.code === '23514') throw new Error('Please check your settings and try again.')
      fail(error, "We couldn't save your settings.")
    }
    if (!data) throw new Error('You can only change your own driver settings.')
    return toDriver(data)
  },

  async listPending() {
    const supabase = getSupabase()
    const [orgs, drivers] = await Promise.all([
      supabase.from('organizations').select(ORG_COLUMNS).eq('status', 'PENDING').order('created_at').returns<OrgRow[]>(),
      supabase.from('drivers').select(DRIVER_COLUMNS).eq('status', 'PENDING').is('deleted_at', null).order('created_at').returns<DriverRow[]>(),
    ])
    if (orgs.error) fail(orgs.error, "We couldn't load organizations waiting for review.")
    if (drivers.error) fail(drivers.error, "We couldn't load drivers waiting for review.")
    return { orgs: orgs.data.map(toOrganization), drivers: drivers.data.map(toDriver) }
  },

  async setOrgStatus(orgId, status) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('review_organization', { p_org_id: orgId, p_status: status })
    if (error) fail(error, "We couldn't save that review.")
    const { data, error: readError } = await supabase.from('organizations').select(ORG_COLUMNS).eq('id', orgId).single<OrgRow>()
    if (readError) fail(readError, 'The review was saved, but we couldn’t reload the organization.')
    return toOrganization(data)
  },

  async setDriverStatus(driverId, status) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('review_driver', { p_driver_id: driverId, p_status: status })
    if (error) fail(error, "We couldn't save that review.")
    const { data, error: readError } = await supabase.from('drivers').select(DRIVER_COLUMNS).eq('id', driverId).single<DriverRow>()
    if (readError) fail(readError, 'The review was saved, but we couldn’t reload the driver.')
    return toDriver(data)
  },

  // Admin only (checked in the database). Includes login emails, which no other read exposes.
  async listAccounts() {
    const { data, error } = await getSupabase().rpc('admin_list_accounts')
    if (error) fail(error, "We couldn't load accounts.")
    return (data as (ProfileRow & { email: string | null; deletion_status: AccountDeletionStatus | null })[]).map((row) => ({
      ...toUser(row, row.email ?? undefined),
      deletionStatus: row.deletion_status ?? undefined,
    }))
  },

  // Emails the person a link to choose a new password. Nobody else ever sees or sets it.
  async resetPassword(userId) {
    const accounts = await supabaseService.listAccounts() // admin-only, checked by the database
    const email = accounts.find((u) => u.id === userId)?.email
    if (!email) throw new Error("This account doesn't have a sign-in.")
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: resetPasswordUrl() })
    if (error) throw new Error(passwordMessage(error))
    return { kind: 'EMAIL_SENT', email }
  },

  // Admin only, checked in the database. Counts come from the data as it is now.
  async previewAccountDeletion(userId) {
    const { data, error } = await getSupabase().rpc('admin_account_deletion_preview', { p_profile_id: userId })
    if (error) fail(error, "We couldn't check what deleting this account would do.")
    const row = data as Omit<AccountDeletionPreview, 'job'> & { job?: DeletionJobRow | null; email?: string | null; name?: string | null; orgName?: string | null }
    return {
      ...row,
      name: row.name ?? undefined,
      email: row.email ?? undefined,
      orgName: row.orgName ?? undefined,
      job: row.job ? toDeletionJob(row.job) : undefined,
    }
  },

  // Server-side: the admin-delete-account Edge Function checks the admin's password, then runs the job.
  startAccountDeletion(userId, { email, password }) {
    return runAccountDeletion({ action: 'start', profileId: userId, confirmEmail: email, password })
  },

  retryAccountDeletion(jobId, password) {
    return runAccountDeletion({ action: 'retry', jobId, password })
  },

  async getAccountDeletion(jobId) {
    const { data, error } = await getSupabase().rpc('admin_get_account_deletion', { p_job_id: jobId })
    if (error) fail(error, "We couldn't check on this deletion.")
    return data ? toDeletionJob(data as DeletionJobRow) : undefined
  },

  // Server-side: delete-my-account switches this driver or partner off, then removes their login.
  async deleteMyAccount() {
    const { error } = await getSupabase().functions.invoke('delete-my-account', { body: {} })
    if (!error) return
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? "We couldn't close this account. Please try again.")
    }
    throw new Error(`We couldn't close this account. ${CONNECTION}`)
  },

  async listDestinations(orgId) {
    let query = getSupabase().from('destinations').select(DESTINATION_COLUMNS).order('name')
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query.returns<DestinationRow[]>()
    if (error) fail(error, "We couldn't load saved destinations.")
    return data.map(toDestination)
  },

  async saveDestination(dest) {
    const { data, error } = await getSupabase()
      .from('destinations')
      .insert({ org_id: dest.orgId, name: dest.name.trim(), address: dest.address.trim(), city: dest.city.trim(), notes: dest.notes?.trim() || null })
      .select(DESTINATION_COLUMNS)
      .single<DestinationRow>()
    if (error) {
      // 42501: the access rules refused it (not this org's partner account)
      // 23514: a table check failed (blank/long name, short address, unknown city, long notes)
      if (error.code === '42501') throw new Error('Only your organization can add its destinations.')
      if (error.code === '23514') throw new Error('Please check the name, address, city and notes, then try again.')
      throw new Error(`We couldn't save this destination. ${CONNECTION}`)
    }
    return toDestination(data)
  },

  async updateDestination(id, changes) {
    const { data, error } = await getSupabase()
      .from('destinations')
      .update({
        name: changes.name.trim(),
        address: changes.address.trim(),
        city: changes.city.trim(),
        notes: changes.notes?.trim() || null,
      })
      .eq('id', id)
      .select(DESTINATION_COLUMNS)
      .single<DestinationRow>()
    if (error) {
      if (error.code === '42501' || error.code === 'PGRST116') throw new Error('Only your organization can change its destinations.')
      if (error.code === '23514') throw new Error('Please check the name, address, city and notes, then try again.')
      throw new Error(`We couldn't save this destination. ${CONNECTION}`)
    }
    return toDestination(data)
  },

  async deleteDestination(id) {
    const { data, error } = await getSupabase().from('destinations').delete().eq('id', id).select('id')
    if (error) {
      if (error.code === '42501') throw new Error('Only your organization can remove its destinations.')
      throw new Error(`We couldn't remove this destination. ${CONNECTION}`)
    }
    if (!data?.length) throw new Error('Only your organization can remove its destinations.')
  },

  requestRide: (ride, clientRequestId) =>
    rideCall(
      'request_ride',
      { p_ride: { ...rideDetails(ride), returnOfRideId: ride.returnOfRideId ?? null }, p_client_request_id: clientRequestId ?? null },
      "We couldn't book this ride.",
    ),

  updateRide: (rideId, changes) =>
    rideCall('update_ride', { p_ride_id: rideId, p_changes: rideDetails(changes) }, "We couldn't save your changes."),

  async getRide(rideId) {
    const { data, error } = await ridesQuery().eq('id', rideId).maybeSingle<RideRow>()
    if (error) fail(error, "We couldn't load this ride.")
    return data ? toRide(data) : undefined
  },

  listRidesForHouse: (houseId) => readRides(ridesQuery().eq('house_id', houseId).order('pickup_time').returns<RideRow[]>()),

  async listOffersForRide(rideId) {
    const { data, error } = await getSupabase().from('ride_offers').select(OFFER_COLUMNS).eq('ride_id', rideId).order('sent_at').returns<OfferRow[]>()
    if (error) fail(error, "We couldn't load this ride's requests.")
    return data.map(toOffer)
  },

  retryRide: (rideId) => rideCall('retry_ride', { p_ride_id: rideId }, "We couldn't ask drivers again."),

  cancelRide: (rideId, reason) => rideCall('cancel_ride', { p_ride_id: rideId, p_reason: reason }, "We couldn't cancel this ride."),

  // Requests still waiting for an answer. Expired ones are hidden even before the expiry job (Step 12) marks them.
  async listMyOffers(driverId) {
    const { data, error } = await getSupabase()
      .from('ride_offers')
      .select(OFFER_COLUMNS)
      .eq('driver_id', driverId)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .order('sent_at')
      .returns<OfferRow[]>()
    if (error) fail(error, "We couldn't load your ride requests.")
    return data.map(toOffer)
  },

  // Waiting requests sent to any of this transport provider's drivers.
  async listOffersForOrg(orgId) {
    const { data, error } = await getSupabase()
      .from('ride_offers')
      .select(`${OFFER_COLUMNS}, drivers!inner(org_id)`)
      .eq('drivers.org_id', orgId)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .order('sent_at')
      .returns<OfferRow[]>()
    if (error) fail(error, "We couldn't load your drivers' ride requests.")
    return data.map(toOffer)
  },

  listMyRides: (driverId) => readRides(ridesQuery().eq('driver_id', driverId).order('pickup_time').returns<RideRow[]>()),

  // Rides taken by this organization's drivers.
  listRidesForOrg: (orgId) =>
    readRides(
      getSupabase()
        .from('rides')
        .select(`${RIDE_COLUMNS}, drivers!rides_driver_id_fkey!inner(org_id)`)
        .eq('drivers.org_id', orgId)
        .order('pickup_time')
        .returns<RideRow[]>(),
    ),

  // The rides access rule already lets only platform admins read every row; anyone else gets their own.
  // Capped, newest pickup first, so the oversight list stays quick as the network grows.
  listAllRides: () => readRides(ridesQuery().order('pickup_time', { ascending: false }).limit(ALL_RIDES_LIMIT).returns<RideRow[]>()),

  respondToOffer: (offerId, accept) =>
    rideCall('respond_to_offer', { p_offer_id: offerId, p_accept: accept }, "We couldn't send your answer."),

  dropRide: (rideId, driverId) =>
    rideCall('drop_ride', { p_ride_id: rideId, p_driver_id: driverId }, "We couldn't give up this ride."),

  markOnTheWay: (rideId, eta) =>
    rideCall(
      'advance_ride',
      {
        p_ride_id: rideId,
        p_step: 'ON_THE_WAY',
        p_eta_minutes: eta?.minutes ?? null,
      },
      "We couldn't update this ride.",
    ),
  markDriverArrived: (rideId) => rideCall('advance_ride', { p_ride_id: rideId, p_step: 'ARRIVED' }, "We couldn't update this ride."),
  markPickedUp: (rideId) => rideCall('advance_ride', { p_ride_id: rideId, p_step: 'PICKED_UP' }, "We couldn't update this ride."),
  markCompleted: (rideId) => rideCall('advance_ride', { p_ride_id: rideId, p_step: 'COMPLETED' }, "We couldn't update this ride."),
  markNoShow: (rideId) => rideCall('advance_ride', { p_ride_id: rideId, p_step: 'NO_SHOW' }, "We couldn't update this ride."),

  undoDriverStep: (rideId, driverId) =>
    rideCall('undo_driver_step', { p_ride_id: rideId, p_driver_id: driverId }, "We couldn't undo that step."),

  // The access rules limit this to the partner's own rides (and every ride for admins)
  async listRideEvents(rideId) {
    const { data, error } = await getSupabase()
      .from('ride_events')
      .select(EVENT_COLUMNS)
      .eq('ride_id', rideId)
      .order('id')
      .returns<RideEventRow[]>()
    if (error) fail(error, "We couldn't load this ride's history.")
    return data.map(toRideEvent)
  },

  async giveFeedback(rideId, { rating, note }) {
    const { data, error } = await getSupabase().rpc('give_ride_feedback', {
      p_ride_id: rideId,
      p_rating: rating ?? null,
      p_note: note?.trim() || null,
    })
    if (error) fail(error, "We couldn't save your feedback.")
    return toFeedback(data as FeedbackRow)
  },

  // The access rules only return feedback the caller wrote (admins, who write none, would get everyone's)
  listMyFeedback: () => readFeedback(getSupabase().from('ride_feedback').select(FEEDBACK_COLUMNS).returns<FeedbackRow[]>()),

  // For admins. Anyone else only ever gets back their own feedback (access rules)
  listFeedback({ driverId, orgId }) {
    let query = getSupabase().from('ride_feedback').select(FEEDBACK_COLUMNS).order('updated_at', { ascending: false })
    if (driverId) query = query.eq('driver_id', driverId)
    if (orgId) query = query.eq('org_id', orgId)
    return readFeedback(query.returns<FeedbackRow[]>())
  },

  async submitProductFeedback(feedback, clientRequestId) {
    const { data: id, error } = await getSupabase().rpc('submit_feedback', {
      p_client_request_id: clientRequestId,
      p_type: feedback.feedbackType,
      p_title: feedback.title,
      p_description: feedback.description,
      p_source_page: feedback.sourcePage ?? null,
      p_source_workspace: feedback.sourceWorkspace,
      p_related_release: feedback.relatedRelease ?? null,
    })
    if (error) fail(error, "We couldn't send your feedback.")
    return readProductFeedback(id as string)
  },

  // The database names the path and grants one upload of it; Storage enforces the bucket's size and type limits.
  async attachFeedbackScreenshot(feedbackId, file, fileName) {
    const supabase = getSupabase()
    const { data: grant, error } = await supabase.rpc('begin_feedback_attachment', {
      p_feedback_id: feedbackId,
      p_file_name: fileName,
      p_mime_type: file.type,
      p_file_size: file.size,
    })
    if (error) fail(error, "We couldn't upload your screenshot.")
    const { id, storagePath } = grant as { id: string; storagePath: string }
    const upload = await supabase.storage.from(FEEDBACK_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false })
    // Already there: an earlier try uploaded it but didn't hear back. Confirming below checks it really is.
    const alreadyThere = upload.error && /exists|duplicate/i.test(upload.error.message)
    if (upload.error && !alreadyThere) throw new Error(`We couldn't upload your screenshot. ${CONNECTION}`)
    const confirmed = await supabase.rpc('confirm_feedback_attachment', { p_attachment_id: id })
    if (confirmed.error) fail(confirmed.error, "We couldn't upload your screenshot.")
    const { data, error: readError } = await supabase
      .from('feedback_attachments')
      .select(FEEDBACK_ATTACHMENT_COLUMNS)
      .eq('id', id)
      .single<FeedbackAttachmentRow>()
    if (readError) fail(readError, "We couldn't upload your screenshot.")
    return toFeedbackAttachment(data)
  },

  async listMyProductFeedback() {
    const { data, error } = await getSupabase()
      .from('feedback_submissions')
      .select(PRODUCT_FEEDBACK_COLUMNS)
      .eq('submitted_by', await myProfileId())
      .order('created_at', { ascending: false })
      .returns<ProductFeedbackRow[]>()
    if (error) fail(error, "We couldn't load your feedback.")
    return (data ?? []).map(toProductFeedback)
  },

  // Internal notes are filtered out here and, whatever is asked, by the access rules
  async getMyProductFeedback(feedbackId) {
    const supabase = getSupabase()
    const [submission, messages, history, attachment] = await Promise.all([
      supabase
        .from('feedback_submissions')
        .select(PRODUCT_FEEDBACK_COLUMNS)
        .eq('id', feedbackId)
        .eq('submitted_by', await myProfileId())
        .maybeSingle<ProductFeedbackRow>(),
      supabase
        .from('feedback_messages')
        .select('id, message, visibility, created_at')
        .eq('feedback_id', feedbackId)
        .eq('visibility', 'public')
        .order('created_at')
        .returns<{ id: string; message: string; visibility: 'public'; created_at: string }[]>(),
      supabase
        .from('feedback_status_history')
        .select('id, previous_status, new_status, changed_at')
        .eq('feedback_id', feedbackId)
        .order('id')
        .returns<{ id: number; previous_status: ProductFeedbackStatus | null; new_status: ProductFeedbackStatus; changed_at: string }[]>(),
      supabase
        .from('feedback_attachments')
        .select(FEEDBACK_ATTACHMENT_COLUMNS)
        .eq('feedback_id', feedbackId)
        .not('uploaded_at', 'is', null)
        .maybeSingle<FeedbackAttachmentRow>(),
    ])
    const failed = submission.error ?? messages.error ?? history.error ?? attachment.error
    if (failed) fail(failed, "We couldn't load your feedback.")
    if (!submission.data) return undefined
    return {
      feedback: toProductFeedback(submission.data),
      messages: (messages.data ?? []).map((m) => ({ id: m.id, message: m.message, visibility: m.visibility, createdAt: iso(m.created_at) })),
      history: (history.data ?? []).map((h) => ({
        id: String(h.id),
        previousStatus: h.previous_status ?? undefined,
        newStatus: h.new_status,
        changedAt: iso(h.changed_at),
      })),
      attachment: attachment.data ? toFeedbackAttachment(attachment.data) : undefined,
    }
  },

  async getFeedbackScreenshotUrl(attachment) {
    const { data, error } = await getSupabase().storage.from(FEEDBACK_BUCKET).createSignedUrl(attachment.storagePath, SCREENSHOT_LINK_SECONDS)
    if (error || !data) throw new Error(`We couldn't load the screenshot. ${CONNECTION}`)
    return data.signedUrl
  },

  async getFeedbackSummary() {
    const { data, error } = await getSupabase().rpc('admin_feedback_summary')
    if (error) fail(error, "We couldn't load feedback totals.")
    return data as FeedbackSummary
  },

  async listProductFeedback({ limit, offset, ...filters }) {
    // Only the filters that are set, so the database treats the rest as "any"
    const set = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
    const { data, error } = await getSupabase().rpc('admin_list_feedback', { p_filters: set, p_limit: limit, p_offset: offset })
    if (error) fail(error, "We couldn't load feedback.")
    const page = data as { total: number; rows: AdminFeedbackJson[] }
    return { total: Number(page.total), rows: page.rows.map(toAdminFeedbackRow) } satisfies FeedbackPage
  },

  async getProductFeedback(feedbackId) {
    const { data, error } = await getSupabase().rpc('admin_get_feedback', { p_feedback_id: feedbackId })
    if (error) fail(error, "We couldn't load this feedback.")
    return data ? toAdminFeedbackDetail(data as AdminFeedbackDetailJson) : undefined
  },

  async listFeedbackAssignees() {
    const { data, error } = await getSupabase().rpc('admin_feedback_assignees')
    if (error) fail(error, "We couldn't load the list of admins.")
    return data as FeedbackPerson[]
  },

  async updateFeedbackTriage(feedbackId, change) {
    const { error } = await getSupabase().rpc('update_feedback_triage', {
      p_feedback_id: feedbackId,
      p_field: change.field === 'assignedTo' ? 'assigned_to' : change.field,
      p_expected: change.expected ?? null,
      p_value: change.value ?? null,
    })
    if (error) fail(error, "We couldn't save that change.")
  },

  async addFeedbackMessage(feedbackId, message, visibility) {
    const { error } = await getSupabase().rpc('add_feedback_message', { p_feedback_id: feedbackId, p_message: message, p_visibility: visibility })
    if (error) fail(error, "We couldn't save your message.")
  },

  async getImpact() {
    const { data, error } = await getSupabase()
      .rpc('get_impact')
      .single<{ rides_completed: number; money_saved: number | string; organizations: number; verified_drivers: number }>()
    if (error) fail(error, "We couldn't load the impact totals.")
    const ridesCompleted = Number(data.rides_completed)
    return {
      ridesCompleted,
      moneySaved: faresSavedFor(ridesCompleted),
      organizations: Number(data.organizations),
      verifiedDrivers: Number(data.verified_drivers),
    }
  },
}

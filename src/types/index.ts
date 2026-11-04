// Shared types used by every screen and service.
// See PRODUCT_DESCRIPTION.md section 10.4.

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// A partner org requests rides. It has one location and one shared account.
// A transport provider only gives rides. Hidden from sign-up for now.
export type OrgType = 'PARTNER_ORG' | 'TRANSPORT_PROVIDER'

export interface Organization {
  id: string
  name: string
  type: OrgType
  contactName: string
  contactPhone: string
  bookingNotifications?: string // phone or email that hears about new bookings
  status: VerificationStatus
  // Whether people can find it in search and ask to join. Hidden (invitation only) unless its admins choose otherwise.
  discoverability?: OrgDiscoverability
  directoryDescription?: string // what search shows about it, written by its admins
  createdAt?: string // when it registered
  reviewedAt?: string // when a platform admin last approved or rejected it
  reviewedBy?: string // User id of that admin
}

// Point A: where a partner organization's clients live and rides start, e.g. Belkin House.
// Each partner organization has exactly one, shared with its single account.
export interface House {
  id: string
  orgId: string
  name: string
  address: string
  city: string
  phone: string
}

// PARTNER: a member of a partner organization. Books rides from its location and manages its places.
// ORG_ADMIN: a transport provider's admin.
// DRIVER: has a CareRide driver profile (vehicle, area, verification). Every driver account from before
// general volunteering keeps this role.
// VOLUNTEER: a general volunteer with no other role. Not a driver: no vehicle, no CareRide access.
// See docs/architecture/volunteers.md.
export type UserRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'PARTNER' | 'DRIVER' | 'VOLUNTEER'

// A partner organization member's role within it. ADMIN manages the team, its visibility and invitations;
// STAFF uses the organization's services. Neither is a Relay Collective platform role.
export type OrgRole = 'ADMIN' | 'STAFF'

export type OrgDiscoverability = 'discoverable' | 'invitation_only'

export interface User {
  id: string
  name: string
  email?: string // used to sign in
  phone: string
  role: UserRole
  orgId?: string
  houseId?: string // set on a partner organization account: its pickup location
  orgRole?: OrgRole // set on a partner organization member
  deletionStatus?: AccountDeletionStatus // admin account list only: a permanent deletion is under way
}

export type DriverBackground = 'TAXI' | 'RIDESHARE' | 'ORG_DRIVER' | 'INDEPENDENT'

// A stretch of one day. Can't cross midnight.
export interface TimeWindow {
  from: string // "HH:MM", 24-hour
  to: string // "HH:MM", 24-hour, same day
}

// When a driver is happy to be sent ride requests. It's not a promise to drive:
// they still choose which requests to accept. Seven entries, 0 = Sunday ... 6 = Saturday;
// null means no requests that day.
export type RequestHours = (TimeWindow | null)[]

export interface Driver {
  id: string
  userId: string
  orgId?: string // set if the driver belongs to a transport provider
  background: DriverBackground
  vehicle: string
  wheelchairAccessible: boolean
  seats: number // spaces for passengers
  serviceCities: string[]
  requestHours: RequestHours
  licenceFile?: string // demo: file name only
  proofFile?: string // demo: proof of professional driving, file name only
  status: VerificationStatus
  createdAt?: string // when they signed up (or were added)
  reviewedAt?: string // when a platform admin last approved or rejected them
  reviewedBy?: string // User id of that admin
}

// A ride's driver as the booking organization sees them. The workspace provides it; CareRide's lists show it.
export interface DriverInfo {
  name?: string
  vehicle: string
}

// Point B: a place clients go, e.g. St. Paul's Hospital. Added by the partner org.
export interface Destination {
  id: string
  orgId: string
  name: string
  address: string
  city: string
  notes?: string
}

export type RideType = 'ON_DEMAND' | 'SCHEDULED'

export type TripPurpose = 'MEDICAL' | 'SOCIAL_SERVICES' | 'HOUSING' | 'LEGAL_OR_ID' | 'OTHER'

export type RideStatus =
  | 'SEARCHING'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'NEEDS_ATTENTION'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'

// A one-way trip. A return trip is a separate ride linked by returnOfRideId.
// Rider names are optional and only there so the driver knows who to pick up.
export interface Ride {
  id: string
  type: RideType
  orgId: string
  houseId: string
  requestedBy: string // User id of the house account or org admin who booked it
  riderNames?: string[] // optional, one per passenger
  passengers: number
  purpose?: TripPurpose // no longer asked for; kept on older rides
  pickupAddress: string
  pickupInstructions?: string // e.g. "Meet in the front lobby"
  destinationId?: string // if a saved destination was used
  destinationName: string
  destinationAddress: string
  pickupTime: string // ISO date-time
  needsWheelchair: boolean
  needsAssistance: boolean
  notes?: string
  status: RideStatus
  driverId?: string // set once accepted
  preferredDriverId?: string // asked first, e.g. the driver of the outbound trip
  returnOfRideId?: string // set on a return trip
  groupId?: string // set when combined with other rides
  cancelReason?: string
  estimatedFareSaved: number
  createdAt: string
  acceptedAt?: string // when a driver said yes
  driverOnTheWayAt?: string // driver set off for the pickup
  driverEta?: string // optional: when the driver expects to reach the pickup (scheduled: pickup time plus early/late)
  driverArrivedAt?: string // driver tapped "I'm here" at pickup
  pickedUpAt?: string
  completedAt?: string
  cancelledAt?: string
  droppedBy?: { driverId: string; at: string } // last driver who accepted, then said they can't make it
  expired?: boolean // cancelled automatically: no driver accepted in time
  changedAt?: string // the partner edited the ride after booking
  reconfirmDriverId?: string // the driver who had accepted before a change, asked to confirm again
}

// WITHDRAWN: the driver accepted, then said they can't make it.
// TAKEN: another driver accepted first, so this driver never got to answer.
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | 'TAKEN'

export interface RideOffer {
  id: string
  rideId: string
  driverId: string
  status: OfferStatus
  sentAt: string
  expiresAt: string
  respondedAt?: string
}

// One line in a ride's change history (the audit log). Written for every change, by whoever made it.
export type RideEventKind =
  | 'REQUESTED'
  | 'EDITED'
  | 'SENT_AGAIN' // staff asked drivers again after nobody could take it
  | 'NO_DRIVER_AVAILABLE'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_DROPPED' // the driver said they can't make it
  | 'DRIVER_REMOVED' // the driver's account was closed, so the ride went back out
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'STEP_UNDONE'

// What an edit touched. Destination covers its name and address together.
export type EditedField =
  | 'type'
  | 'pickupTime'
  | 'passengers'
  | 'riderNames'
  | 'needsWheelchair'
  | 'needsAssistance'
  | 'pickupInstructions'
  | 'notes'
  | 'destination'

// The driver steps an undo can take back
export type UndoneStep = 'ON_THE_WAY' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED' | 'NO_SHOW'

export interface RideEventDetail {
  fields?: EditedField[] // EDITED
  fromPickupTime?: string // EDITED, when a scheduled pickup moved
  toPickupTime?: string
  reason?: string // CANCELLED
  expired?: boolean // CANCELLED: nobody accepted in time
  eta?: string // ON_THE_WAY
  undid?: UndoneStep // STEP_UNDONE
  unknownActor?: boolean // filled in from a ride that predates the history, so who did it isn't known
}

export interface RideEvent {
  id: string
  rideId: string
  kind: RideEventKind
  at: string
  // Who made the change. No role means Relay Collective did it on its own (e.g. a request ran out of time).
  actorRole?: UserRole
  actorName?: string // as it was at the time
  detail?: RideEventDetail
}

export type FeedbackRating = 'UP' | 'DOWN'

// After a ride: staff give a thumbs up or down (with an optional note), drivers can flag an issue.
// Only the author and the platform admin can read it. Drivers never see staff ratings.
export interface RideFeedback {
  id: string
  rideId: string
  authorRole: 'PARTNER' | 'DRIVER'
  orgId: string // the ride's partner organization
  driverId?: string // the ride's driver
  rating?: FeedbackRating // staff only
  note?: string // required for a driver's flag
  at: string
}

export interface Impact {
  ridesCompleted: number
  moneySaved: number
  organizations: number
  verifiedDrivers: number
}

// ---- General volunteering

// Kinds of help a volunteer would like to give. Descriptive only: choosing one never grants access to
// a service, and TRANSPORTATION doesn't make anyone a driver. Labels live in src/volunteer/interests.ts.
export type VolunteerInterest = 'TRANSPORTATION' | 'FOOD_DISTRIBUTION' | 'COMMUNITY_OUTREACH' | 'RESOURCE_COORDINATION' | 'GENERAL'

// Someone's platform-level volunteering. Name, phone and email stay on their User.
export interface VolunteerProfile {
  id: string
  userId: string
  interests: VolunteerInterest[] // at least one, each once, in the order of VOLUNTEER_INTERESTS
  createdAt: string
  updatedAt?: string
}

// ---- Identity and onboarding

// Who is signed in, before (or without) a Relay Collective role. Sign-up creates only this;
// a profile (User) comes from onboarding: registering an organization, driving, or an invitation.
export interface Identity {
  id: string
  email: string
  name: string // as typed at sign-up; only used to prefill forms
}

// How an organization describes itself. Descriptive only: none of these grant access to anything.
export type OrgKind = 'NONPROFIT' | 'COMMUNITY_GROUP' | 'FAITH_BASED' | 'PUBLIC_AGENCY' | 'OTHER'
export type ServiceCategory = 'HOUSING' | 'FOOD' | 'HEALTH' | 'TRANSPORTATION' | 'OUTREACH' | 'EMPLOYMENT' | 'OTHER'
export type PlatformInterest = 'TRANSPORTATION' | 'VOLUNTEERS' | 'RESOURCES' | 'REFERRALS' | 'REPORTING'

// What an organization told Relay Collective when it applied. Seen by its members and platform admins.
export interface OrganizationApplication {
  orgId: string
  kind: OrgKind
  website?: string
  description: string
  contactEmail: string
  contactRole: string
  serviceCategories: ServiceCategory[]
  platformInterests: PlatformInterest[]
  submittedBy: string // User id
  submittedAt: string
}

// A staff member invites a colleague into their organization. Single use, tied to one email.
export interface Invitation {
  id: string
  orgId: string
  email: string
  role: 'PARTNER'
  invitedBy: string // User id
  createdAt: string
  expiresAt: string
  acceptedAt?: string
  revokedAt?: string
}

// What someone holding an invitation link may see. Details only when it's theirs to accept.
export type InvitationState =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'USED'
  | 'WRONG_ACCOUNT' // sent to a different email
  | 'HAS_ACCOUNT' // this login already has a Relay Collective role (one organization per account)
  | 'UNAVAILABLE' // the organization isn't approved right now

export interface InvitationPreview {
  state: InvitationState
  orgName?: string
  role?: 'PARTNER'
  invitedBy?: string
  email?: string
  expiresAt?: string
  emailHint?: string // WRONG_ACCOUNT only, e.g. "j•••@example.org"
}

// ---- Organization discovery and membership

// What search shows about an organization that chose to be found. Nothing else about it is public.
export interface OrganizationDirectoryEntry {
  id: string
  name: string
  city?: string
  description?: string
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

// The applicant's view of their own request. Never includes the reviewers' notes.
export interface MyJoinRequest {
  id: string
  orgId: string
  orgName: string
  orgCity?: string
  status: JoinRequestStatus
  requestedPosition?: string
  message?: string
  createdAt: string
  reviewedAt?: string
  cancelledAt?: string
}

// An organization administrator's view of a request to join their organization
export interface JoinRequest {
  id: string
  orgId: string
  applicantName: string
  applicantEmail: string
  emailVerified: boolean
  requestedPosition?: string // descriptive only
  message?: string
  status: JoinRequestStatus
  assignedRole?: OrgRole // once approved
  reviewNote?: string // administrators only
  reviewedByName?: string
  reviewedAt?: string
  createdAt: string
}

// active: can sign in to the workspace. removed: an administrator removed them. closed: they closed their account.
export type MembershipStatus = 'active' | 'removed' | 'closed'

export interface OrganizationMember {
  id: string // profile id
  name: string
  email?: string // administrators only
  role: OrgRole
  status: MembershipStatus
  joinedAt: string
  removedAt?: string
  isYou: boolean
}

// ---- Feedback & Suggestions (product feedback, not feedback on one ride)

export type ProductFeedbackType = 'bug' | 'feature_request' | 'improvement' | 'release_feedback' | 'general'
export type ProductFeedbackStatus = 'new' | 'under_review' | 'planned' | 'in_progress' | 'resolved' | 'closed'
export type ProductFeedbackPriority = 'low' | 'medium' | 'high' | 'critical'
// Where it was sent from. Drivers can be in their volunteer workspace or on the driving pages of it.
export type FeedbackWorkspace = 'organization' | 'volunteer' | 'driver' | 'admin'
export type FeedbackVisibility = 'public' | 'internal'

// What the submitter (and anyone else who isn't a platform admin) may see of their own feedback.
// Priority and assignment are for Relay Collective's team only.
export interface ProductFeedback {
  id: string
  reference: number // shown as FB-1042
  feedbackType: ProductFeedbackType
  title: string
  description: string
  sourcePage?: string // an app route with ids blanked out, e.g. /workspace/transportation/rides/:id
  sourceWorkspace: FeedbackWorkspace
  relatedRelease?: string // a version from the What's New list
  status: ProductFeedbackStatus
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

// A screenshot someone attached. Its file is private: screens ask for a short-lived link to show it.
export interface FeedbackAttachment {
  id: string
  storagePath: string
  fileName: string
  mimeType: string
  fileSize: number
  uploadedAt?: string // missing while the upload hasn't finished
}

export interface FeedbackMessage {
  id: string
  message: string
  visibility: FeedbackVisibility
  createdAt: string
  authorName?: string // admins only; submitters hear from "the Relay Collective team"
}

export interface FeedbackStatusChange {
  id: string
  previousStatus?: ProductFeedbackStatus // missing on the submission itself
  newStatus: ProductFeedbackStatus
  changedAt: string
  changedByName?: string // admins only
}

// A submitter's own feedback with what they may see around it: public replies, status changes, their screenshot
export interface ProductFeedbackThread {
  feedback: ProductFeedback
  messages: FeedbackMessage[] // public only, whatever the screen asks for
  history: FeedbackStatusChange[]
  attachment?: FeedbackAttachment
}

export interface FeedbackPerson {
  id: string
  name: string
}

// One row of the admin inbox
export interface AdminFeedbackRow extends Omit<ProductFeedback, 'description'> {
  priority?: ProductFeedbackPriority
  submittedBy: FeedbackPerson & { active: boolean }
  organization?: FeedbackPerson
  assignedTo?: FeedbackPerson
  hasAttachment: boolean
}

// Everything an admin sees about one submission, including internal notes and who changed what
export interface AdminFeedbackDetail extends ProductFeedback {
  priority?: ProductFeedbackPriority
  submittedBy: FeedbackPerson & { active: boolean; role: UserRole; email?: string }
  organization?: FeedbackPerson
  assignedTo?: FeedbackPerson
  attachment?: FeedbackAttachment
  messages: FeedbackMessage[]
  history: FeedbackStatusChange[]
}

export interface FeedbackSummary {
  total: number
  new: number
  underReview: number
  planned: number
  inProgress: number
  resolved: number
  closed: number
}

// ---- Permanent account deletion (platform admins). See docs/ACCOUNT_DELETION.md.

export type AccountDeletionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'requires_attention'
// storage: the person's files; records: their rows; auth: their login; verify: nothing personal is left
export type AccountDeletionStep = 'storage' | 'records' | 'auth' | 'verify' | 'done'
export type AccountDeletionErrorCode =
  | 'STORAGE_DELETE_FAILED'
  | 'RECORDS_CLEANUP_FAILED'
  | 'AUTH_DELETE_FAILED'
  | 'VERIFICATION_FAILED'
  | 'INTERRUPTED'
export type AccountDeletionAction = 'delete' | 'anonymize' | 'remove' | 'detach' | 'reassign' | 'retain' | 'none'
export type AccountDeletionCategoryKey =
  | 'auth_account'
  | 'profile'
  | 'volunteer_profile'
  | 'organization_membership'
  | 'driver_profile'
  | 'driver_documents'
  | 'open_rides'
  | 'product_feedback'
  | 'personal_files'
  | 'feedback_assignments'
  | 'feedback_replies'
  | 'join_requests'
  | 'invitations'
  | 'ride_issue_reports'
  | 'rides_requested'
  | 'rides_driven'
  | 'ride_ratings'
  | 'ride_history'
  | 'organization_applications'
  | 'preferences'
  | 'deletion_record'
// Why an account can't be deleted right now
export type AccountDeletionBlocker =
  | 'SELF'
  | 'LAST_PLATFORM_ADMIN'
  | 'LAST_ORG_ADMIN'
  | 'ORG_OPEN_RIDES'
  | 'LAST_PROVIDER_ADMIN'
  | 'DRIVER_ON_TRIP'
  | 'NO_SIGN_IN_EMAIL'

// One kind of data and what deleting the account does to it, counted by the backend
export interface AccountDeletionCategory {
  key: AccountDeletionCategoryKey
  action: AccountDeletionAction
  count: number
}

// A deletion as the backend tracks it. Holds no name or email.
export interface AccountDeletionJob {
  id: string
  profileId: string
  status: AccountDeletionStatus
  step: AccountDeletionStep
  errorCode?: AccountDeletionErrorCode
  attempts: number
  plan: AccountDeletionCategory[] // what was planned when it started
  startedAt: string
  updatedAt: string
  completedAt?: string
  failedAt?: string
}

// What deleting an account would do, worked out by the backend from the data as it is now
export interface AccountDeletionPreview {
  state: 'READY' | 'BLOCKED' | 'IN_PROGRESS' | 'DELETED'
  profileId: string
  name?: string // READY and BLOCKED only: once deletion starts, the profile no longer has one
  email?: string
  role: UserRole
  orgName?: string
  blockers: AccountDeletionBlocker[]
  categories: AccountDeletionCategory[]
  job?: AccountDeletionJob // the open deletion (IN_PROGRESS), or the finished one (DELETED)
}

import type { DriverEtaHint } from '../logic/driverEta'
import type {
  AccountDeletionJob,
  AccountDeletionPreview,
  AdminFeedbackDetail,
  AdminFeedbackRow,
  Destination,
  Driver,
  FeedbackAttachment,
  FeedbackPerson,
  FeedbackSummary,
  FeedbackVisibility,
  FeedbackWorkspace,
  FeedbackRating,
  House,
  Identity,
  Impact,
  OrgDiscoverability,
  OrgRole,
  OrganizationDirectoryEntry,
  OrganizationMember,
  Invitation,
  InvitationPreview,
  JoinRequest,
  JoinRequestStatus,
  MyJoinRequest,
  Organization,
  OrganizationApplication,
  ProductFeedback,
  ProductFeedbackPriority,
  ProductFeedbackStatus,
  ProductFeedbackThread,
  ProductFeedbackType,
  Ride,
  RideEvent,
  RideFeedback,
  RideOffer,
  User,
  VerificationStatus,
  VolunteerInterest,
  VolunteerProfile,
} from '../types'

export type NewOrganization = Omit<Organization, 'id' | 'status'>
export interface NewAccount {
  name: string
  email: string
  password: string
  next?: string // where the confirmation link continues to, e.g. an invitation; a path on this site
}
// Outcome of self sign-up. With email confirmation on, the account exists but nobody is signed in yet.
export type Registration = { status: 'SIGNED_IN'; user: User } | { status: 'CONFIRM_EMAIL'; email: string }
// Outcome of creating an identity (sign-up without a role). Onboarding gives it a role afterwards.
export type SignUpResult = { status: 'SIGNED_IN'; identity: Identity } | { status: 'CONFIRM_EMAIL'; email: string }
// Who is signed in. user is the Relay Collective profile, read from the backend; it's missing until onboarding finishes.
export interface Session {
  identity: Identity
  user?: User
}
// What a partner organization sends when it applies. The backend creates the org, its location, and the applicant's profile.
export interface NewOrganizationApplication
  extends Pick<OrganizationApplication, 'kind' | 'website' | 'description' | 'contactEmail' | 'contactRole' | 'serviceCategories' | 'platformInterests'> {
  orgName: string
  contactName: string
  contactPhone: string
  address: string
  city: string
}
// What someone joining as a general volunteer tells us. The backend makes the profile from the session.
export interface NewVolunteer {
  name: string
  phone?: string // optional: volunteers aren't required to share one
  interests: VolunteerInterest[] // at least one; descriptive only, never access
}
// A new invitation. The token is shown once, to build the link; the backend keeps only its hash.
export interface CreatedInvitation {
  invitation: Invitation
  token: string
}
// What someone asking to join tells the organization. Descriptive only: an administrator picks the role.
export interface NewJoinRequest {
  orgId: string
  requestedPosition?: string
  message?: string
}

export const MAX_JOIN_MESSAGE = 1000
export const MAX_JOIN_POSITION = 120
export const MAX_DIRECTORY_DESCRIPTION = 280
export const MAX_REVIEW_NOTE = 500

// What a platform admin gives to delete an account: the account's email as they typed it, and their own password
export interface AccountDeletionConfirmation {
  email: string
  password: string
}

// What an admin's password reset produced. The demo sets a password to share; the real backend emails a reset link.
export type PasswordReset = { kind: 'NEW_PASSWORD'; email: string; password: string } | { kind: 'EMAIL_SENT'; email: string }
export type NewDriverUser = Pick<User, 'name' | 'phone'>
export type NewDriver = Omit<Driver, 'id' | 'userId' | 'status'>
// A partner organization's one location: where its rides start
export type NewLocation = Pick<House, 'address' | 'city' | 'phone'>
// What drivers can change themselves from their settings page
export type DriverSettings = Pick<
  Driver,
  'requestHours' | 'vehicle' | 'seats' | 'wheelchairAccessible' | 'serviceCities'
>
export type NewRide = Omit<
  Ride,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'driverOnTheWayAt'
  | 'driverEta'
  | 'driverArrivedAt'
  | 'pickedUpAt'
  | 'completedAt'
  | 'droppedBy'
  | 'cancelledAt'
  | 'expired'
  | 'changedAt'
  | 'reconfirmDriverId'
>
// What the partner can change after booking. Changing when, where, or who sends the ride out to drivers again.
export type RideChanges = Pick<
  Ride,
  | 'type'
  | 'pickupTime'
  | 'passengers'
  | 'riderNames'
  | 'needsWheelchair'
  | 'needsAssistance'
  | 'pickupInstructions'
  | 'notes'
  | 'destinationId'
  | 'destinationName'
  | 'destinationAddress'
>
// Staff send a rating (and an optional note). Drivers send only a note: the issue they're flagging.
export interface FeedbackInput {
  rating?: FeedbackRating
  note?: string
}

// Feedback & Suggestions. The backend picks the submitter and organization from the session, and the
// workspace from their role; sourcePage is a sanitized route (see sanitizeRoute in src/feedback/rules.ts).
export interface NewProductFeedback {
  feedbackType: ProductFeedbackType
  title: string
  description: string
  sourcePage?: string
  sourceWorkspace: FeedbackWorkspace
  relatedRelease?: string // only kept on feedback about an update
}

// The admin inbox's filters. All optional; priority 'none' means not prioritized yet. Dates are YYYY-MM-DD.
export interface FeedbackQuery {
  search?: string // title, description, or a reference like FB-1042
  type?: ProductFeedbackType
  status?: ProductFeedbackStatus
  priority?: ProductFeedbackPriority | 'none'
  workspace?: FeedbackWorkspace
  organizationId?: string
  release?: string
  from?: string
  to?: string
  limit: number
  offset: number
}

export interface FeedbackPage {
  total: number
  rows: AdminFeedbackRow[]
}

// One triage change. expected is what the admin's screen showed, so another admin's newer decision is never overwritten.
export type TriageChange =
  | { field: 'status'; expected: ProductFeedbackStatus; value: ProductFeedbackStatus }
  | { field: 'priority'; expected?: ProductFeedbackPriority; value?: ProductFeedbackPriority }
  | { field: 'assignedTo'; expected?: string; value?: string } // profile ids

// Sign-in refused because the email hasn't been confirmed yet. The sign-in page offers a new link.
export class UnconfirmedEmailError extends Error {}

// The most rides the platform admin's oversight list loads at once
export const ALL_RIDES_LIMIT = 1000

// The contract every backend must follow (mock now, real backend later).
// Screens only talk to this interface, never to storage directly.
export interface DataService {
  // Session. The backend decides who is signed in; screens never set it directly.
  // The signed-in identity and its profile, if any; throws if it can't be checked (or the account was closed)
  restoreSession(): Promise<Session | undefined>
  signIn(email: string, password: string): Promise<Session> // starts a session; throws if they don't match
  signOut(): Promise<void>
  // Calls back when the session changes outside this screen (another tab, expiry, demo reset). Returns unsubscribe.
  onSessionChange(listener: () => void): () => void
  // Calls back when shared data this person can see changes elsewhere (live updates). Returns unsubscribe.
  onDataChange(listener: () => void): () => void
  // "Forgot password": emails a reset link if an account exists, without saying whether one does
  requestPasswordReset(email: string): Promise<void>
  // Sets a new password for the signed-in person, e.g. after opening a reset link
  updatePassword(newPassword: string): Promise<void>
  // Creates an identity only (no role). Says nothing about whether the email was already registered
  // when email confirmation is on, so sign-up can't be used to probe who has an account.
  signUp(account: NewAccount): Promise<SignUpResult>
  // Sends the confirmation email again. Same answer whether or not the email has an account.
  resendVerification(email: string): Promise<void>

  // Onboarding, for a signed-in identity without a role. Each returns the new profile.
  // Safe to repeat: a retry returns the profile the first call made instead of creating another.
  submitOrganizationApplication(application: NewOrganizationApplication): Promise<User>
  registerDriverProfile(user: NewDriverUser, driver: NewDriver): Promise<User>
  // Joins as a general volunteer: a VOLUNTEER profile and its interests. Never creates a driver profile.
  registerVolunteer(volunteer: NewVolunteer): Promise<User>

  // General volunteering. Interests are descriptive: they never change what an account may do.
  // The account's volunteer profile, if it has one. Your own, or anyone's for a platform admin (checked by the backend).
  getVolunteerProfile(userId: string): Promise<VolunteerProfile | undefined>
  // Replaces the signed-in volunteer's interests (at least one). Changes nothing else, driving included.
  updateMyVolunteerInterests(interests: VolunteerInterest[]): Promise<VolunteerProfile>
  // The application behind an organization: its members and platform admins only
  getOrganizationApplication(orgId: string): Promise<OrganizationApplication | undefined>

  // Invitations. Staff of an approved partner organization invite colleagues by email; the backend
  // picks the organization and role, checks every rule again on acceptance, and allows one use.
  createInvitation(email: string): Promise<CreatedInvitation>
  listInvitations(): Promise<Invitation[]> // the signed-in member's organization's
  revokeInvitation(invitationId: string): Promise<void>
  previewInvitation(token: string): Promise<InvitationPreview> // signed-in only
  acceptInvitation(token: string): Promise<User>

  // Organization discovery and join requests. Search returns only approved organizations that chose to be
  // found, a few at a time; fewer than two characters returns nothing.
  searchOrganizations(query: string): Promise<OrganizationDirectoryEntry[]>
  // For a signed-in identity without a role. Grants nothing: the organization's administrators decide.
  // Safe to repeat: a retry returns the pending request instead of creating another.
  submitJoinRequest(request: NewJoinRequest): Promise<MyJoinRequest>
  listMyJoinRequests(): Promise<MyJoinRequest[]> // newest first
  cancelJoinRequest(requestId: string): Promise<void> // the applicant's own pending request only

  // Team management. Organization administrators only, for their own organization (checked by the backend).
  listJoinRequests(status: JoinRequestStatus | 'all'): Promise<JoinRequest[]>
  // Creates the membership and approves the request together; the role is the administrator's choice
  approveJoinRequest(requestId: string, role: OrgRole): Promise<void>
  rejectJoinRequest(requestId: string, note?: string): Promise<void>
  // Any member sees names and roles; only administrators see emails. Former members only when asked.
  listOrganizationMembers(includeFormer?: boolean): Promise<OrganizationMember[]>
  setMemberRole(profileId: string, role: OrgRole): Promise<void> // never your own; never the last admin
  removeMember(profileId: string): Promise<void> // ends their access; their login and history stay
  setOrganizationVisibility(discoverability: OrgDiscoverability, description?: string): Promise<void>

  // Accounts
  listUsers(): Promise<User[]>
  isEmailAvailable(email: string): Promise<boolean>

  // Organizations. Registering also creates the sign-in account; everything starts PENDING.
  // A partner organization gives its location (and any first destinations) too: it gets one shared account that books from there.
  registerOrganization(
    org: NewOrganization,
    account: NewAccount,
    location?: NewLocation,
    destinations?: Pick<Destination, 'name' | 'address' | 'city'>[],
  ): Promise<Registration>
  listOrganizations(): Promise<Organization[]>

  // Locations (point A): one per partner organization
  listHouses(orgId?: string): Promise<House[]>

  // Drivers: self sign-up with a login, or added by a transport provider without one
  registerDriver(user: NewDriverUser, driver: NewDriver, login: Pick<NewAccount, 'email' | 'password'>): Promise<Registration>
  addOrgDriver(user: NewDriverUser, driver: NewDriver): Promise<Driver> // transport providers only; the backend uses the signed-in org
  listDrivers(orgId?: string): Promise<Driver[]>
  // Approved drivers' eligibility (seats, cities, hours) for booking previews, without saying who they are
  listDriverPool(): Promise<Driver[]>
  updateDriver(driverId: string, changes: Partial<DriverSettings>): Promise<Driver>

  // Platform admin
  listPending(): Promise<{ orgs: Organization[]; drivers: Driver[] }>
  setOrgStatus(orgId: string, status: VerificationStatus): Promise<Organization>
  setDriverStatus(driverId: string, status: VerificationStatus): Promise<Driver>
  listAccounts(): Promise<User[]> // users who can sign in
  // Helps someone who is locked out. Platform admins only.
  resetPassword(userId: string, newPassword?: string): Promise<PasswordReset>
  // Permanent deletion (docs/ACCOUNT_DELETION.md). Platform admins only, checked by the backend at every step.
  // What deleting this account would do, counted from the data now. Changes nothing.
  previewAccountDeletion(userId: string): Promise<AccountDeletionPreview>
  // Erases the account's sign-in and personal information; shared records stay, anonymized. The account is
  // the id; the email is what the admin typed to confirm, and the password is theirs, checked again.
  // Resolves with the job however it went: check its status, since a failed step waits for a retry.
  startAccountDeletion(userId: string, confirmation: AccountDeletionConfirmation): Promise<AccountDeletionJob>
  // Carries on with a deletion that failed or was cut off, from the step it stopped at
  retryAccountDeletion(jobId: string, password: string): Promise<AccountDeletionJob>
  getAccountDeletion(jobId: string): Promise<AccountDeletionJob | undefined>
  // The signed-in driver, volunteer or partner organization closes their own sign-in. Ride history stays.
  // A driver with a client in the car has to finish that ride first.
  deleteMyAccount(): Promise<void>

  // Destinations (point B). Past rides keep the address they were booked with.
  listDestinations(orgId?: string): Promise<Destination[]>
  saveDestination(dest: Omit<Destination, 'id'>): Promise<Destination>
  updateDestination(id: string, changes: Pick<Destination, 'name' | 'address' | 'city' | 'notes'>): Promise<Destination>
  deleteDestination(id: string): Promise<void>

  // Rides: partner organization
  // Throws if a scheduled pickup time is in the past or the ride is too big. Send the same clientRequestId
  // when retrying one submission, so an answer lost on the network can't create a second booking.
  requestRide(ride: NewRide, clientRequestId?: string): Promise<Ride>
  updateRide(rideId: string, changes: RideChanges): Promise<Ride> // only before pickup
  getRide(rideId: string): Promise<Ride | undefined>
  listRidesForHouse(houseId: string): Promise<Ride[]>
  listOffersForRide(rideId: string): Promise<RideOffer[]>
  retryRide(rideId: string): Promise<Ride>
  cancelRide(rideId: string, reason: string): Promise<Ride>

  // Rides: drivers, and transport providers acting for their drivers
  listMyOffers(driverId: string): Promise<RideOffer[]>
  listOffersForOrg(orgId: string): Promise<RideOffer[]>
  listMyRides(driverId: string): Promise<Ride[]>
  listRidesForOrg(orgId: string): Promise<Ride[]> // rides taken by the org's drivers
  // Platform admin only (checked by the backend): every ride, newest pickup first, for oversight
  listAllRides(): Promise<Ride[]>
  respondToOffer(offerId: string, accept: boolean): Promise<Ride>
  dropRide(rideId: string, driverId: string): Promise<Ride>
  markOnTheWay(rideId: string, eta?: DriverEtaHint): Promise<Ride> // driver set off; ETA is from now, or offset from pickup
  markDriverArrived(rideId: string): Promise<Ride> // driver is at the pickup ("I'm here")
  markPickedUp(rideId: string): Promise<Ride>
  markCompleted(rideId: string): Promise<Ride>
  markNoShow(rideId: string): Promise<Ride> // client passed up the ride and loses it
  undoDriverStep(rideId: string, driverId: string): Promise<Ride> // takes back the driver's last step

  // Change history, oldest first. Staff see their own rides'; the platform admin sees every ride's.
  listRideEvents(rideId: string): Promise<RideEvent[]>

  // Feedback on a finished ride. Giving it again replaces the earlier one.
  // Throws if the ride isn't over, or isn't this partner's or driver's ride.
  giveFeedback(rideId: string, feedback: FeedbackInput): Promise<RideFeedback>
  listMyFeedback(): Promise<RideFeedback[]> // what the signed-in person gave
  listFeedback(filter: { driverId?: string; orgId?: string }): Promise<RideFeedback[]> // platform admin only

  // Feedback & Suggestions, from anyone signed in with a role. Send the same clientRequestId when retrying
  // one form, so an answer lost on the network can't create a second submission.
  submitProductFeedback(feedback: NewProductFeedback, clientRequestId: string): Promise<ProductFeedback>
  // Adds the one screenshot to the signed-in person's own feedback, within a day of sending it.
  // Safe to retry after a failure. The file should already be checked (see src/feedback/screenshot.ts).
  attachFeedbackScreenshot(feedbackId: string, file: Blob, fileName: string): Promise<FeedbackAttachment>
  listMyProductFeedback(): Promise<ProductFeedback[]> // newest first
  // The signed-in person's own feedback, its public replies and status changes. Never internal notes.
  getMyProductFeedback(feedbackId: string): Promise<ProductFeedbackThread | undefined>
  // A short-lived link to show a screenshot, for its submitter or a platform admin
  getFeedbackScreenshotUrl(attachment: FeedbackAttachment): Promise<string>

  // Feedback management: platform admins only (checked by the backend)
  getFeedbackSummary(): Promise<FeedbackSummary>
  listProductFeedback(query: FeedbackQuery): Promise<FeedbackPage> // filtered, searched and paged by the backend
  getProductFeedback(feedbackId: string): Promise<AdminFeedbackDetail | undefined>
  listFeedbackAssignees(): Promise<FeedbackPerson[]> // active platform admins
  updateFeedbackTriage(feedbackId: string, change: TriageChange): Promise<void>
  // public: a reply the submitter sees. internal: a note only admins see.
  addFeedbackMessage(feedbackId: string, message: string, visibility: FeedbackVisibility): Promise<void>

  // Impact
  getImpact(): Promise<Impact>
}

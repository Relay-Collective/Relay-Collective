import type { Driver, User, VerificationStatus, VolunteerInterest, VolunteerProfile } from '../types'
import { interestDefinition } from './interests'
import { canDrive, driverKind, DRIVER_KIND_LABELS, type DriverKind } from './participation'

// What the volunteer workspace shows the signed-in person, from what the backend already says about them:
// their role, their CareRide driver profile (if any), and their volunteer profile (if any).
//
// Presentation only. Nothing here decides what anyone may do: the database refuses every ride action to an
// account without an approved driver profile, and the app's route guards send people back to their home.
// Interests in particular never change the experience's driving parts: interested in Transportation ≠
// enrolled in CareRide ≠ approved to drive.

// GENERAL_VOLUNTEER: a VOLUNTEER account. No CareRide pages.
// CARERIDE_DRIVER: a DRIVER account, the workspace as drivers have always had it (driving pages included).
export type WorkspaceExperience = 'GENERAL_VOLUNTEER' | 'CARERIDE_DRIVER'

// Where this person stands with CareRide, the one operational service today
export type CareRideEnrollment = 'NOT_ENROLLED' | VerificationStatus

export interface VolunteerWorkspace {
  experience: WorkspaceExperience
  hasVolunteerProfile: boolean // false for drivers from before general volunteering, until they add interests
  interests: VolunteerInterest[]
  careRide: CareRideEnrollment
  driverKind?: DriverKind // only with a driver profile
  approvedToDrive: boolean // the same rule as canDrive(); the backend checks again on every ride action
}

export function volunteerWorkspace(
  user: Pick<User, 'role'> | undefined,
  driver: Pick<Driver, 'status' | 'background' | 'orgId'> | undefined,
  volunteer: Pick<VolunteerProfile, 'interests'> | null | undefined,
): VolunteerWorkspace {
  const isDriver = user?.role === 'DRIVER'
  // A driver profile only counts on a DRIVER account, as everywhere else (see serviceRoles)
  const enrolled = isDriver ? driver : undefined
  return {
    experience: isDriver ? 'CARERIDE_DRIVER' : 'GENERAL_VOLUNTEER',
    hasVolunteerProfile: !!volunteer,
    interests: volunteer?.interests ?? [],
    careRide: enrolled ? enrolled.status : 'NOT_ENROLLED',
    driverKind: enrolled && driverKind(enrolled),
    approvedToDrive: canDrive(enrolled),
  }
}

// The line under the person's name on the sidebar's identity card
export function identityLabel(ws: VolunteerWorkspace): string {
  if (ws.experience === 'GENERAL_VOLUNTEER') return 'Volunteer'
  if (!ws.driverKind) return 'Volunteer workspace' // a driver account whose driver profile isn't there (or hasn't loaded)
  // Volunteer drivers are volunteers who take part in CareRide. Professional and organization drivers keep their own words.
  return ws.driverKind === 'VOLUNTEER_DRIVER' ? 'Volunteer · CareRide' : DRIVER_KIND_LABELS[ws.driverKind]
}

// The sentence under the Overview's greeting
export function overviewDescription(ws: VolunteerWorkspace): string {
  return ws.experience === 'GENERAL_VOLUNTEER'
    ? 'Your willingness to help makes a difference. Here’s your volunteering space.'
    : "Your time makes a difference. Here's what's happening in your workspace."
}

// What an interest means for this person today. Only Transportation has a service, and whether they drive for it
// comes from their driver profile, never from the interest.
export function interestStatus(interest: VolunteerInterest, ws: VolunteerWorkspace): string {
  if (interest === 'TRANSPORTATION') {
    if (ws.careRide === 'APPROVED') return 'You drive with CareRide.'
    if (ws.careRide === 'PENDING') return 'Your CareRide driver profile is being reviewed.'
    if (ws.careRide === 'REJECTED') return 'Your CareRide driver application wasn’t approved.'
  }
  return interestDefinition(interest).availability
}

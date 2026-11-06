import { driverAreaErrors, driverRequestErrors, driverVehicleErrors, type FieldErrors } from '../components/driverDraft'
import { DEFAULT_REQUEST_HOURS } from '../logic/requestHours'
import { isPhone } from '../logic/validate'
import type { CareRideApplication } from '../services/dataService'
import type { User } from '../types'
import type { CareRideEnrollment, VolunteerWorkspace } from './workspace'

// CareRide driver enrollment for an existing general volunteer (Phase 3, docs/architecture/volunteers.md).
//
// Applying is its own step, separate from choosing the Transportation interest, and separate again from being
// approved to drive. The backend (apply_to_careride()) checks everything here again, takes the account from the
// session, and only ever creates a PENDING driver profile. Nothing in this file grants anything.

// Who may start an application: an active general volunteer. Drivers have already applied (or signed up to
// drive); organization staff and admins take part in other ways. Interests play no part.
export function canApplyToCareRide(user: Pick<User, 'role'> | undefined): boolean {
  return user?.role === 'VOLUNTEER'
}

// What the workspace shows about CareRide. IN_PROGRESS is a draft saved on this device, nothing more: no driver
// profile exists until the backend accepts the application.
export type CareRideEnrollmentView = 'NOT_ENROLLED' | 'IN_PROGRESS' | Exclude<CareRideEnrollment, 'NOT_ENROLLED'>

export function careRideEnrollmentView(ws: Pick<VolunteerWorkspace, 'careRide'>, hasDraft: boolean): CareRideEnrollmentView {
  if (ws.careRide !== 'NOT_ENROLLED') return ws.careRide // a submitted application always wins over a stale draft
  return hasDraft ? 'IN_PROGRESS' : 'NOT_ENROLLED'
}

// The application form's state, saved as a draft per signed-in identity. Only these answers: never a password,
// a token or a document. The acknowledgement is asked again each time.
export interface CareRideDraft extends CareRideApplication {
  phone: string
  acknowledged: boolean
}

export const emptyCareRideDraft: CareRideDraft = {
  phone: '',
  vehicle: '',
  seats: 3,
  wheelchairAccessible: false,
  serviceCities: [],
  requestHours: DEFAULT_REQUEST_HOURS,
  acknowledged: false,
}

// A phone number is needed to drive. One already on the profile is used as it is; otherwise the applicant adds one.
export function needsPhone(user: Pick<User, 'phone'> | undefined): boolean {
  return !user?.phone?.trim()
}

export function enrollmentPhoneErrors(d: Pick<CareRideDraft, 'phone'>, phoneRequired: boolean): FieldErrors {
  return phoneRequired && !isPhone(d.phone) ? { phone: 'Enter a 10-digit phone number.' } : {}
}

// Every rule for a complete application, the same ones driver onboarding uses
export function careRideApplicationErrors(app: CareRideApplication, phoneRequired: boolean): FieldErrors {
  return {
    ...enrollmentPhoneErrors({ phone: app.phone ?? '' }, phoneRequired),
    ...driverVehicleErrors(app),
    ...driverAreaErrors(app),
    ...driverRequestErrors(app),
  }
}

// The first problem with an application, in the backend's words, or undefined when it can be sent
export function careRideApplicationError(app: CareRideApplication, phoneRequired: boolean): string | undefined {
  return Object.values(careRideApplicationErrors(app, phoneRequired))[0]
}

// Only what the backend reads, so nothing else from the draft (the acknowledgement, anything older) is sent
export function toApplication(d: CareRideDraft, phoneRequired: boolean): CareRideApplication {
  return {
    vehicle: d.vehicle.trim(),
    seats: d.seats,
    wheelchairAccessible: d.wheelchairAccessible,
    serviceCities: [...d.serviceCities],
    requestHours: d.requestHours,
    ...(phoneRequired ? { phone: d.phone.trim() } : {}),
  }
}

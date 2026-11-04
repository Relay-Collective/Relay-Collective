import type { Driver, User, VerificationStatus } from '../types'

// How someone takes part in Relay Collective, read from what the backend already records.
// Descriptive only: nothing here grants access. The database decides what each account may do.

// Today the only service a person can be approved for is transportation, as a driver.
export type ServiceId = 'TRANSPORTATION'

// The kind of driver, from how they joined. Professional status never stands in for approval.
export type DriverKind = 'VOLUNTEER_DRIVER' | 'PROFESSIONAL_PROVIDER' | 'ORGANIZATION_DRIVER'

export interface ServiceRole {
  service: ServiceId
  kind: DriverKind
  status: VerificationStatus
}

export const DRIVER_KIND_LABELS: Record<DriverKind, string> = {
  VOLUNTEER_DRIVER: 'Volunteer driver',
  PROFESSIONAL_PROVIDER: 'Professional transportation provider',
  ORGANIZATION_DRIVER: 'Organization-affiliated driver',
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
}

export function driverKind(driver: Pick<Driver, 'background' | 'orgId'>): DriverKind {
  if (driver.orgId || driver.background === 'ORG_DRIVER') return 'ORGANIZATION_DRIVER'
  if (driver.background === 'TAXI' || driver.background === 'RIDESHARE') return 'PROFESSIONAL_PROVIDER'
  return 'VOLUNTEER_DRIVER'
}

// Every service role this account holds. A driver profile only exists for a DRIVER account,
// so a profile left over on another kind of account never counts. Volunteering interests are not
// service roles and never appear here.
export function serviceRoles(user: Pick<User, 'role'> | undefined, driver: Driver | undefined): ServiceRole[] {
  if (user?.role !== 'DRIVER' || !driver) return []
  return [{ service: 'TRANSPORTATION', kind: driverKind(driver), status: driver.status }]
}

// How an account takes part, as the admin console tells them apart. A general volunteer is never a driver,
// and a driver is classified by their driver profile, never by volunteering interests.
export type ParticipantKind = 'GENERAL_VOLUNTEER' | DriverKind

export const PARTICIPANT_KIND_LABELS: Record<ParticipantKind, string> = {
  GENERAL_VOLUNTEER: 'General volunteer',
  ...DRIVER_KIND_LABELS,
}

// undefined for organization staff, providers and admins, and for a DRIVER account with no driver profile
export function participantKind(user: Pick<User, 'role'> | undefined, driver: Pick<Driver, 'background' | 'orgId'> | undefined): ParticipantKind | undefined {
  if (user?.role === 'VOLUNTEER') return 'GENERAL_VOLUNTEER'
  if (user?.role === 'DRIVER' && driver) return driverKind(driver)
  return undefined
}

// Someone who volunteers without being a CareRide driver. They use the volunteer workspace, without its driving pages.
export function isGeneralVolunteer(user: Pick<User, 'role'> | undefined): boolean {
  return user?.role === 'VOLUNTEER'
}

// Only approved drivers are sent ride requests and can take rides. The backend checks this again on every action.
export function canDrive(driver: Pick<Driver, 'status'> | undefined): boolean {
  return driver?.status === 'APPROVED'
}

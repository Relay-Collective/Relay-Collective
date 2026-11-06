import { DEFAULT_REQUEST_HOURS, requestHoursError } from '../logic/requestHours'
import { CITIES } from '../constants'
import { MAX_NAME, isPhone, tooLong } from '../logic/validate'
import type { NewDriver, NewDriverUser } from '../services/dataService'

// Form state for DriverFields: the driver's account details plus their driver profile.
export type DriverDraft = NewDriverUser & NewDriver

export const emptyDriverDraft: DriverDraft = {
  name: '',
  phone: '',
  background: 'TAXI',
  vehicle: '',
  wheelchairAccessible: false,
  seats: 3,
  serviceCities: [],
  requestHours: DEFAULT_REQUEST_HOURS,
}

export function splitDriverDraft({ name, phone, ...driver }: DriverDraft): [NewDriverUser, NewDriver] {
  return [{ name, phone }, driver]
}

export type FieldErrors = Record<string, string | undefined>

// The most passengers the backend accepts (private.insert_driver)
export const MAX_SEATS = 20

function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

// The rules for each part of a driver's sign-up, shared by driver onboarding and CareRide enrollment from the
// volunteer workspace. The backend (private.insert_driver) checks the same things again.
export function driverAboutErrors(d: Pick<DriverDraft, 'name' | 'phone'>): FieldErrors {
  return compact({
    name: d.name.trim() ? tooLong(d.name, MAX_NAME) : 'Enter your full name.',
    phone: isPhone(d.phone) ? undefined : 'Enter a 10-digit phone number.',
  })
}

export function driverVehicleErrors(d: Pick<DriverDraft, 'vehicle' | 'seats'>): FieldErrors {
  return compact({
    vehicle: d.vehicle.trim() ? tooLong(d.vehicle, MAX_NAME) : 'Describe your vehicle so clients can find it.',
    seats: Number.isInteger(d.seats) && d.seats >= 1 && d.seats <= MAX_SEATS ? undefined : 'Choose how many passengers your vehicle can take.',
  })
}

export function driverAreaErrors(d: Pick<DriverDraft, 'serviceCities'>): FieldErrors {
  return compact({
    serviceCities: !d.serviceCities.length
      ? 'Pick at least one city.'
      : d.serviceCities.every((c) => (CITIES as readonly string[]).includes(c))
        ? undefined
        : `Choose ${CITIES.join(' or ')}.`,
  })
}

export function driverRequestErrors(d: Pick<DriverDraft, 'requestHours'>): FieldErrors {
  return compact({ requestHours: requestHoursError(d.requestHours) })
}

export function needsProfessionalProof(value: Pick<DriverDraft, 'background'>): boolean {
  return value.background === 'TAXI' || value.background === 'RIDESHARE'
}

// Every check for a driver added in one go, e.g. by a transport provider for one of its drivers
export function validateDriverDraft(d: DriverDraft): FieldErrors {
  const errors: FieldErrors = {
    name: !d.name.trim() ? "Please enter the driver's name." : tooLong(d.name, MAX_NAME),
    phone: isPhone(d.phone) ? undefined : 'Please enter a 10-digit phone number.',
    vehicle: !d.vehicle.trim() ? 'Describe the vehicle so clients can find it.' : tooLong(d.vehicle, MAX_NAME),
    serviceCities: d.serviceCities.length ? undefined : 'Pick at least one city.',
    requestHours: requestHoursError(d.requestHours),
    licenceFile: d.licenceFile ? undefined : "Please add the driver's licence.",
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

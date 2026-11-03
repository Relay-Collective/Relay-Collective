import type { Driver, Ride, RideOffer } from '../types'
import { hasAnyHours } from './requestHours'
import { finishedAt } from '../modules/careride/domain'

// What a driver's own rides and requests add up to, for the volunteer workspace.
// Built only from records the backend returns for this driver; nothing is estimated.

// The driver has set off, reached the pickup, or has the client in the car.
export const isUnderWay = (r: Ride) => r.status === 'PICKED_UP' || (r.status === 'ACCEPTED' && (!!r.driverOnTheWayAt || !!r.driverArrivedAt))

export interface DriverRideGroups {
  active: Ride[] // under way now, the one to show first
  upcoming: Ride[] // accepted, not started, soonest first
  completed: Ride[] // dropped off, or the client didn't show; newest first
  cancelled: Ride[] // called off after this driver accepted; newest first
}

const byPickup = (a: Ride, b: Ride) => a.pickupTime.localeCompare(b.pickupTime)
const newestFirst = (a: Ride, b: Ride) => finishedAt(b).localeCompare(finishedAt(a))

export function groupDriverRides(rides: Ride[]): DriverRideGroups {
  return {
    active: rides.filter(isUnderWay).sort(byPickup),
    upcoming: rides.filter((r) => r.status === 'ACCEPTED' && !isUnderWay(r)).sort(byPickup),
    completed: rides.filter((r) => r.status === 'COMPLETED' || r.status === 'NO_SHOW').sort(newestFirst),
    cancelled: rides.filter((r) => r.status === 'CANCELLED').sort(newestFirst),
  }
}

// A request the driver can still answer, with the ride it's for
export interface OpenOffer {
  offer: RideOffer
  ride: Ride
}

export interface ImpactSummary {
  ridesCompleted: number // drop-offs only; a no-show isn't counted as a ride given
  passengersDriven: number // from each completed ride's passenger count
  thisMonth: number
}

export function impactSummary(rides: Ride[], now = new Date()): ImpactSummary {
  const completed = rides.filter((r) => r.status === 'COMPLETED')
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return {
    ridesCompleted: completed.length,
    passengersDriven: completed.reduce((sum, r) => sum + r.passengers, 0),
    thisMonth: completed.filter((r) => Date.parse(finishedAt(r)) >= monthStart).length,
  }
}

export type ActionKind = 'VERIFICATION_PENDING' | 'VERIFICATION_REJECTED' | 'RECONFIRM' | 'RESPOND' | 'UNDER_WAY' | 'SOON' | 'NO_HOURS' | 'PROFILE_INCOMPLETE'

export interface VolunteerAction {
  kind: ActionKind
  title: string
  detail: string
  rideId?: string // the ride it's about, if any
  urgent: boolean
}

// A ride picking up within this long counts as coming up soon
export const SOON_HOURS = 24

// Tasks that need the driver, most urgent first. Each one comes from a real state, so it goes away once dealt with.
export function volunteerActions(driver: Driver | undefined, rides: DriverRideGroups | undefined, offers: OpenOffer[] | undefined, now = new Date()): VolunteerAction[] {
  if (!driver) return []
  if (driver.status === 'PENDING') {
    return [{ kind: 'VERIFICATION_PENDING', title: 'Driver application under review', detail: 'The Relay Collective team reviews every driver before the first request.', urgent: false }]
  }
  if (driver.status === 'REJECTED') {
    return [{ kind: 'VERIFICATION_REJECTED', title: 'Driver application not approved', detail: 'You won’t receive ride requests. Contact the Relay Collective team with questions.', urgent: false }]
  }

  const items: VolunteerAction[] = []
  for (const { ride } of offers ?? []) {
    if (ride.reconfirmDriverId === driver.id) {
      items.push({ kind: 'RECONFIRM', title: `Confirm the changed ride to ${ride.destinationName}`, detail: 'The organization changed a ride you’d accepted. Keep it or let it go.', rideId: ride.id, urgent: true })
    }
  }
  const fresh = (offers ?? []).filter(({ ride }) => ride.reconfirmDriverId !== driver.id)
  if (fresh.length) {
    items.push({
      kind: 'RESPOND',
      title: `${fresh.length} ride ${fresh.length === 1 ? 'request is' : 'requests are'} waiting for you`,
      detail: 'Accept the ones that suit you and decline the rest.',
      urgent: true,
    })
  }
  for (const ride of rides?.active ?? []) {
    items.push({ kind: 'UNDER_WAY', title: `Trip under way to ${ride.destinationName}`, detail: 'Update each step when you’re safely stopped.', rideId: ride.id, urgent: true })
  }
  const soonLimit = now.getTime() + SOON_HOURS * 3_600_000
  for (const ride of rides?.upcoming ?? []) {
    if (ride.type === 'ON_DEMAND' || Date.parse(ride.pickupTime) <= soonLimit) {
      items.push({ kind: 'SOON', title: `Upcoming ride to ${ride.destinationName}`, detail: ride.type === 'ON_DEMAND' ? 'As soon as you can.' : 'Picking up within a day.', rideId: ride.id, urgent: false })
    }
  }
  if (!hasAnyHours(driver.requestHours)) {
    items.push({ kind: 'NO_HOURS', title: 'Set your availability', detail: 'You have no request hours, so no requests will reach you.', urgent: false })
  }
  if (!driver.vehicle.trim() || driver.serviceCities.length === 0) {
    items.push({ kind: 'PROFILE_INCOMPLETE', title: 'Finish your driver profile', detail: 'Add your vehicle and the cities you drive in.', urgent: false })
  }
  return items
}

// One upcoming piece of work, whatever the service. Transportation is the only kind today.
export interface Commitment {
  id: string
  service: 'TRANSPORTATION'
  title: string
  startsAt: string // ISO; for an on-demand ride, when it was booked
  asSoonAsPossible: boolean
  underWay: boolean
  ride: Ride
}

export function commitmentsFrom(groups: DriverRideGroups): Commitment[] {
  return [...groups.active, ...groups.upcoming].map((ride) => ({
    id: ride.id,
    service: 'TRANSPORTATION',
    title: `Ride to ${ride.destinationName}`,
    startsAt: ride.pickupTime,
    asSoonAsPossible: ride.type === 'ON_DEMAND',
    underWay: isUnderWay(ride),
    ride,
  }))
}

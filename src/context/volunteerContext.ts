import { createContext } from 'react'
import type { Loadable } from '../hooks/useLoadable'
import type { DriverRideGroups, OpenOffer } from '../logic/volunteerSummary'
import type { Driver, House, Ride, RideFeedback, VolunteerProfile } from '../types'
import type { VolunteerWorkspace } from '../volunteer/workspace'

// What every volunteer workspace page shares: who this volunteer is (their volunteer profile and interests), and for
// CareRide drivers their driver profile, rides, and the requests waiting on them.
// Loaded once by the workspace shell, so the sidebar, header, and pages don't each ask again.
export interface VolunteerState {
  workspace: VolunteerWorkspace // what to show this person; presentation only, never authorization
  volunteer: Loadable<VolunteerProfile | null> // null once loaded when the account has none (e.g. a driver from before interests)
  driver: Driver | undefined // undefined while loading, or when this account has no driver profile
  driverLoaded: boolean
  rides: Loadable<Ride[]> // rides this driver accepted, whatever happened to them
  groups: DriverRideGroups | undefined
  offers: Loadable<OpenOffer[]> // requests waiting for this driver's answer
  houseOf: (ride: Ride) => House | undefined // the pickup location, visible once the driver is on the ride
  feedback: RideFeedback[] // issues this driver flagged
  celebrate: (ride: Ride) => void // thank the driver after a drop-off, wherever they tapped it
}

export const VolunteerContext = createContext<VolunteerState | undefined>(undefined)

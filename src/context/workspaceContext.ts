import { createContext } from 'react'
import type { Loadable } from '../hooks/useLoadable'
import type { DriverInfo, House, OrgRole, Organization, Ride } from '../types'

// What every workspace page shares: the signed-in organization, its location, and its requests.
// Loaded once by the workspace shell, so the sidebar, header, and pages don't each ask again.
export interface WorkspaceState {
  org: Organization | undefined
  house: House | undefined
  rides: Loadable<Ride[]> // transportation requests booked from this organization's location
  driverOf: (ride: Ride) => DriverInfo | undefined
  // The signed-in member's role in the organization, as the backend last said. Screens use it to show
  // or hide management; the backend checks it again on every change.
  orgRole: OrgRole | undefined
  isAdmin: boolean
  pendingJoinRequests: number | undefined // administrators only
  pendingJoinRequestIds: string[] // administrators only, for "new request" notices
}

export const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined)

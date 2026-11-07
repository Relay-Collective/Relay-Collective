import { createContext } from 'react'
import type { Loadable } from '../hooks/useLoadable'
import type { Driver, FeedbackSummary, House, Organization, Ride, RideFeedback, User } from '../types'

// What every admin page shares, loaded once by the admin shell. Each read is admin-only in the
// database (access rules and admin functions), so a non-admin who got here would get nothing back.
export interface AdminState {
  orgs: Loadable<Organization[]>
  drivers: Loadable<Driver[]>
  accounts: Loadable<User[]> // everyone who can sign in, with their login email
  people: Loadable<User[]> // every profile, including drivers added without a sign-in
  houses: Loadable<House[]>
  rides: Loadable<Ride[]> // transportation requests, newest pickup first (capped)
  feedback: Loadable<RideFeedback[]>
  feedbackSummary: Loadable<FeedbackSummary> // Feedback & Suggestions totals, by status
  personName: (userId?: string) => string | undefined
  orgName: (orgId?: string) => string | undefined
  driverName: (driverId?: string) => string | undefined
}

export const AdminContext = createContext<AdminState | undefined>(undefined)

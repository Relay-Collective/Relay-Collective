import { createContext } from 'react'
import type { Session } from '../services/dataService'
import type { Identity, User } from '../types'

export interface AppState {
  users: User[]
  // Who is signed in. identity is set as soon as someone is signed in; currentUser only once they have a
  // Relay Collective role (from onboarding). Both come from the backend, never from what a screen chose.
  identity: Identity | undefined
  currentUser: User | undefined
  ready: boolean // the session check has finished, so identity and currentUser can be trusted
  sessionError: string | undefined // signed in (or trying to be), but the account couldn't be loaded
  sessionExpired: boolean // was signed in, then the session ended without signing out (expiry, revoked elsewhere)
  signIn: (email: string, password: string) => Promise<Session> // throws with a message to show
  signOut: () => Promise<void>
  retrySession: () => void
  // Asks the backend again who is signed in, e.g. after onboarding created a profile. Resolves with the result.
  reloadSession: () => Promise<Session | undefined>
  // Bumped after every change so screens reload their data
  version: number
  refresh: () => void
  // The first data load currently failing on screen, if any (shown with a "Try again" banner)
  loadError: string | undefined
  setLoadError: (key: string, message: string | undefined) => void
}

export const AppContext = createContext<AppState | undefined>(undefined)

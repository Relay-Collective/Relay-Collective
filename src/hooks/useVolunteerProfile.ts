import { dataService } from '../services'
import type { VolunteerProfile } from '../types'
import { useApp } from './useApp'
import { useLoadable, type Loadable } from './useLoadable'

// The signed-in person's volunteer profile and interests. data is undefined while loading; null once
// loaded when the account has none. Reloads after any change (useApp's refresh).
export function useMyVolunteerProfile(): Loadable<VolunteerProfile | null> {
  const { currentUser } = useApp()
  const userId = currentUser?.id ?? ''
  return useLoadable(async () => (userId ? (await dataService.getVolunteerProfile(userId)) ?? null : null), userId)
}

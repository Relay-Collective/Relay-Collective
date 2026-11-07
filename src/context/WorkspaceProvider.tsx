import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useApp } from '../hooks/useApp'
import { useData } from '../hooks/useData'
import { useLoadable } from '../hooks/useLoadable'
import { dataService } from '../services'
import type { Ride } from '../types'
import { WorkspaceContext } from './workspaceContext'

// The organization comes from the signed-in account, never from the address bar.
// The database decides which rows that account may read; this only picks its own.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { currentUser, users, reloadSession } = useApp()
  const orgId = currentUser?.orgId
  const orgs = useData(() => dataService.listOrganizations(), orgId)
  const org = orgs?.find((o) => o.id === orgId)
  const houseId = currentUser?.houseId ?? ''
  const house = useData(() => dataService.listHouses(orgId), orgId)?.find((h) => h.id === houseId)
  const rides = useLoadable(() => (houseId ? dataService.listRidesForHouse(houseId) : Promise.resolve([])), houseId)
  const drivers = useData(() => dataService.listDrivers())

  const driverOf = useCallback(
    (r: Ride) => {
      const d = drivers?.find((x) => x.id === r.driverId)
      return d && { name: users.find((u) => u.id === d.userId)?.name, vehicle: d.vehicle }
    },
    [drivers, users],
  )

  // Roles change while people are signed in (an administrator promotes or demotes them), so the team list,
  // reloaded with everything else, is what says what this person can manage now.
  const team = useLoadable(() => (orgId ? dataService.listOrganizationMembers() : Promise.resolve([])), currentUser?.id)
  const orgRole = team.data?.find((m) => m.isYou)?.role ?? currentUser?.orgRole
  const isAdmin = orgRole === 'ADMIN'
  const requests = useLoadable(() => (isAdmin ? dataService.listJoinRequests('pending') : Promise.resolve([])), isAdmin ? orgId : '')
  const pendingJoinRequests = isAdmin ? requests.data?.length : undefined
  const pendingIds = isAdmin ? requests.data?.map((r) => r.id).join(',') ?? '' : ''
  const pendingJoinRequestIds = useMemo(() => (pendingIds ? pendingIds.split(',') : []), [pendingIds])

  // Removed from the organization: the backend stops showing it at once. Ask who this login is now,
  // which sends them to onboarding instead of an empty workspace. Once per load.
  const checkedRemoval = useRef<unknown>(undefined)
  useEffect(() => {
    if (!orgs || !orgId || org || checkedRemoval.current === orgs) return
    checkedRemoval.current = orgs
    reloadSession().catch(() => {})
  }, [orgs, orgId, org, reloadSession])

  const value = useMemo(
    () => ({ org, house, rides, driverOf, orgRole, isAdmin, pendingJoinRequests, pendingJoinRequestIds }),
    [org, house, rides, driverOf, orgRole, isAdmin, pendingJoinRequests, pendingJoinRequestIds],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

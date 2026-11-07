import { useCallback, useMemo, type ReactNode } from 'react'
import { useLoadable } from '../hooks/useLoadable'
import { dataService } from '../services'
import { AdminContext } from './adminContext'

export function AdminProvider({ children }: { children: ReactNode }) {
  const orgs = useLoadable(() => dataService.listOrganizations())
  const drivers = useLoadable(() => dataService.listDrivers())
  const accounts = useLoadable(() => dataService.listAccounts())
  const people = useLoadable(() => dataService.listUsers())
  const houses = useLoadable(() => dataService.listHouses())
  const rides = useLoadable(() => dataService.listAllRides())
  const feedback = useLoadable(() => dataService.listFeedback({}))
  const feedbackSummary = useLoadable(() => dataService.getFeedbackSummary())

  const personName = useCallback((id?: string) => (id ? people.data?.find((u) => u.id === id)?.name : undefined), [people.data])
  const orgName = useCallback((id?: string) => (id ? orgs.data?.find((o) => o.id === id)?.name : undefined), [orgs.data])
  const driverName = useCallback(
    (id?: string) => personName(drivers.data?.find((d) => d.id === id)?.userId),
    [drivers.data, personName],
  )

  const value = useMemo(
    () => ({ orgs, drivers, accounts, people, houses, rides, feedback, feedbackSummary, personName, orgName, driverName }),
    [orgs, drivers, accounts, people, houses, rides, feedback, feedbackSummary, personName, orgName, driverName],
  )
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

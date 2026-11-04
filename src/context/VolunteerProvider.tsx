import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RideCelebration } from '../components/RideCelebration'
import { useApp } from '../hooks/useApp'
import { useData } from '../hooks/useData'
import { useLoadable } from '../hooks/useLoadable'
import { groupDriverRides } from '../logic/volunteerSummary'
import { buzz } from '../native/platform'
import { dataService } from '../services'
import type { Ride } from '../types'
import { canDrive } from '../volunteer/participation'
import { VolunteerContext } from './volunteerContext'

// The driver comes from the signed-in account, never from the address bar.
// The database decides which rows that account may read; this only picks its own.
export function VolunteerProvider({ children }: { children: ReactNode }) {
  const { currentUser, refresh } = useApp()
  const [celebrating, setCelebrating] = useState<{ ride: Ride; count: number }>()
  // Only a DRIVER account has a driver profile; a general volunteer's workspace never asks for one
  const userId = currentUser?.role === 'DRIVER' ? currentUser.id : ''
  const drivers = useLoadable(() => (userId ? dataService.listDrivers() : Promise.resolve([])), userId)
  const driver = drivers.data?.find((d) => d.userId === userId)
  // Requests and rides only reach approved drivers, so there's nothing to ask for before then
  const driverId = canDrive(driver) ? driver!.id : ''

  const rides = useLoadable(() => (driverId ? dataService.listMyRides(driverId) : Promise.resolve([])), driverId)
  const offers = useLoadable(async () => {
    if (!driverId) return []
    const pending = await dataService.listMyOffers(driverId)
    const found = await Promise.all(pending.map((o) => dataService.getRide(o.rideId)))
    return pending.flatMap((offer, i) => (found[i] ? [{ offer, ride: found[i] }] : []))
  }, driverId)
  const houses = useData(() => (driverId ? dataService.listHouses() : Promise.resolve([])), driverId)
  const feedback = useData(() => (driverId ? dataService.listMyFeedback() : Promise.resolve([])), driverId)

  // A short buzz on the phone when a new request arrives, not on first load
  const lastOfferCount = useRef<number>(undefined)
  const offerCount = offers.data?.length
  useEffect(() => {
    if (offerCount === undefined) return
    if (lastOfferCount.current !== undefined && offerCount > lastOfferCount.current) void buzz()
    lastOfferCount.current = offerCount
  }, [offerCount])

  const houseOf = useCallback((r: Ride) => houses?.find((h) => h.id === r.houseId), [houses])
  const groups = useMemo(() => rides.data && groupDriverRides(rides.data), [rides.data])

  // The count includes the ride just finished, which the loaded list may not have caught up with yet
  const completedCount = rides.data?.filter((r) => r.status === 'COMPLETED').length ?? 0
  const celebrate = useCallback(
    (ride: Ride) => setCelebrating({ ride, count: completedCount + (rides.data?.some((r) => r.id === ride.id && r.status === 'COMPLETED') ? 0 : 1) }),
    [completedCount, rides.data],
  )

  async function undoCelebrated(ride: Ride) {
    setCelebrating(undefined)
    try {
      await dataService.undoDriverStep(ride.id, driverId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
    refresh()
  }

  const value = useMemo(
    () => ({ driver, driverLoaded: !!drivers.data, rides, groups, offers, houseOf, feedback: feedback ?? [], celebrate }),
    [driver, drivers.data, rides, groups, offers, houseOf, feedback, celebrate],
  )
  return (
    <VolunteerContext.Provider value={value}>
      {children}
      {celebrating && (
        <RideCelebration
          ride={celebrating.ride}
          count={celebrating.count}
          onClose={() => setCelebrating(undefined)}
          onUndo={() => void undoCelebrated(celebrating.ride)}
        />
      )}
    </VolunteerContext.Provider>
  )
}

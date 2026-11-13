import { Accessibility, CalendarClock, HandHelping, LoaderCircle, MapPin, RefreshCw, Users } from 'lucide-react'
import { useState } from 'react'
import { useDriverLocation } from '../../hooks/useMaps'
import { useApp } from '../../hooks/useApp'
import { suggestInstallAfterAcceptance } from '../../pwa/browser'
import { formatDayTime, formatTime } from '../../logic/formatTime'
import { isRealAddress } from '../../logic/maps'
import { passengersLabel } from '../../modules/careride/domain'
import { dataService } from '../../services'
import type { Ride, RideOffer } from '../../types'
import { DriveTimes } from '../maps/DriveTimes'
import { RouteMap } from '../maps/RouteMap'
import { primaryButton, secondaryButton } from '../ui'
import { panel } from '../workspace/styles'

export interface Answer {
  accepted: boolean
  ride: Ride
}

interface Props {
  offer: RideOffer
  ride: Ride
  from?: string // pickup area, e.g. the organization's location and city; the street address shows after accepting
  changed?: boolean // the driver had accepted this ride, and the organization changed it
  showMap?: boolean // one map per request costs a Maps load each, so only the full list shows them
  onAnswered: (answer: Answer) => void
}

// A ride request as a driver decides on it: where, when, and what the passengers need, then Accept or Decline.
// Eligibility was decided by the backend before the request was sent; answering is checked again there.
export function OpportunityCard({ offer, ride, from, changed, showMap = false, onAnswered }: Props) {
  const { currentUser } = useApp()
  const [busy, setBusy] = useState<'accept' | 'decline'>()
  const [error, setError] = useState<string>()
  const pickup = isRealAddress(ride.pickupAddress) ? ride.pickupAddress : undefined
  const dropoff = isRealAddress(ride.destinationAddress) ? ride.destinationAddress : undefined
  const location = useDriverLocation(showMap)

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline')
    setError(undefined)
    try {
      const result = await dataService.respondToOffer(offer.id, accept)
      if (accept && currentUser?.role === 'DRIVER') suggestInstallAfterAcceptance(currentUser.id)
      onAnswered({ accepted: accept, ride: result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(undefined)
    }
  }

  const needs = [
    ride.needsWheelchair && { icon: Accessibility, text: 'Wheelchair accessible vehicle' },
    ride.needsAssistance && { icon: HandHelping, text: 'Help getting in and out' },
  ].filter(Boolean) as { icon: typeof Users; text: string }[]

  return (
    <article className={`${panel} overflow-hidden`} aria-labelledby={`offer-${offer.id}-title`}>
      {changed && (
        <p className="flex items-start gap-2 border-b border-amber-200 bg-sun-50 px-5 py-3 text-sm text-amber-900">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Changed by the organization.</strong> You'd accepted this ride. Check the new details and confirm again.
          </span>
        </p>
      )}
      <div className={showMap && pickup && dropoff ? 'flex flex-col gap-4 p-5 sm:flex-row-reverse sm:items-start' : 'p-5'}>
        {showMap && pickup && dropoff && (
          <RouteMap pickup={pickup} dropoff={dropoff} driver={location.coords} className="h-44 w-full sm:h-52 sm:w-72 sm:shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <span className="rounded-full bg-rc-mint px-2.5 py-0.5 text-xs font-semibold text-rc-teal-ink">CareRide</span>
            {ride.type === 'ON_DEMAND' ? 'On demand' : 'Scheduled'}
            {ride.returnOfRideId && ' · Return trip'}
          </div>

          <dl className="space-y-2">
            {from && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Pickup area</dt>
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <dd className="text-slate-700">{from}</dd>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Destination</dt>
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-rc-blue" aria-hidden />
              <dd id={`offer-${offer.id}-title`} className="font-heading text-lg font-bold text-rc-navy">
                {ride.destinationName}
              </dd>
            </div>
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Pickup time</dt>
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <dd className="font-semibold text-rc-navy">{ride.type === 'ON_DEMAND' ? 'As soon as you can' : formatDayTime(ride.pickupTime)}</dd>
            </div>
            <div className="flex items-start gap-2.5">
              <dt className="sr-only">Passengers</dt>
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <dd className="text-slate-700">{passengersLabel(ride.passengers)}</dd>
            </div>
          </dl>

          {needs.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Accessibility requirements">
              {needs.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-rc-blue">
                  <Icon className="h-4 w-4" aria-hidden /> {text}
                </li>
              ))}
            </ul>
          )}

          {showMap && <DriveTimes pickup={pickup} dropoff={dropoff} fromMe />}

          <p className="text-sm text-slate-600">Please answer by {formatTime(offer.expiresAt)}. You can always decline.</p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button type="button" className={`${primaryButton} px-2 whitespace-normal text-center sm:px-5`} disabled={!!busy} onClick={() => respond(true)}>
              {busy === 'accept' && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
              {changed ? 'Keep the ride' : 'Accept'}
            </button>
            <button type="button" className={`${secondaryButton} px-2 sm:px-5`} disabled={!!busy} onClick={() => respond(false)}>
              {busy === 'decline' && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
              Decline
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

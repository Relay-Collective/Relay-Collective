import { ArrowRight, ShieldAlert, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { useVolunteer } from '../../hooks/useVolunteer'
import { canUndoFinish } from '../../logic/dispatch'
import { formatDayTime } from '../../logic/formatTime'
import { dataService } from '../../services'
import type { Ride } from '../../types'
import { volunteerPaths } from '../../volunteer/paths'
import { Notice } from '../admin/controls'
import { DriverTripActions } from '../DriverTripActions'
import { panel, panelHead, panelLink, panelTitle } from '../workspace/styles'
import { RideStatusBadge } from './RideStatusBadge'

// A reminder shown with every trip in progress. Steps are meant to be tapped while parked.
export function SafetyNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-rc-canvas px-4 py-3 text-sm text-slate-700">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rc-teal-ink" aria-hidden />
      <span>
        <strong className="font-semibold text-rc-navy">Only use the app when you're safely stopped.</strong> Update each step when you're parked,
        and call the front desk if anything changes.
      </span>
    </p>
  )
}

// The ride the driver is doing, with its trip steps. Only the next valid step has a button, and the backend
// checks every step again, so a stale screen can't skip ahead.
export function TripPanel({ ride, headingId, title, showDetailsLink = true }: { ride: Ride; headingId: string; title: string; showDetailsLink?: boolean }) {
  const { refresh } = useApp()
  const { driver, houseOf, celebrate } = useVolunteer()

  return (
    <section aria-labelledby={headingId} className={panel}>
      <div className={panelHead}>
        <div className="min-w-0">
          <h2 id={headingId} className={`${panelTitle} scroll-mt-28`}>
            {title}
          </h2>
          <p className="text-sm text-slate-500">{ride.type === 'ON_DEMAND' ? 'On demand · as soon as you can' : formatDayTime(ride.pickupTime)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* On the ride's own page the status is already in the page header */}
          {showDetailsLink && (
            <>
              <RideStatusBadge ride={ride} />
              <Link to={volunteerPaths.ride(ride.id)} className={panelLink}>
                Details <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="font-heading text-lg font-bold text-rc-navy">To {ride.destinationName}</p>
        <SafetyNote />
        <DriverTripActions
          ride={ride}
          house={houseOf(ride)}
          driverId={driver?.id ?? ''}
          onDone={refresh}
          onCompleted={celebrate}
          showMap
        />
      </div>
    </section>
  )
}

// Taking back "dropped off" or "didn't show" for a few minutes after, in case it was tapped by mistake
export function UndoFinish({ ride }: { ride: Ride }) {
  const { refresh } = useApp()
  const { driver } = useVolunteer()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!canUndoFinish(ride)) return null

  async function undo() {
    setBusy(true)
    setError(undefined)
    try {
      await dataService.undoDriverStep(ride.id, driver?.id ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={undo}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-rc-navy disabled:opacity-50"
      >
        <Undo2 className="h-4 w-4" aria-hidden />
        {ride.status === 'COMPLETED' ? 'Undo the drop-off' : 'Undo “didn’t show”'}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

import { Accessibility, ChevronRight, HandHelping } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { dayLabel, formatTime } from '../../logic/formatTime'
import { passengersLabel } from '../../modules/careride/domain'
import type { House, Ride } from '../../types'
import { volunteerPaths } from '../../volunteer/paths'
import { focusRing } from '../workspace/styles'
import { RideStatusBadge } from './RideStatusBadge'

// One ride in a list, opening its detail page. Shows only what the driver needs to recognise it.
export function AssignmentRow({ ride, house, now, when = 'pickup', children }: { ride: Ride; house?: House; now: number; when?: 'pickup' | 'finished'; children?: ReactNode }) {
  const at = when === 'finished' ? (ride.completedAt ?? ride.cancelledAt ?? ride.pickupTime) : ride.pickupTime
  const ms = Date.parse(at)
  const asap = when === 'pickup' && ride.type === 'ON_DEMAND'
  return (
    <li>
      <Link to={volunteerPaths.ride(ride.id)} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 ${focusRing}`}>
        <span className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-rc-canvas px-1 py-2 text-center" aria-hidden>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{asap ? 'Now' : dayLabel(ms, now)}</span>
          <span className="text-sm font-bold tabular-nums text-rc-navy">{asap ? 'ASAP' : formatTime(at)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-rc-navy">
            <span className="sr-only">{asap ? 'As soon as possible' : `${dayLabel(ms, now)} at ${formatTime(at)}`}: </span>
            Ride to {ride.destinationName}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            {house && <span className="truncate">From {house.name}</span>}
            <span>{passengersLabel(ride.passengers)}</span>
            {ride.needsWheelchair && (
              <span className="inline-flex items-center gap-1">
                <Accessibility className="h-3.5 w-3.5" aria-hidden /> Wheelchair
              </span>
            )}
            {ride.needsAssistance && (
              <span className="inline-flex items-center gap-1">
                <HandHelping className="h-3.5 w-3.5" aria-hidden /> Assistance
              </span>
            )}
          </span>
          <span className="mt-1.5 block sm:hidden">
            <RideStatusBadge ride={ride} />
          </span>
        </span>
        <span className="hidden shrink-0 sm:block">
          <RideStatusBadge ride={ride} />
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
      </Link>
      {children && <div className="px-5 pb-3">{children}</div>}
    </li>
  )
}

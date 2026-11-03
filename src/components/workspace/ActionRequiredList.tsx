import { ChevronRight, Clock, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dayLabel, formatTime } from '../../logic/formatTime'
import type { ActionItem } from '../../modules/careride/domain'
import { paths } from '../../workspace/paths'
import { focusRing } from './styles'

const URGENCY = {
  urgent: { label: 'Needs action', icon: TriangleAlert, chip: 'bg-care-red text-white', row: 'bg-red-50/50 hover:bg-red-50' },
  soon: { label: 'Pickup soon', icon: Clock, chip: 'bg-sun-400 text-ink', row: 'hover:bg-slate-50' },
} as const

// Requests staff should look at, most urgent first. Each one opens the ride, where the fix is.
// Urgency is said in words and an icon, never colour alone.
export function ActionRequiredList({ items, now, limit }: { items: ActionItem[]; now: number; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items
  return (
    <ul className="divide-y divide-slate-100">
      {shown.map(({ ride, urgency, title, reason }) => {
        const u = URGENCY[urgency]
        const Icon = u.icon
        const when =
          ride.type === 'ON_DEMAND' ? 'As soon as possible' : `${dayLabel(new Date(ride.pickupTime).getTime(), now)}, ${formatTime(ride.pickupTime)}`
        return (
          <li key={ride.id}>
            <Link to={paths.ride(ride.id)} className={`group flex items-start gap-3 px-5 py-4 transition ${u.row} ${focusRing} focus-visible:ring-inset`}>
              <span className="min-w-0 flex-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${u.chip}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  {u.label}
                </span>
                <span className="mt-1.5 block font-semibold text-rc-navy">
                  {title}
                  <span className="font-normal text-slate-600">
                    {' '}
                    · {ride.returnOfRideId ? 'Return from' : 'Ride to'} {ride.destinationName}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">{reason}</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">Pickup: {when}</span>
              </span>
              <span className="mt-6 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-rc-blue">
                <span className="max-sm:sr-only">Review</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

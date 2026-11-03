import { Ban, Bus, CalendarPlus, CarFront, Check, CircleCheck, SearchX, UserX, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dayLabel, formatTime } from '../../logic/formatTime'
import { ACTIVITY_TEXT, type ActivityItem, type ActivityKind } from '../../modules/careride/domain'
import { paths } from '../../workspace/paths'
import { focusRing } from './styles'

const ICON: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  REQUESTED: { icon: CalendarPlus, tone: 'bg-brand-50 text-rc-blue' },
  CONFIRMED: { icon: Check, tone: 'bg-emerald-50 text-emerald-700' },
  PICKED_UP: { icon: CarFront, tone: 'bg-cyan-50 text-cyan-800' },
  COMPLETED: { icon: CircleCheck, tone: 'bg-emerald-50 text-emerald-800' },
  NO_SHOW: { icon: UserX, tone: 'bg-coral-50 text-coral-700' },
  TRANSIT: { icon: Bus, tone: 'bg-teal-50 text-teal-700' },
  EXPIRED: { icon: SearchX, tone: 'bg-slate-100 text-slate-600' },
  CANCELLED: { icon: Ban, tone: 'bg-slate-100 text-slate-600' },
}

// What happened lately, newest first, under a heading for each day. Names the place, never the rider.
// The icons sit on one thin line, so a ride's steps read as a timeline rather than a list of rows.
export function RecentActivityList({ items, now }: { items: ActivityItem[]; now: number }) {
  const days: { label: string; items: ActivityItem[] }[] = []
  for (const item of items) {
    const label = dayLabel(new Date(item.at).getTime(), now)
    const last = days[days.length - 1]
    if (last?.label === label) last.items.push(item)
    else days.push({ label, items: [item] })
  }

  return (
    <div className="pb-2">
      {days.map((day) => (
        <section key={day.label} aria-label={day.label}>
          <h3 className="px-5 pb-1 pt-4 font-sans text-[13px] font-semibold text-slate-500">{day.label}</h3>
          <ol className="relative before:absolute before:bottom-5 before:left-[2.25rem] before:top-5 before:w-px before:bg-slate-200">
            {day.items.map(({ id, ride, kind, at }) => {
              const { icon: Icon, tone } = ICON[kind]
              return (
                <li key={id} className="relative">
                  <Link
                    to={paths.ride(ride.id)}
                    className={`group flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 ease-out-quart hover:bg-slate-50 ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}
                  >
                    <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white group-hover:ring-slate-50 ${tone}`} aria-hidden>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-rc-navy">{ACTIVITY_TEXT[kind]}</span>
                      <span className="block truncate text-sm text-slate-600">
                        {ride.returnOfRideId ? 'Return from' : 'To'} {ride.destinationName}
                      </span>
                    </span>
                    <time dateTime={at} title={new Date(at).toLocaleString()} className="shrink-0 text-[13px] font-medium tabular-nums text-slate-500">
                      {formatTime(at)}
                    </time>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

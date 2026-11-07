import { BellRing, MoonStar, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ALL_DAY,
  describeRequestHours,
  formatTime,
  isWithinRequestHours,
  nextRequestStart,
} from '../logic/requestHours'
import type { Driver } from '../types'
import { volunteerPaths } from '../volunteer/paths'
import { panel } from './workspace/styles'

interface Props {
  driver: Driver
  showSettingsLink?: boolean
}

// "today at 9 AM", "tomorrow at 9 AM", "Monday at 9 AM"
function describeStart(start: Date, now: Date): string {
  const days = Math.round(
    (new Date(start).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  )
  const day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : start.toLocaleDateString(undefined, { weekday: 'long' })
  return `${day} at ${formatTime(start.toTimeString().slice(0, 5))}`
}

// Whether the driver is getting requests right now, and when that changes. There's no pause switch: drivers just decline what doesn't suit them.
export function RequestStatusCard({ driver, showSettingsLink = false }: Props) {
  const now = new Date()
  const window = driver.requestHours[now.getDay()]
  const inHours = isWithinRequestHours(driver.requestHours, now)
  const next = nextRequestStart(driver.requestHours, now)

  return (
    <section className={`${panel} flex flex-wrap items-center gap-3 p-5`} aria-live="polite">
      <span
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${inHours ? 'bg-rc-mint text-rc-teal-ink' : 'bg-slate-100 text-slate-600'}`}
        aria-hidden
      >
        {inHours ? <BellRing className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
        {inHours && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-rc-teal" />}
      </span>
      <div className="min-w-[13rem] flex-1">
        <h2 className="font-heading text-base font-bold text-rc-navy">{inHours ? 'Taking requests now' : 'Outside your request hours'}</h2>
        <p className="text-sm text-slate-600">
          {inHours
            ? window && window.to === ALL_DAY.to && window.from === ALL_DAY.from
              ? 'All day today.'
              : window
                ? `Until ${formatTime(window.to)} today.`
                : ''
            : next
              ? `We'll start sending requests ${describeStart(next, now)}.`
              : 'Add some request hours to start getting requests.'}{' '}
          <span className="text-slate-500">Hours: {describeRequestHours(driver.requestHours)}</span>
        </p>
      </div>
      {showSettingsLink && (
        <Link
          to={volunteerPaths.availability}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-rc-blue hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rc-blue"
        >
          <Settings2 className="h-4 w-4" aria-hidden /> Change availability
        </Link>
      )}
    </section>
  )
}

import { ArrowUpRight, CalendarPlus, Inbox, LayoutDashboard, Truck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FeedbackHelpSection } from '../../components/feedback/FeedbackHelpSection'
import { StatusBadge } from '../../modules/careride'
import { PageHeader } from '../../components/workspace/PageHeader'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { SENT_ON_TRANSIT_LABEL } from '../../modules/careride/domain'
import type { RideStatus } from '../../types'
import { paths } from '../../workspace/paths'

const ISSUES_URL = 'https://github.com/Relay-Collective/Relay-Collective/issues'

// What each ride status means for staff, in the order a ride moves through them
const STATUSES: { status: RideStatus; label?: string; text: string }[] = [
  { status: 'SEARCHING', text: "We're looking for a driver who fits the ride's time, place, and needs." },
  { status: 'OFFERED', text: 'Drivers have been asked and we’re waiting for one to accept.' },
  { status: 'ACCEPTED', text: 'A driver has accepted. You can see who on the ride’s page.' },
  { status: 'NEEDS_ATTENTION', text: 'No driver can take the ride as it is. Ask drivers again, change the time, or send the client on transit.' },
  { status: 'PICKED_UP', text: 'The client is in the car, on the way to the destination.' },
  { status: 'COMPLETED', text: 'The client was dropped off.' },
  { status: 'NO_SHOW', text: 'The driver arrived, but the client didn’t come out in time.' },
  { status: 'CANCELLED', label: SENT_ON_TRANSIT_LABEL, text: 'Staff sent the client on public transit instead.' },
  { status: 'CANCELLED', text: 'The ride was cancelled before pickup.' },
]

const TOUR: { icon: typeof Truck; title: string; text: ReactNode }[] = [
  { icon: LayoutDashboard, title: 'Overview', text: 'What needs attention today, recent activity, and your services.' },
  { icon: Inbox, title: 'Requests', text: 'Every request your organization has made, with filters and search.' },
  { icon: Truck, title: 'Transportation', text: 'Book rides, follow trips, and manage the places your clients go.' },
]

export function Help() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help and support" description="How the workspace is laid out, what each ride status means, and where to get help." />

      <section aria-labelledby="layout-title" className={panel}>
        <div className={panelHead}>
          <h2 id="layout-title" className={panelTitle}>
            Finding your way
          </h2>
        </div>
        <ul className="grid gap-4 p-5 md:grid-cols-3">
          {TOUR.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-rc-blue" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-rc-navy">{title}</span>
                <span className="block text-sm text-slate-600">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 px-5 py-4">
          <Link to={paths.newRide} className={`inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-rc-blue hover:underline ${focusRing}`}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Request your first ride
          </Link>
        </div>
      </section>

      <section aria-labelledby="statuses-title" className={panel}>
        <div className={panelHead}>
          <h2 id="statuses-title" className={panelTitle}>
            Ride statuses
          </h2>
        </div>
        <dl className="divide-y divide-slate-100">
          {STATUSES.map((s) => (
            <div key={`${s.status}-${s.label ?? ''}`} className="grid gap-2 px-5 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
              <dt>
                <StatusBadge status={s.status} label={s.label} />
              </dt>
              <dd className="text-sm text-slate-700">{s.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <FeedbackHelpSection />

      <section aria-labelledby="support-title" className={panel}>
        <div className={panelHead}>
          <h2 id="support-title" className={panelTitle}>
            Report a problem
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
          <p>Found something that doesn't work, or have an idea? Relay Collective is open source, and the team tracks issues on GitHub.</p>
          <p className="font-semibold text-rc-navy">Never include client names, addresses, or other personal details in a report.</p>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg font-semibold text-rc-blue hover:underline ${focusRing}`}
          >
            Open the issue tracker <ArrowUpRight className="h-4 w-4" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>
    </div>
  )
}

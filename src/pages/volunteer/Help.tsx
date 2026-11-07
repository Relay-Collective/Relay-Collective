import { ArrowUpRight, CalendarClock, HeartHandshake, Inbox, LayoutDashboard, Settings, Truck, UserRound, type LucideIcon } from 'lucide-react'
import { FeedbackHelpSection } from '../../components/feedback/FeedbackHelpSection'
import { StatusBadge } from '../../modules/careride'
import { SafetyNote } from '../../components/volunteer/TripPanel'
import { PageHeader } from '../../components/workspace/PageHeader'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useVolunteer } from '../../hooks/useVolunteer'
import { NO_SHOW_WAIT_MINUTES, UNDO_FINISH_MINUTES } from '../../logic/dispatch'
import type { RideStatus } from '../../types'

const ISSUES_URL = 'https://github.com/Relay-Collective/Relay-Collective/issues'

const TOUR: Tour = [
  { icon: LayoutDashboard, title: 'Overview', text: 'What needs you, your next commitments, and what you’ve given.' },
  { icon: Inbox, title: 'Opportunities', text: 'Ride requests sent to you. Accept or decline each one.' },
  { icon: Truck, title: 'Transportation', text: 'Your trip now, what’s coming up, and your ride history.' },
  { icon: CalendarClock, title: 'Availability', text: 'When and where we may send you requests.' },
  { icon: HeartHandshake, title: 'My interests', text: 'Other ways you’d like to help, besides driving.' },
  { icon: UserRound, title: 'My profile', text: 'Your details, vehicle, and verification.' },
]

// A general volunteer's workspace: no rides, so nothing about driving
const GENERAL_TOUR: Tour = [
  { icon: LayoutDashboard, title: 'Overview', text: 'Your interests and the services you take part in.' },
  { icon: HeartHandshake, title: 'My interests', text: 'The ways you’d like to help. Change them anytime.' },
  { icon: UserRound, title: 'My profile', text: 'Your details and service participation.' },
  { icon: Settings, title: 'Settings', text: 'Your password and account.' },
]

type Tour = { icon: LucideIcon; title: string; text: string }[]

// What each status means on a driver's ride, in the order a ride moves through them
const STATUSES: { status: RideStatus; label: string; text: string }[] = [
  { status: 'ACCEPTED', label: 'Accepted', text: 'You said yes. Pickup details and the front desk’s number are on the ride.' },
  { status: 'ACCEPTED', label: 'On your way', text: 'You told the front desk you’ve set off.' },
  { status: 'ACCEPTED', label: 'At pickup', text: `You’re outside. If nobody comes after ${NO_SHOW_WAIT_MINUTES} minutes, you can mark a no-show.` },
  { status: 'PICKED_UP', label: 'Driving to drop-off', text: 'The passenger is in the car.' },
  { status: 'COMPLETED', label: 'Completed', text: `Dropped off. You can undo it for ${UNDO_FINISH_MINUTES} minutes if you tapped it by mistake.` },
  { status: 'NO_SHOW', label: 'Passenger didn’t show', text: 'The ride ended at pickup and the front desk was told.' },
  { status: 'CANCELLED', label: 'Cancelled', text: 'The organization called the ride off. Don’t drive to the pickup.' },
]

// The workspace's layout, and how to get help. CareRide drivers also get ride safety and what each ride status
// means; a general volunteer has no rides, so their page doesn't talk about driving.
export function Help() {
  const { workspace } = useVolunteer()
  if (workspace.experience === 'GENERAL_VOLUNTEER') {
    return (
      <div className="space-y-6">
        <PageHeader title="Help" description="How your workspace is laid out, and how to get help." />
        <TourSection tour={GENERAL_TOUR} />
        <FeedbackHelpSection />
        <section aria-labelledby="support-title" className={panel}>
          <div className={panelHead}>
            <h2 id="support-title" className={panelTitle}>
              Getting help
            </h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
            <p>Questions about your account or volunteering? Send feedback from the menu and the Relay Collective team will reply in My feedback.</p>
            <p>Found a bug in the app? The team tracks issues on GitHub.</p>
            <IssueLink />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Help" description="How the workspace is laid out, what each ride status means, and how to get help." />

      <SafetyNote />

      <TourSection tour={TOUR} />

      <section aria-labelledby="statuses-title" className={panel}>
        <div className={panelHead}>
          <h2 id="statuses-title" className={panelTitle}>
            Ride statuses
          </h2>
        </div>
        <dl className="divide-y divide-slate-100">
          {STATUSES.map((s) => (
            <div key={s.label} className="grid gap-2 px-5 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
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
            Getting help
          </h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
          <p>During a ride, call the front desk using the button on the ride. They know the passenger and the pickup.</p>
          <p>Something went wrong on a finished ride? Open it and choose “Flag an issue”. Only the Relay Collective team sees it.</p>
          <p>Found a bug in the app? The team tracks issues on GitHub.</p>
          <p className="font-semibold text-rc-navy">Never include passenger names, addresses, or other personal details in a report.</p>
          <IssueLink />
        </div>
      </section>
    </div>
  )
}

function TourSection({ tour }: { tour: Tour }) {
  return (
    <section aria-labelledby="tour-title" className={panel}>
      <div className={panelHead}>
        <h2 id="tour-title" className={panelTitle}>
          Finding your way
        </h2>
      </div>
      <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {tour.map(({ icon: Icon, title, text }) => (
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
    </section>
  )
}

function IssueLink() {
  return (
    <a href={ISSUES_URL} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg font-semibold text-rc-blue hover:underline ${focusRing}`}>
      Open the issue tracker <ArrowUpRight className="h-4 w-4" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

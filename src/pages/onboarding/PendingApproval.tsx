import { ArrowRight, Check, CircleX, Clock, FileText, LayoutDashboard, Lock, MapPin, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { authLead, authTitle, eyebrow, focusRing, softPanel } from '../../components/auth/styles'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { primaryButton, secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { useCurrentOrg } from '../../hooks/useCurrent'
import { useLoadable } from '../../hooks/useLoadable'
import { ORG_KINDS, PLATFORM_INTERESTS, SERVICE_CATEGORIES, labelOf } from '../../onboarding/options'
import { dataService } from '../../services'
import type { Organization, OrganizationApplication } from '../../types'
import { paths } from '../../workspace/paths'
import { FullPageLoader } from '../auth/FullPageLoader'

const DAY = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

// /application: where an organization's staff see where its review stands. Shows only the decision
// itself, never the administrators' notes. Until approval the workspace stays limited.
export function PendingApproval() {
  const { currentUser } = useApp()
  const org = useCurrentOrg()
  const orgId = currentUser?.orgId ?? ''
  const application = useLoadable(() => (orgId ? dataService.getOrganizationApplication(orgId) : Promise.resolve(undefined)), orgId)

  // Drivers and admins have their own home; only organization staff have an application
  if (currentUser && currentUser.role !== 'PARTNER') return <Navigate to="/home" replace />
  if (!org) return <FullPageLoader label="Loading your application" />

  return (
    <OnboardingLayout
      sidebarIntro={<Timeline org={org} submittedAt={application.data?.submittedAt} />}
      help={<p>Reviews are done by people on the Relay Collective team. We'll use the contact email on your application if we have questions.</p>}
    >
      {org.status === 'PENDING' && <Pending org={org} />}
      {org.status === 'APPROVED' && <Approved org={org} />}
      {org.status === 'REJECTED' && <Rejected org={org} />}
      {application.data && <Summary org={org} app={application.data} />}
    </OnboardingLayout>
  )
}

function Heading({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <header>
      <p className={eyebrow}>{label}</p>
      <h1 className={`${authTitle} mt-3 sm:text-[38px]`}>{title}</h1>
      <div className={authLead}>{children}</div>
    </header>
  )
}

function Pending({ org }: { org: Organization }) {
  const { refresh } = useApp()
  const [checked, setChecked] = useState(false)
  return (
    <div className="animate-fade-up">
      <Heading label="Application status" title="We're reviewing your organization.">
        <p>
          Thanks for applying, <strong className="text-rc-navy">{org.name}</strong>. Our team approves every organization before it can use Relay
          Collective's services. Come back here any time to check where things stand.
        </p>
      </Heading>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className={softPanel}>
          <p className="flex items-center gap-2 text-sm font-semibold text-rc-navy">
            <Check className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Available now
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Explore your workspace</li>
            <li>Save the places your clients often go</li>
          </ul>
        </div>
        <div className={softPanel}>
          <p className="flex items-center gap-2 text-sm font-semibold text-rc-navy">
            <Lock className="h-4 w-4 text-slate-500" aria-hidden /> After approval
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Request rides</li>
            <li>Invite colleagues</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to={paths.destinations} className={primaryButton}>
          <MapPin className="h-5 w-5" aria-hidden /> Add destinations
        </Link>
        <Link to={paths.overview} className={secondaryButton}>
          <LayoutDashboard className="h-5 w-5" aria-hidden /> Explore the workspace
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          refresh()
          setChecked(true)
        }}
        className={`mt-5 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-rc-blue hover:underline ${focusRing}`}
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Check status again
      </button>
      {checked && (
        <p className="mt-2 text-sm text-slate-500" role="status">
          Still under review. We checked just now.
        </p>
      )}
    </div>
  )
}

function Approved({ org }: { org: Organization }) {
  return (
    <div className="animate-fade-up">
      <Heading label="Application status" title={`${org.name} is approved.`}>
        <p>Welcome to Relay Collective. Your team can now request rides and invite colleagues from the workspace.</p>
      </Heading>
      <Link to={paths.overview} className={`${primaryButton} mt-8`}>
        Go to your workspace <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  )
}

function Rejected({ org }: { org: Organization }) {
  const { signOut } = useApp()
  return (
    <div className="animate-fade-up">
      <Heading label="Application status" title="We weren't able to approve this application.">
        <p>
          After review, <strong className="text-rc-navy">{org.name}</strong> wasn't approved to use Relay Collective at this time, so the workspace
          isn't available.
        </p>
      </Heading>
      <div className={`${softPanel} mt-8 text-sm text-slate-600`}>
        <p className="font-semibold text-rc-navy">What you can do</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>If you think something was missed, or your situation has changed, contact the Relay Collective team.</li>
          <li>We'll let you know if anything needs to change for a future application.</li>
        </ul>
      </div>
      <button type="button" className={`${secondaryButton} mt-8`} onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  )
}

function Timeline({ org, submittedAt }: { org: Organization; submittedAt?: string }) {
  const at = submittedAt ?? org.createdAt
  const decided = org.status !== 'PENDING'
  const items = [
    { title: 'Application submitted', detail: at ? DAY.format(new Date(at)) : 'Received', state: 'done' as const },
    { title: 'Review by Relay Collective', detail: decided ? 'Complete' : 'In progress', state: decided ? ('done' as const) : ('current' as const) },
    {
      title: org.status === 'REJECTED' ? 'Not approved' : 'Approved',
      detail: decided && org.reviewedAt ? DAY.format(new Date(org.reviewedAt)) : 'Next',
      state: org.status === 'APPROVED' ? ('done' as const) : org.status === 'REJECTED' ? ('stopped' as const) : ('upcoming' as const),
    },
  ]
  return (
    <ol aria-label="Review progress">
      {items.map((item, i) => (
        <li key={item.title} className="relative flex gap-3.5 pb-7 last:pb-0" aria-current={item.state === 'current' ? 'step' : undefined}>
          {i < items.length - 1 && <span className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px ${item.state === 'done' ? 'bg-rc-teal/50' : 'bg-rc-line'}`} aria-hidden />}
          <span
            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              item.state === 'done'
                ? 'bg-rc-teal text-white'
                : item.state === 'current'
                  ? 'bg-rc-blue text-white shadow-[0_0_0_6px_rgba(34,81,232,0.12)]'
                  : item.state === 'stopped'
                    ? 'bg-red-100 text-red-700'
                    : 'border border-rc-line bg-white text-slate-400'
            }`}
            aria-hidden
          >
            {item.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : item.state === 'stopped' ? <CircleX className="h-4 w-4" /> : item.state === 'current' ? <Clock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </span>
          <span className="pt-1">
            <span className={`block text-sm font-semibold ${item.state === 'upcoming' ? 'text-slate-500' : 'text-rc-navy'}`}>{item.title}</span>
            <span className="block text-[13px] text-slate-500">{item.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Summary({ org, app }: { org: Organization; app: OrganizationApplication }) {
  const rows: [string, string][] = [
    ['Organization', org.name],
    ['Type', labelOf(ORG_KINDS, app.kind)],
    ['Contact', `${org.contactName} (${app.contactRole}), ${app.contactEmail}`],
    ['Services', app.serviceCategories.map((c) => labelOf(SERVICE_CATEGORIES, c)).join(', ')],
    ['Interested in', app.platformInterests.map((p) => labelOf(PLATFORM_INTERESTS, p)).join(', ') || '—'],
  ]
  return (
    <details className="group mt-12 rounded-xl border border-rc-line">
      <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl px-5 font-semibold text-rc-navy ${focusRing} [&::-webkit-details-marker]:hidden`}>
        What you submitted
        <span className="text-sm font-normal text-slate-500 group-open:hidden">Show</span>
        <span className="hidden text-sm font-normal text-slate-500 group-open:inline">Hide</span>
      </summary>
      <dl className="grid gap-x-6 gap-y-2.5 border-t border-rc-line px-5 py-4 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="break-words text-rc-navy">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

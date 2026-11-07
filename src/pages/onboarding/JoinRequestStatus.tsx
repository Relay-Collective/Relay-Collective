import { ArrowRight, Building2, Check, CircleX, Clock, MapPin, RefreshCw, Search, Send, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { FormAlert } from '../../components/auth/FormAlert'
import { authLead, authTitle, eyebrow, softPanel } from '../../components/auth/styles'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { primaryButton, secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { REQUEST_STATUS_LABEL } from '../../logic/membership'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import type { MyJoinRequest } from '../../types'
import { paths } from '../../workspace/paths'
import { FullPageLoader } from '../auth/FullPageLoader'

const DAY = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
// Someone without a role yet has no app-wide live updates, so this page keeps itself current
const POLL_MS = 15_000

// /onboarding/join/status: where the signed-in person's latest request to join stands. Shows only the
// decision, never the administrators' notes. Access comes from the backend, not from this page.
export function JoinRequestStatus() {
  const { currentUser, reloadSession } = useApp()
  const { state } = useLocation() as { state: { justSent?: boolean } | null }
  const [requests, setRequests] = useState<MyJoinRequest[]>()
  const [loadError, setLoadError] = useState<string>()
  const confirmed = useRef(false)

  const load = useCallback(() => {
    dataService.listMyJoinRequests().then(
      (list) => {
        setRequests(list)
        setLoadError(undefined)
      },
      (err: Error) => setLoadError(err.message),
    )
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS)
    const unsubscribe = dataService.onDataChange(load)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [load])

  const latest = requests?.[0]

  // Approved: ask the backend for the new membership, so the workspace opens only once it really exists
  useEffect(() => {
    if (latest?.status === 'approved' && !currentUser && !confirmed.current) {
      confirmed.current = true
      reloadSession().catch(() => {})
    }
  }, [latest?.status, currentUser, reloadSession])

  if (loadError && !requests) {
    return (
      <OnboardingLayout>
        <FormAlert>{loadError}</FormAlert>
        <button type="button" className={`${secondaryButton} mt-6`} onClick={load}>
          <RefreshCw className="h-5 w-5" aria-hidden /> Try again
        </button>
      </OnboardingLayout>
    )
  }
  if (!requests) return <FullPageLoader label="Loading your request" />
  if (!latest) return <Navigate to={currentUser ? '/home' : onboardingPaths.join} replace />
  // Already in an organization some other way: nothing to wait for here
  if (currentUser && latest.status !== 'approved') return <Navigate to="/home" replace />

  return (
    <OnboardingLayout
      sidebarIntro={<Timeline request={latest} />}
      help={<p>Administrators at {latest.orgName} decide who joins their workspace. Relay Collective doesn't review these requests.</p>}
    >
      {latest.status === 'pending' && <Pending request={latest} justSent={!!state?.justSent} onChange={load} />}
      {latest.status === 'approved' && <Approved request={latest} />}
      {latest.status === 'rejected' && <Rejected request={latest} />}
      {latest.status === 'cancelled' && <Cancelled request={latest} />}
      <Details request={latest} />
    </OnboardingLayout>
  )
}

function Heading({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  // Status changes while someone waits: move them to the new heading
  useEffect(() => ref.current?.focus({ preventScroll: true }), [title])
  return (
    <header>
      <p className={eyebrow}>{label}</p>
      <h1 ref={ref} tabIndex={-1} className={`${authTitle} mt-3 focus:outline-none sm:text-[38px]`}>
        {title}
      </h1>
      <div className={authLead}>{children}</div>
    </header>
  )
}

function Pending({ request, justSent, onChange }: { request: MyJoinRequest; justSent: boolean; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function withdraw() {
    setBusy(true)
    setError(undefined)
    try {
      await dataService.cancelJoinRequest(request.id)
      setConfirming(false)
      onChange()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <Heading label="Request to join" title={justSent ? 'Your request has been sent.' : 'Your request is waiting for review.'}>
        <p>
          An administrator at <strong className="text-rc-navy">{request.orgName}</strong> will review your request to join.
        </p>
      </Heading>

      <div className={`${softPanel} mt-8`}>
        <p className="flex items-center gap-2 font-semibold text-rc-navy">
          <Clock className="h-4 w-4 text-amber-700" aria-hidden /> Awaiting organization approval
        </p>
        <p className="mt-1.5 text-sm text-slate-600">
          You won't have access to {request.orgName}'s workspace until an administrator approves your request. This page updates on its own, and you
          can come back to it any time by signing in.
        </p>
      </div>

      {error && <FormAlert className="mt-6">{error}</FormAlert>}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={secondaryButton} onClick={() => setConfirming(true)}>
          <Undo2 className="h-5 w-5" aria-hidden /> Withdraw request
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Withdraw your request?"
        body={<p>{request.orgName}'s administrators will no longer see it. You can search again and send a new request afterwards.</p>}
        confirmLabel="Withdraw request"
        tone="danger"
        busy={busy}
        onConfirm={() => void withdraw()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}

function Approved({ request }: { request: MyJoinRequest }) {
  const { currentUser, reloadSession } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function enter() {
    setBusy(true)
    setError(undefined)
    try {
      const session = currentUser ? { user: currentUser } : await reloadSession()
      if (!session?.user) throw new Error('Your membership isn’t ready yet. Please try again in a moment.')
      navigate(paths.overview, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <Heading label="Request to join" title={`You're now part of ${request.orgName}.`}>
        <p>An administrator approved your request. Your organization's workspace is ready for you.</p>
      </Heading>
      {error && <FormAlert className="mt-6">{error}</FormAlert>}
      <button type="button" className={`${primaryButton} mt-8`} onClick={() => void enter()} disabled={busy}>
        {busy ? 'Opening…' : 'Enter Workspace'} <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

function Rejected({ request }: { request: MyJoinRequest }) {
  return (
    <div className="animate-fade-up">
      <Heading label="Request to join" title="Your request was not approved.">
        <p>
          <strong className="text-rc-navy">{request.orgName}</strong> didn't approve this request, so you don't have access to its workspace.
        </p>
      </Heading>
      <div className={`${softPanel} mt-8 text-sm text-slate-600`}>
        <p className="font-semibold text-rc-navy">What you can do</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>If you think this was a mistake, contact someone you know at {request.orgName} and ask them to invite you.</li>
          <li>If you work with a different organization, search for it and send a new request.</li>
        </ul>
      </div>
      <NextSteps />
    </div>
  )
}

function Cancelled({ request }: { request: MyJoinRequest }) {
  return (
    <div className="animate-fade-up">
      <Heading label="Request to join" title="Your request was withdrawn.">
        <p>
          Your request to join <strong className="text-rc-navy">{request.orgName}</strong> is no longer waiting for review. You can send a new one
          whenever you're ready.
        </p>
      </Heading>
      <NextSteps />
    </div>
  )
}

function NextSteps() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link to={onboardingPaths.join} className={primaryButton}>
        <Search className="h-5 w-5" aria-hidden /> Find an organization
      </Link>
      <Link to={onboardingPaths.start} className={secondaryButton}>
        Other ways to get started
      </Link>
    </div>
  )
}

function Details({ request }: { request: MyJoinRequest }) {
  const rows: [string, ReactNode][] = [
    ['Organization', request.orgName],
    ['Requested', DAY.format(new Date(request.createdAt))],
    ['Status', REQUEST_STATUS_LABEL[request.status]],
    ['Your role', request.requestedPosition ?? '—'],
  ]
  return (
    <section aria-labelledby="request-details" className="mt-12 rounded-xl border border-rc-line">
      <h2 id="request-details" className="flex items-center gap-2 border-b border-rc-line px-5 py-3.5 font-semibold text-rc-navy">
        <Building2 className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Your request
        {request.orgCity && (
          <span className="ml-auto flex items-center gap-1 text-sm font-normal text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {request.orgCity}
          </span>
        )}
      </h2>
      <dl className="grid gap-x-6 gap-y-2.5 px-5 py-4 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="break-words text-rc-navy">{v}</dd>
          </div>
        ))}
        {request.message && (
          <div className="contents">
            <dt className="text-slate-500">Your message</dt>
            <dd className="whitespace-pre-line break-words text-rc-navy">{request.message}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

function Timeline({ request }: { request: MyJoinRequest }) {
  const decided = request.status !== 'pending'
  const stopped = request.status === 'rejected' || request.status === 'cancelled'
  const items = [
    { title: 'Request sent', detail: DAY.format(new Date(request.createdAt)), state: 'done' as const, icon: Send },
    {
      title: `Review by ${request.orgName}`,
      detail: decided ? 'Complete' : 'In progress',
      state: decided ? ('done' as const) : ('current' as const),
      icon: Clock,
    },
    {
      title: request.status === 'rejected' ? 'Not approved' : request.status === 'cancelled' ? 'Withdrawn' : 'Access to the workspace',
      detail: request.reviewedAt
        ? DAY.format(new Date(request.reviewedAt))
        : request.cancelledAt
        ? DAY.format(new Date(request.cancelledAt))
        : 'Next',
      state: request.status === 'approved' ? ('done' as const) : stopped ? ('stopped' as const) : ('upcoming' as const),
      icon: Building2,
    },
  ]
  return (
    <ol aria-label="Request progress">
      {items.map((item, i) => (
        <li key={item.title} className="relative flex gap-3.5 pb-7 last:pb-0" aria-current={item.state === 'current' ? 'step' : undefined}>
          {i < items.length - 1 && (
            <span
              className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px ${item.state === 'done' ? 'bg-rc-teal/50' : 'bg-rc-line'}`}
              aria-hidden
            />
          )}
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
            {item.state === 'done' ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : item.state === 'stopped' ? (
              <CircleX className="h-4 w-4" />
            ) : (
              <item.icon className="h-4 w-4" />
            )}
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

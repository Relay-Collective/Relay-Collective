import { Check, Link2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { focusRing, softPanel } from '../../components/auth/styles'
import { TextAreaField } from '../../components/form/TextAreaField'
import { TextField } from '../../components/form/TextField'
import { OrganizationSearch, SelectedOrganization } from '../../components/membership/OrganizationSearch'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { OnboardingStep } from '../../components/onboarding/OnboardingStep'
import { secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { POSITION_SUGGESTIONS } from '../../logic/membership'
import { focusFirstError } from '../../onboarding/focus'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import { MAX_JOIN_MESSAGE, MAX_JOIN_POSITION } from '../../services/dataService'
import type { OrganizationDirectoryEntry } from '../../types'
import { FullPageLoader } from '../auth/FullPageLoader'

// Invitation links look like https://…/invite/<token>; people may paste the whole link or just the code.
function tokenFrom(value: string): string | undefined {
  const v = value.trim()
  const match = v.match(/\/invite\/([A-Za-z0-9]+)/)
  return match?.[1] ?? (/^[A-Za-z0-9]{20,128}$/.test(v) ? v : undefined)
}

// /onboarding/join: find an organization that chose to be found, and ask to join it. Sending the request
// grants nothing; the organization's administrators decide, and choose the role. An invitation link
// is still the other way in.
export function JoinOrganization() {
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [step, setStep] = useState<'find' | 'request'>('find')
  const [org, setOrg] = useState<OrganizationDirectoryEntry>()
  const [position, setPosition] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ org?: string; position?: string; message?: string }>({})
  const [submitError, setSubmitError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // Someone already waiting on a request sees where it stands instead of starting another
  useEffect(() => {
    let active = true
    dataService.listMyJoinRequests().then(
      (requests) => {
        if (!active) return
        setHasPending(requests.some((r) => r.status === 'pending'))
        setChecked(true)
      },
      () => active && setChecked(true), // the request itself will say what's wrong
    )
    return () => {
      active = false
    }
  }, [])

  if (currentUser) return <Navigate to="/home" replace />
  if (!checked) return <FullPageLoader label="Loading" />
  if (hasPending) return <Navigate to={onboardingPaths.joinStatus} replace />

  function next() {
    if (!org) {
      setErrors({ org: 'Search for your organization and choose it from the list.' })
      document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus()
      return
    }
    setStep('request')
  }

  async function send() {
    const found = {
      position: position.trim().length > MAX_JOIN_POSITION ? `Keep this under ${MAX_JOIN_POSITION} characters.` : undefined,
      message: message.trim().length > MAX_JOIN_MESSAGE ? 'Keep your message under 1,000 characters.' : undefined,
    }
    setErrors(found)
    if (found.position || found.message) {
      focusFirstError()
      return
    }
    if (!org) return setStep('find')
    setBusy(true)
    setSubmitError(undefined)
    try {
      await dataService.submitJoinRequest({ orgId: org.id, requestedPosition: position, message })
      navigate(onboardingPaths.joinStatus, { replace: true, state: { justSent: true } })
    } catch (err) {
      setSubmitError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <OnboardingLayout
      sidebarIntro={<Sidebar />}
      help={
        step === 'find' ? (
          <p>Can't find your organization? It may not be on Relay Collective yet, or it may only accept invitations. Ask a colleague there.</p>
        ) : (
          <p>What you write here is shared only with the organization's administrators. They choose what access you get.</p>
        )
      }
    >
      {step === 'find' ? (
        <OnboardingStep
          stepKey="find"
          label="Join an organization"
          title="Find your organization."
          description="Search for the organization you work or volunteer with and request access to its Relay Collective workspace."
          onSubmit={next}
          onBack={() => navigate(onboardingPaths.start)}
          submitLabel="Continue"
        >
          {org ? (
            <SelectedOrganization org={org} onChange={() => setOrg(undefined)} />
          ) : (
            <OrganizationSearch
              error={errors.org}
              onSelect={(picked) => {
                setOrg(picked)
                setErrors({})
              }}
            />
          )}
          <InvitationLink />
        </OnboardingStep>
      ) : (
        org && (
          <OnboardingStep
            stepKey="request"
            label="Join an organization"
            title={`Request to join ${org.name}`}
            description="Tell the organization's administrators a little about your role so they can review your request."
            onSubmit={() => void send()}
            onBack={() => setStep('find')}
            direction="forward"
            submitLabel="Request to Join"
            busy={busy}
            busyLabel="Sending…"
            error={submitError}
          >
            <SelectedOrganization org={org} />
            <div className="mt-8 space-y-6">
              <div>
                <TextField
                  id="join-position"
                  label="Your role or position"
                  optional
                  list="join-position-suggestions"
                  autoComplete="organization-title"
                  maxLength={MAX_JOIN_POSITION + 20}
                  value={position}
                  error={errors.position}
                  hint="For example, Case Worker. This helps administrators recognize you; it doesn't decide your access."
                  onChange={(e) => {
                    setPosition(e.target.value)
                    setErrors((x) => ({ ...x, position: undefined }))
                  }}
                />
                <datalist id="join-position-suggestions">
                  {POSITION_SUGGESTIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Common roles">
                  {[...POSITION_SUGGESTIONS, 'Other'].map((p) => {
                    const other = p === 'Other'
                    const on = !other && position === p
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={other ? undefined : on}
                        onClick={() => {
                          if (!other) return setPosition(on ? '' : p)
                          setPosition('')
                          document.getElementById('join-position')?.focus() // they type their own
                        }}
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${focusRing} ${
                          on ? 'border-rc-blue bg-brand-50 text-rc-blue' : 'border-rc-line bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>
              <TextAreaField
                id="join-message"
                label="Message to administrators"
                optional
                rows={5}
                maxLength={MAX_JOIN_MESSAGE}
                placeholder="Briefly explain your connection to this organization."
                value={message}
                error={errors.message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setErrors((x) => ({ ...x, message: undefined }))
                }}
              />
            </div>
            <p className="mt-8 flex items-start gap-2 text-sm text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Nothing is shared with {org.name} beyond your name, your sign-in email, and what you write here. You won't have access until an
              administrator approves your request.
            </p>
          </OnboardingStep>
        )
      )}
    </OnboardingLayout>
  )
}

function Sidebar() {
  const steps = ['Find your organization', 'Tell them about your role', 'An administrator reviews your request']
  return (
    <div>
      <p className="font-heading text-2xl font-bold tracking-[-0.02em] text-rc-navy">Join your team.</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Ask to join an organization that already uses Relay Collective. Its administrators decide who gets access.
      </p>
      <ol className="mt-8 space-y-3 text-sm text-slate-600">
        {steps.map((t, i) => (
          <li key={t} className="flex items-start gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rc-mint text-xs font-bold text-rc-teal-ink"
              aria-hidden
            >
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  )
}

// The other way in: a link a colleague sent. Opens the invitation page, which checks it.
function InvitationLink() {
  const { identity } = useApp()
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [error, setError] = useState<string>()

  function open() {
    const token = tokenFrom(link)
    if (!token) {
      setError(
        link.trim()
          ? 'That doesn’t look like an invitation link. Copy the whole link from your invitation.'
          : 'Paste the invitation link you received.',
      )
      document.getElementById('invite-link')?.focus()
      return
    }
    navigate(onboardingPaths.invite(token))
  }

  return (
    <details className={`${softPanel} group mt-8`}>
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg font-semibold text-rc-navy ${focusRing} [&::-webkit-details-marker]:hidden`}
      >
        <Link2 className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Have an invitation link instead?
        <span className="ml-auto text-sm font-normal text-slate-500 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-sm font-normal text-slate-500 group-open:inline">Hide</span>
      </summary>
      <p className="mt-2 text-sm text-slate-600">
        Administrators can invite you from their organization's workspace. Paste the link here. It must have been sent to{' '}
        <strong className="text-rc-navy">{identity?.email}</strong>.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          id="invite-link"
          label="Invitation link"
          className="flex-1"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://…/invite/…"
          value={link}
          error={error}
          onChange={(e) => {
            setLink(e.target.value)
            setError(undefined)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // the surrounding form is for the search
              open()
            }
          }}
        />
        <button type="button" className={`${secondaryButton} sm:mt-7`} onClick={open}>
          Open invitation
        </button>
      </div>
    </details>
  )
}

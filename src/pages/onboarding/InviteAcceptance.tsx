import { Building2, Check, Clock, Link2Off, MailX, UserCheck, UserRoundX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormAlert } from '../../components/auth/FormAlert'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { SubmitButton } from '../../components/auth/SubmitButton'
import { authLead, authTitle, eyebrow } from '../../components/auth/styles'
import { ghostButton, primaryButton, secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { initials } from '../../logic/initials'
import { ORG_ROLES } from '../../logic/membership'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import type { InvitationPreview } from '../../types'
import { paths } from '../../workspace/paths'
import { FullPageLoader } from '../auth/FullPageLoader'

// What a staff member can do in their organization's workspace. Everyone invited joins as staff, the
// least-privileged organization role; an administrator can change it afterwards from Team.
const STAFF_CAN = ORG_ROLES.find((r) => r.value === 'STAFF')!.can

const DATE = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// /invite/:token. Identity first, then the invitation: the backend shows its details only to the
// signed-in account it was sent to, and checks every rule again when it's accepted.
export function InviteAcceptance() {
  const { token = '' } = useParams()
  const { ready, identity } = useApp()
  const here = onboardingPaths.invite(token)

  if (!ready) return <FullPageLoader />
  if (!identity) {
    return (
      <AuthLayout
        brand={{
          title: 'You’ve been invited to join your team.',
          body: 'Relay Collective connects your organization’s staff to the services you coordinate together.',
        }}
      >
        <p className={eyebrow}>Invitation</p>
        <h1 className={`${authTitle} mt-3`}>Join your organization on Relay Collective</h1>
        <p className={authLead}>
          First, sign in or create your account. Use the email address the invitation was sent to; we'll show you the invitation next.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to={`/register?next=${encodeURIComponent(here)}`} className={`${primaryButton} w-full`}>
            Create an account
          </Link>
          <Link to="/signin" state={{ from: here }} className={`${secondaryButton} w-full`}>
            I already have an account
          </Link>
        </div>
      </AuthLayout>
    )
  }
  return <Invitation token={token} />
}

function Invitation({ token }: { token: string }) {
  const { identity, currentUser, signOut, reloadSession } = useApp()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitationPreview>()
  const [loadError, setLoadError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    let active = true
    dataService.previewInvitation(token).then(
      (p) => active && setPreview(p),
      (err: Error) => active && setLoadError(err.message),
    )
    return () => {
      active = false
    }
  }, [token])

  async function accept() {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await dataService.acceptInvitation(token)
      setAccepted(true)
      await reloadSession()
      navigate(paths.overview, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  // Joined in another tab, or this account already has a role: nothing to accept
  if (currentUser && !accepted && preview?.state === 'VALID') return <Navigate to="/home" replace />
  if (loadError) {
    return (
      <AuthLayout>
        <StatusScreen icon={<Link2Off className="h-7 w-7" />} tone="warning" title="We couldn't check this invitation" actions={<button type="button" className={`${primaryButton} w-full`} onClick={() => window.location.reload()}>Try again</button>}>
          <p>{loadError}</p>
        </StatusScreen>
      </AuthLayout>
    )
  }
  if (!preview) return <FullPageLoader label="Checking your invitation" />

  const back = (
    <Link to={currentUser ? '/home' : onboardingPaths.start} className={`${secondaryButton} w-full`}>
      {currentUser ? 'Go to my dashboard' : 'Back to getting started'}
    </Link>
  )

  if (preview.state !== 'VALID') {
    const states = {
      INVALID: { icon: <Link2Off className="h-7 w-7" />, title: "This invitation link isn't valid", body: 'Check that you copied the whole link, or ask your colleague to send a new invitation.' },
      EXPIRED: { icon: <Clock className="h-7 w-7" />, title: 'This invitation has expired', body: 'Invitations last 7 days. Ask your colleague to send you a new one.' },
      REVOKED: { icon: <MailX className="h-7 w-7" />, title: 'This invitation was withdrawn', body: 'Your organization withdrew it. Ask them for a new one if you still need access.' },
      USED: { icon: <UserCheck className="h-7 w-7" />, title: 'This invitation has already been used', body: 'Each invitation works once. If that wasn’t you, ask your organization to check their team.' },
      UNAVAILABLE: { icon: <Building2 className="h-7 w-7" />, title: "This organization isn't accepting members", body: 'Its account isn’t active on Relay Collective right now. Check with the person who invited you.' },
      HAS_ACCOUNT: { icon: <UserCheck className="h-7 w-7" />, title: 'Your account already has a role', body: 'For now, each Relay Collective account belongs to one organization or service. To join this organization, use a different account, or ask Relay Collective for help.' },
      WRONG_ACCOUNT: {
        icon: <UserRoundX className="h-7 w-7" />,
        title: 'This invitation is for a different email',
        body: `It was sent to ${preview.emailHint ?? 'another address'}, but you're signed in as ${identity?.email}. Sign in with the invited email to accept it.`,
      },
    }[preview.state]
    return (
      <AuthLayout>
        <StatusScreen
          icon={states.icon}
          tone={preview.state === 'HAS_ACCOUNT' ? 'brand' : 'warning'}
          title={states.title}
          actions={
            preview.state === 'WRONG_ACCOUNT' ? (
              <>
                <button
                  type="button"
                  className={`${primaryButton} w-full`}
                  onClick={() => void signOut().finally(() => navigate('/signin', { replace: true, state: { from: onboardingPaths.invite(token) } }))}
                >
                  Sign in with another account
                </button>
                {back}
              </>
            ) : (
              back
            )
          }
        >
          <p>{states.body}</p>
        </StatusScreen>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <p className={eyebrow}>Invitation</p>
      <h1 className={`${authTitle} mt-3`}>Join {preview.orgName}</h1>
      <p className={authLead}>
        {/* A shared organization sign-in carries the organization's name: don't say "Belkin House invited you to Belkin House" */}
        {preview.invitedBy && preview.invitedBy !== preview.orgName ? `${preview.invitedBy} invited you` : 'You’ve been invited'} to work with{' '}
        {preview.orgName} on Relay Collective.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-rc-line" aria-label="Invitation details">
        <div className="flex items-center gap-4 bg-rc-canvas p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rc-navy font-heading font-bold text-white" aria-hidden>
            {initials(preview.orgName ?? '')}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-bold text-rc-navy">{preview.orgName}</p>
            <p className="text-sm text-slate-600">Partner organization</p>
          </div>
        </div>
        <dl className="divide-y divide-rc-line text-sm">
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-slate-500">Your role</dt>
            <dd className="font-semibold text-rc-navy">Staff member</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-slate-500">Account</dt>
            <dd className="truncate font-semibold text-rc-navy">{preview.email}</dd>
          </div>
          {preview.expiresAt && (
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-slate-500">Expires</dt>
              <dd className="font-semibold text-rc-navy">{DATE.format(new Date(preview.expiresAt))}</dd>
            </div>
          )}
        </dl>
        <div className="border-t border-rc-line px-5 py-4">
          <p className="text-sm font-semibold text-rc-navy">As a staff member you can</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {STAFF_CAN.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-rc-teal-ink" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {error && <FormAlert className="mt-5">{error}</FormAlert>}

      <form
        className="mt-8 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void accept()
        }}
      >
        <SubmitButton busy={busy} busyLabel="Joining…" className="w-full">
          Accept and join
        </SubmitButton>
        <Link to={onboardingPaths.start} className={`${ghostButton} w-full`}>
          Not now
        </Link>
      </form>
    </AuthLayout>
  )
}

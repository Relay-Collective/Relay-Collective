import { ArrowRight, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { authLead, authTitle, focusRing } from '../../components/auth/styles'
import { ROLE_TONE, primaryButton, tones } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { ROLE_LABELS } from '../../logic/homeFor'
import { initials } from '../../logic/initials'
import { returnPath } from '../../logic/returnPath'
import { onboardingPaths } from '../../onboarding/routing'
import type { UserRole } from '../../types'
import { FullPageLoader } from './FullPageLoader'

export const signedInPath = '/signed-in'

// What the sign-in page passes along: where to go next, and whether this is a fresh sign-in
// (rather than someone opening sign-in while already signed in on this device).
export interface SignedInState {
  from?: string
  fresh?: boolean
}

const BRAND = {
  title: 'Stronger communities. Built together.',
  body: 'The people, services, and resources your community depends on—all connected.',
}

const OPEN_HOME: Record<UserRole, string> = {
  PARTNER: 'Open your workspace',
  DRIVER: 'Open your workspace',
  VOLUNTEER: 'Open your workspace',
  ORG_ADMIN: 'Open your dashboard',
  PLATFORM_ADMIN: 'Open the admin console',
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// The page right after signing in: a clear "you're in", who as, and one way forward.
// On a phone the sign-in form and this page look nothing alike, so nobody wonders whether it worked.
export function SignedIn() {
  const { ready, identity, currentUser, signOut } = useApp()
  const navigate = useNavigate()
  const state = (useLocation().state as SignedInState | null) ?? {}
  const from = returnPath(state.from)
  const [leaving, setLeaving] = useState(false)
  const continueRef = useRef<HTMLAnchorElement>(null)

  // Focus the way forward on arrival, so Enter goes straight on from the sign-in form
  useEffect(() => {
    if (ready && identity) continueRef.current?.focus({ preventScroll: true })
  }, [ready, identity])

  if (!ready) return <FullPageLoader />
  if (!identity) return <Navigate to="/signin" replace state={from ? { from } : undefined} />

  const name = currentUser?.name || identity.name
  const email = currentUser?.email ?? identity.email
  const role = currentUser?.role
  const tone = tones[role ? ROLE_TONE[role] : 'brand']

  const next = from ?? (currentUser ? '/home' : onboardingPaths.start)
  const action = from ? 'Continue where you left off' : role ? OPEN_HOME[role] : 'Set up your account'

  async function switchAccount() {
    setLeaving(true)
    try {
      await signOut()
    } finally {
      navigate('/signin', { replace: true, state: from ? { from } : undefined })
    }
  }

  return (
    <AuthLayout brand={BRAND}>
      <div className="text-center sm:text-left">
        <div className="relative mx-auto h-20 w-20 sm:mx-0" aria-hidden>
          <span className={`flex h-full w-full animate-pop items-center justify-center rounded-full font-display text-[26px] font-semibold tracking-[-0.02em] ${tone.solid}`}>
            {initials(name) || '·'}
          </span>
          <span className="absolute -bottom-1 -right-2.5 flex h-8 w-8 animate-pop items-center justify-center rounded-full bg-emerald-600 text-white ring-4 ring-white [animation-delay:180ms]">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} className="animate-check-draw [animation-delay:320ms] [stroke-dasharray:1]" />
            </svg>
          </span>
        </div>

        {/* No first name here: some accounts are named after a place ("Belkin House"). The full name follows. */}
        <h1 className={`${authTitle} mt-7`}>{greeting(new Date())}.</h1>
        <p id="signed-in-as" className={authLead}>
          {state.fresh ? "You're signed in as " : "You're already signed in on this device as "}
          <strong className="font-semibold text-ink">{name}</strong>.
        </p>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-600 sm:justify-start">
          {role && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.tile}`}>{ROLE_LABELS[role]}</span>}
          {email && <span className="min-w-0 break-all">{email}</span>}
        </p>

        <div className="mt-10 flex flex-col items-center gap-5 sm:items-stretch">
          <Link ref={continueRef} to={next} replace aria-describedby="signed-in-as" className={`${primaryButton} group w-full`}>
            {action}
            <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <p className="text-center text-sm text-slate-600">
            Not you?{' '}
            <button
              type="button"
              onClick={switchAccount}
              disabled={leaving}
              className={`inline-flex min-h-12 items-center gap-1.5 rounded font-semibold text-rc-blue underline-offset-4 hover:underline disabled:text-slate-500 disabled:no-underline ${focusRing}`}
            >
              {leaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {leaving ? 'Signing out…' : 'Sign in with another account'}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

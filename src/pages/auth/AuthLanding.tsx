import { Link2Off, MailWarning } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { primaryButton, secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { returnPath } from '../../logic/returnPath'
import { onboardingPaths } from '../../onboarding/routing'
import { FullPageLoader } from './FullPageLoader'
import { linkError } from './linkError'

// Where the email confirmation link lands (/welcome). The auth provider signs the person in from the
// link; this page waits for that, then sends them on: to their invitation, onboarding, or home.
export function AuthLanding() {
  const { ready, identity, currentUser, sessionError } = useApp()
  const [params] = useSearchParams()
  const [failed] = useState(linkError)
  const next = returnPath(params.get('next'))

  if (!ready) return <FullPageLoader label="Confirming your email" />

  if (failed) {
    return (
      <AuthLayout>
        <StatusScreen
          icon={<Link2Off className="h-7 w-7" />}
          tone="warning"
          title={failed === 'EXPIRED' ? 'This confirmation link has expired' : "This confirmation link didn't work"}
          actions={
            <>
              <Link to="/signin" className={`${primaryButton} w-full`}>
                Go to sign in
              </Link>
              <Link to="/register" className={`${secondaryButton} w-full`}>
                Create an account
              </Link>
            </>
          }
        >
          <p>
            Confirmation links work once and only for a while. If you've already confirmed, just sign in. Otherwise, sign in with your email and
            password and we'll offer to send a new link.
          </p>
        </StatusScreen>
      </AuthLayout>
    )
  }

  if (identity) return <Navigate to={next ?? (currentUser ? '/home' : onboardingPaths.start)} replace />

  // Opened in a different browser than the one that signed up, the link was already used, or opened directly
  return (
    <AuthLayout>
      <StatusScreen
        icon={<MailWarning className="h-7 w-7" />}
        title={sessionError ? "We couldn't open your account" : 'Sign in to continue'}
        actions={
          <Link to={next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'} className={`${primaryButton} w-full`}>
            Sign in to continue
          </Link>
        }
      >
        <p>{sessionError ?? 'Sign in with your email and password to pick up where you left off.'}</p>
      </StatusScreen>
    </AuthLayout>
  )
}

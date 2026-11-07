import { KeyRound, Link2Off } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormAlert } from '../../components/auth/FormAlert'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { SubmitButton } from '../../components/auth/SubmitButton'
import { authLead, authTitle } from '../../components/auth/styles'
import { PasswordField } from '../../components/form/PasswordField'
import { primaryButton } from '../../components/ui'
import { MIN_PASSWORD_LENGTH } from '../../constants'
import { useApp } from '../../hooks/useApp'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import { FullPageLoader } from './FullPageLoader'
import { linkError } from './linkError'

// Where a reset email's link lands. Opening the link signs the person in for long enough to choose a new password.
export function ResetPassword() {
  const { ready, identity, currentUser } = useApp()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [failedLink] = useState(linkError)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const found: typeof errors = {}
    if (password.length < MIN_PASSWORD_LENGTH) found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    else if (confirm !== password) found.confirm = "The passwords don't match."
    setErrors(found)
    if (found.password || found.confirm || !identity) return
    setBusy(true)
    setError(undefined)
    try {
      await dataService.updatePassword(password)
      navigate(currentUser ? '/home' : onboardingPaths.start, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (!ready) return <FullPageLoader />

  return (
    <AuthLayout>
      {!identity || failedLink ? (
        <StatusScreen
          icon={<Link2Off className="h-7 w-7" />}
          tone="warning"
          title="This link has expired"
          actions={
            <Link to="/forgot-password" className={`${primaryButton} w-full`}>
              Send a new link
            </Link>
          }
        >
          <p>Reset links work once and only for a short time. Ask for a new one and use it soon after it arrives.</p>
        </StatusScreen>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className={authTitle}>Choose a new password</h1>
          <p className={authLead}>
            For <strong className="break-all text-rc-navy">{identity.email}</strong>. You'll use it next time you sign in.
          </p>
          <div className="mt-8 space-y-5">
            <PasswordField
              id="new-password"
              label="New password"
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              showStrength
              autoFocus
              value={password}
              error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordField
              id="confirm-password"
              label="Type it again"
              autoComplete="new-password"
              value={confirm}
              error={errors.confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <FormAlert className="mt-5">{error}</FormAlert>}
          <SubmitButton busy={busy} busyLabel="Saving…" className="mt-6 w-full" arrow={false}>
            <KeyRound className="h-5 w-5" aria-hidden /> Save new password
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}

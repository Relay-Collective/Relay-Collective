import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormAlert } from '../../components/auth/FormAlert'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { SubmitButton } from '../../components/auth/SubmitButton'
import { authLead, authTitle, textLink } from '../../components/auth/styles'
import { TextField } from '../../components/form/TextField'
import { primaryButton } from '../../components/ui'
import { EMAIL } from '../../logic/validate'
import { isNative } from '../../native/platform'
import { dataService } from '../../services'

// "Forgot your password?": emails a reset link. Says the same thing whether or not the email has an account.
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!EMAIL.test(email.trim())) {
      setFieldError('Enter the email you sign in with.')
      document.getElementById('email')?.focus()
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await dataService.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      {sent ? (
        <StatusScreen
          icon={<MailCheck className="h-7 w-7" />}
          title="Check your email"
          actions={
            <Link to="/signin" className={`${primaryButton} w-full`}>
              Back to sign in
            </Link>
          }
        >
          <p>
            If <strong className="break-all text-rc-navy">{email.trim()}</strong> has a Relay Collective account, we've sent it a link to choose a
            new password.
          </p>
          {isNative && <p>The link opens the Relay Collective website. Choose your new password there, then come back here and sign in.</p>}
          <p className="text-sm text-slate-500">Can't find it? Check your spam folder. The link works once and expires after a while.</p>
        </StatusScreen>
      ) : (
        <form onSubmit={submit} noValidate>
          <Link to="/signin" className={`mb-8 inline-flex items-center gap-1.5 text-sm ${textLink}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
          </Link>
          <h1 className={authTitle}>Reset your password</h1>
          <p className={authLead}>Enter the email you sign in with, and we'll send you a link to choose a new password.</p>
          <TextField
            id="email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            className="mt-8"
            icon={<Mail className="h-5 w-5" />}
            value={email}
            error={fieldError}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldError(undefined)
              setError(undefined)
            }}
          />
          {error && <FormAlert className="mt-5">{error}</FormAlert>}
          <SubmitButton busy={busy} busyLabel="Sending…" className="mt-6 w-full" arrow={false}>
            Send reset link
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}

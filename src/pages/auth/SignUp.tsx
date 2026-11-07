import { Check, Lightbulb, Mail, User as UserIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormAlert } from '../../components/auth/FormAlert'
import { SubmitButton } from '../../components/auth/SubmitButton'
import { authLead, authTitle, textLink } from '../../components/auth/styles'
import type { FieldErrors } from '../../components/driverDraft'
import { PasswordField } from '../../components/form/PasswordField'
import { TextField } from '../../components/form/TextField'
import { MIN_PASSWORD_LENGTH } from '../../constants'
import { useApp } from '../../hooks/useApp'
import { returnPath } from '../../logic/returnPath'
import { EMAIL, MAX_NAME, tooLong } from '../../logic/validate'
import { pathForIntent } from '../../onboarding/routing'
import { dataService } from '../../services'
import { CheckEmail } from './CheckEmail'

const BRAND = {
  title: "Let's build stronger communities together.",
  body: 'Create one account for yourself. Then register your organization, join an existing team, or contribute as a volunteer.',
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {
    name: name.trim() ? tooLong(name, MAX_NAME) : 'Enter your full name.',
    email: !email.trim() ? 'Enter your email address.' : EMAIL.test(email.trim()) ? undefined : 'That email doesn’t look right. Check for typos.',
    password: password.length >= MIN_PASSWORD_LENGTH ? undefined : `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

// Step one for everyone: an identity. What they do on Relay Collective is chosen next, in onboarding.
export function SignUp() {
  const { identity, currentUser, reloadSession } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Where to continue after: an invitation link, or the path a landing page button asked for
  const next = returnPath(params.get('next'))
  const intent = params.get('role')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string>()

  // Already signed in (e.g. the back button after signing up): carry on instead of a second account
  if (identity && !submitted) {
    return <Navigate to={next ?? (currentUser ? '/home' : pathForIntent(intent))} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const found = validate(name, email, password)
    setErrors(found)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setBusy(true)
    setError(undefined)
    setSubmitted(true)
    try {
      const result = await dataService.signUp({ name: name.trim(), email: email.trim(), password, next: next ?? undefined })
      if (result.status === 'CONFIRM_EMAIL') {
        setConfirmEmail(result.email)
        return
      }
      // Ask the backend who is signed in now, rather than trusting the sign-up response
      await reloadSession()
      navigate(next ?? pathForIntent(intent), { replace: true })
    } catch (err) {
      setSubmitted(false)
      setError((err as Error).message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (confirmEmail) {
    return (
      <AuthLayout>
        <CheckEmail email={confirmEmail} />
      </AuthLayout>
    )
  }

  const clear = (field: string) => {
    if (errors[field]) setErrors((f) => ({ ...f, [field]: undefined }))
    setError(undefined)
  }
  const longEnough = password.length >= MIN_PASSWORD_LENGTH

  return (
    <AuthLayout
      brand={BRAND}
      aside={
        <>
          <span className="hidden sm:inline">Already have an account? </span>
          <Link to={next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'} className={textLink}>
            Sign in
          </Link>
        </>
      }
    >
      <h1 className={authTitle}>
        <span className="lg:hidden">{BRAND.title}</span>
        <span className="hidden lg:inline">Create your account</span>
      </h1>
      <p className={authLead}>It takes a minute. You'll tell us how you'd like to take part on the next screen.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <TextField
          id="name"
          label="Full name"
          autoComplete="name"
          autoFocus
          icon={<UserIcon className="h-5 w-5" />}
          value={name}
          error={errors.name}
          onChange={(e) => {
            setName(e.target.value)
            clear('name')
          }}
        />
        <TextField
          id="email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@organization.org"
          icon={<Mail className="h-5 w-5" />}
          hint="You'll use this to sign in. Use your work email if you're joining an organization."
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            clear('email')
          }}
        />
        <div>
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            showStrength
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value)
              clear('password')
            }}
          />
          {!errors.password && (
            <ul className="mt-2.5 space-y-1 text-sm" aria-label="Password guidance">
              <li className={`flex items-center gap-2 ${longEnough ? 'text-emerald-700' : 'text-slate-500'}`}>
                <Check className={`h-4 w-4 ${longEnough ? '' : 'opacity-30'}`} aria-hidden />
                At least {MIN_PASSWORD_LENGTH} characters
                <span className="sr-only">{longEnough ? '(done)' : '(not yet)'}</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <Lightbulb className="h-4 w-4" aria-hidden />
                Tip: a few unrelated words make a strong, memorable password
              </li>
            </ul>
          )}
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        <SubmitButton busy={busy} busyLabel="Creating your account…" className="w-full">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to={next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'} className={textLink}>
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-slate-500">
        Relay Collective team accounts are set up by our administrators, not here.
      </p>
    </AuthLayout>
  )
}

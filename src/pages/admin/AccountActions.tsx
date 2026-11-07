import { CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { ChoiceCard } from '../../components/form/ChoiceCard'
import { PasswordField } from '../../components/form/PasswordField'
import { primaryButton, secondaryButton } from '../../components/ui'
import { MIN_PASSWORD_LENGTH } from '../../constants'
import { dataService, isDemoBackend } from '../../services'
import type { PasswordReset } from '../../services/dataService'
import type { User } from '../../types'

// Password resets a platform admin can give. Each one is checked again by the backend: resets go through
// Supabase Auth or the admin-only account list. Permanent deletion is in AccountDangerZone.

// Real accounts: email the person a reset link. Nobody but them ever sees or chooses the new password.
function EmailResetPanel({ user, onClose }: { user: User; onClose: () => void }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      setSentTo((await dataService.resetPassword(user.id)).email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5" role="status">
        <p className="flex items-center gap-2 font-bold text-ink">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /> Reset email sent
        </p>
        <p className="mt-2 text-slate-700">
          We sent a link to <strong className="break-all">{sentTo}</strong>. It lets {user.name} choose a new password. Ask them
          to check their spam folder if it doesn't arrive.
        </p>
        <button type="button" className={`${secondaryButton} mt-4 w-full sm:w-auto`} onClick={onClose}>
          Done
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5" noValidate>
      <p className="text-slate-700">
        We'll email <strong className="break-all">{user.email}</strong> a link to choose a new password. Their current password
        keeps working until they do.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button type="submit" className={primaryButton} disabled={busy} autoFocus>
          <Mail className="h-5 w-5" aria-hidden /> {busy ? 'Sending…' : 'Send reset email'}
        </button>
        <button type="button" className={secondaryButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Lets a platform admin help someone who is locked out.
export function ResetPanel({ user, isSelf, onClose }: { user: User; isSelf: boolean; onClose: () => void }) {
  return isDemoBackend ? <DemoResetPanel user={user} isSelf={isSelf} onClose={onClose} /> : <EmailResetPanel user={user} onClose={onClose} />
}

// Demo accounts: set a new password for the admin to share.
function DemoResetPanel({ user, isSelf, onClose }: { user: User; isSelf: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'temp' | 'custom'>('temp')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Extract<PasswordReset, { kind: 'NEW_PASSWORD' }>>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'custom' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const reset = await dataService.resetPassword(user.id, mode === 'custom' ? password : undefined)
      if (reset.kind === 'NEW_PASSWORD') setResult(reset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5" role="status">
        <p className="mb-3 flex items-center gap-2 font-bold text-ink">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /> Password reset for {user.name}
        </p>
        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="break-all font-semibold text-ink">{result.email}</dd>
            </div>
            <CopyButton text={result.email} label="email" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <dt className="text-sm text-slate-500">New password</dt>
              <dd className="font-mono font-semibold text-ink">{result.password}</dd>
            </div>
            <CopyButton text={result.password} label="password" />
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-600">
          Share this with them directly, not by public message. Save it now: you won't see it again.
        </p>
        <button type="button" className={`${secondaryButton} mt-4 w-full sm:w-auto`} onClick={onClose}>
          Done
        </button>
      </div>
    )
  }

  const fieldName = `reset-mode-${user.id}`
  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5" noValidate>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-ink">New password for {user.name}</legend>
        <ChoiceCard
          name={fieldName}
          value="temp"
          checked={mode === 'temp'}
          onChange={() => setMode('temp')}
          title="Make a temporary password"
          description="Recommended. We'll create one for you to share."
          autoFocus
        />
        <ChoiceCard
          name={fieldName}
          value="custom"
          checked={mode === 'custom'}
          onChange={() => setMode('custom')}
          title="Choose a password"
          description="Type the new password yourself."
        />
      </fieldset>

      {mode === 'custom' && (
        <PasswordField
          id={`new-password-${user.id}`}
          label="New password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          showStrength
          value={password}
          error={error}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      {mode === 'temp' && error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {isSelf && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          This is your own account. Use the new password next time you sign in.
        </p>
      )}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button type="submit" className={primaryButton} disabled={busy}>
          <KeyRound className="h-5 w-5" aria-hidden /> {busy ? 'Resetting…' : 'Reset password'}
        </button>
        <button type="button" className={secondaryButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}

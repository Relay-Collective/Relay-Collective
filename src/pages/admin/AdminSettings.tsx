import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { USER_KIND } from '../../admin/labels'
import { DetailList, Notice } from '../../components/admin/controls'
import { PasswordField } from '../../components/form/PasswordField'
import { primaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { CITIES, MIN_PASSWORD_LENGTH } from '../../constants'
import { useApp } from '../../hooks/useApp'
import { dataService, isDemoBackend } from '../../services'

// Personal settings that save, and the platform's configuration as it stands. Nothing here is a
// switch that does nothing: platform-wide settings live in code and the database for now.
export function AdminSettings() {
  const { currentUser } = useApp()
  if (!currentUser) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your administrator account, and how the platform is configured." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="me-title" className={panel}>
          <div className={panelHead}>
            <h2 id="me-title" className={panelTitle}>
              Your account
            </h2>
            <span className="text-xs font-medium text-slate-500">Personal</span>
          </div>
          <DetailList
            rows={[
              ['Name', currentUser.name],
              ['Email', currentUser.email],
              ['Role', USER_KIND[currentUser.role]],
            ]}
          />
          <ChangePassword />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="platform-title" className={panel}>
            <div className={panelHead}>
              <h2 id="platform-title" className={panelTitle}>
                Platform
              </h2>
              <span className="text-xs font-medium text-slate-500">Everyone · read-only</span>
            </div>
            <DetailList
              rows={[
                ['Data', isDemoBackend ? 'Demo data, kept in this browser only' : 'Live database'],
                ['Service area', CITIES.join(' and ')],
                ['Service modules', 'Transportation (in use). Others planned.'],
              ]}
            />
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">These are set in the code and database, not from this page.</p>
          </section>

          <section aria-labelledby="security-title" className={panel}>
            <div className={panelHead}>
              <h2 id="security-title" className={`${panelTitle} flex items-center gap-2`}>
                <ShieldCheck className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Access and security
              </h2>
            </div>
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-sm text-slate-700">
              <li>Admin access is checked by the database on every read and change, not only by this page.</li>
              <li>Approvals, rejections, and account removals run in admin-only database and server functions.</li>
              <li>Roles are set when an account is created. Nobody can give an account admin access from the browser.</li>
              <li>Organizations and drivers only see the records they’re part of.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (confirm !== password) return setError("The passwords don't match.")
    setBusy(true)
    setError(undefined)
    try {
      await dataService.updatePassword(password)
      setSaved(true)
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 border-t border-slate-100 px-5 py-4">
      <h3 className="font-sans text-sm font-semibold text-rc-navy">Change your password</h3>
      {saved && <Notice tone="success">Password changed. Use it next time you sign in.</Notice>}
      <PasswordField
        id="admin-new-password"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        showStrength
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordField id="admin-confirm-password" label="Confirm new password" autoComplete="new-password" value={confirm} error={error} onChange={(e) => setConfirm(e.target.value)} />
      <button type="submit" className={primaryButton} disabled={busy}>
        <KeyRound className="h-5 w-5" aria-hidden /> {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

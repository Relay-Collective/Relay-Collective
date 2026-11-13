import { ArrowRight, Bell, Car, KeyRound, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DetailList, Notice } from '../../components/admin/controls'
import { DeleteMyAccount } from '../../components/DeleteMyAccount'
import { PasswordField } from '../../components/form/PasswordField'
import { dangerOutlineButton, primaryButton, secondaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { MIN_PASSWORD_LENGTH } from '../../constants'
import { useApp } from '../../hooks/useApp'
import { useVolunteer } from '../../hooks/useVolunteer'
import { describeRequestHours } from '../../logic/requestHours'
import { isNative } from '../../native/platform'
import { dataService } from '../../services'
import { volunteerPaths } from '../../volunteer/paths'

const SECTIONS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'transportation', label: 'Transportation', icon: Car },
  { id: 'privacy', label: 'Privacy and security', icon: ShieldCheck },
]

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`${panel} scroll-mt-24`}>
      <div className={panelHead}>
        <h2 id={`${id}-title`} className={panelTitle}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

// Account settings that work today. Nothing here is a switch that doesn't save: where something
// isn't supported yet (such as changing email), the page says so instead.
export function Settings() {
  const { currentUser, signOut } = useApp()
  const { driver } = useVolunteer()
  const [deleting, setDeleting] = useState(false)
  if (!currentUser) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, how you hear from Relay Collective, and your privacy." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24">
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {/* Transportation settings exist only for an account with a driver profile */}
            {SECTIONS.filter((section) => section.id !== 'transportation' || driver).map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0">
                <a href={`#${id}`} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white hover:text-rc-navy ${focusRing}`}>
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <Panel id="account" title="Account">
            <DetailList
              rows={[
                ['Name', currentUser.name],
                ['Email', currentUser.email ?? '—'],
                ['Mobile phone', currentUser.phone || '—'],
              ]}
            />
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Your email is how you sign in. Changing it, your name, or your phone number isn't available here yet: contact the Relay Collective team.
            </p>
            {currentUser.email && <ChangePassword email={currentUser.email} />}
          </Panel>

          <Panel id="notifications" title="Notifications">
            <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
              <p>Here's how Relay Collective tells you about things today:</p>
              {driver ? (
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>New ride requests appear in Opportunities, with a count beside it in the menu.</li>
                  <li>If a ride you accepted is cancelled, a notice appears at the top of the workspace.</li>
                  {isNative && <li>Your phone vibrates when a new request arrives while the app is open.</li>}
                  <li>Verification decisions show on your Overview and profile.</li>
                </ul>
              ) : (
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Replies to feedback you send show in My feedback, with a count beside it in the menu.</li>
                </ul>
              )}
              {driver && (
                <Link to={volunteerPaths.notifications} className={secondaryButton}>
                  Open CareRide notifications <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </Panel>

          {driver && (
            <Panel id="transportation" title="Transportation">
              <DetailList
                rows={[
                  ['Request hours', describeRequestHours(driver.requestHours)],
                  ['Service area', driver.serviceCities.join(', ') || 'None chosen'],
                  ['Vehicle', `${driver.vehicle} · ${driver.seats} ${driver.seats === 1 ? 'passenger' : 'passengers'}${driver.wheelchairAccessible ? ' · Wheelchair accessible' : ''}`],
                ]}
              />
              <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
                <Link to={volunteerPaths.availability} className={`${secondaryButton} min-h-11 px-4 text-sm`}>
                  Availability and area <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to={volunteerPaths.profile} className={`${secondaryButton} min-h-11 px-4 text-sm`}>
                  Vehicle details <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Panel>
          )}

          <Panel id="privacy" title="Privacy and security">
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-10 text-sm text-slate-700">
              <li>Organizations see your first name, phone, and vehicle only for rides you accept.</li>
              <li>You see a passenger's details only after you accept their ride.</li>
              <li>Every change is checked by the database against your own account, not only by this page.</li>
            </ul>
            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-rc-navy">Sign out</p>
                <p className="text-sm text-slate-600">Signs you out on this device only.</p>
              </div>
              <button type="button" className={`${secondaryButton} min-h-11 px-4 text-sm`} onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
              </button>
            </div>
            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-rc-navy">Delete account</p>
                <p className="text-sm text-slate-600">
                  {currentUser.role === 'VOLUNTEER'
                    ? 'Closes your sign-in. Your volunteer profile and interests stay with the closed account until the Relay Collective team deletes it.'
                    : 'Closes your sign-in. Finished rides stay on record, and upcoming rides you accepted go back to other drivers. Finish any trip under way first.'}
                </p>
              </div>
              <button type="button" className={`${dangerOutlineButton} min-h-11 shrink-0 px-4 text-sm`} onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete account
              </button>
            </div>
          </Panel>
        </div>
      </div>
      {deleting && <DeleteMyAccount user={currentUser} onClose={() => setDeleting(false)} />}
    </div>
  )
}

// Asks for the current password first, so an unattended, signed-in phone can't be used to take over the account
function ChangePassword({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [currentError, setCurrentError] = useState<string>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    setCurrentError(undefined)
    if (!currentPassword) return setCurrentError('Enter your current password.')
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (confirm !== password) return setError("The passwords don't match.")
    setBusy(true)
    setError(undefined)
    try {
      // Signing in again as the same person checks the current password; a wrong one leaves the session as it was
      await dataService.signIn(email, currentPassword)
    } catch {
      setCurrentError("That isn't your current password.")
      setBusy(false)
      return
    }
    try {
      await dataService.updatePassword(password)
      setSaved(true)
      setCurrentPassword('')
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
      <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-rc-navy">
        <KeyRound className="h-4 w-4" aria-hidden /> Change your password
      </h3>
      {saved && <Notice tone="success">Password changed. Use it next time you sign in.</Notice>}
      <PasswordField
        id="volunteer-current-password"
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        error={currentError}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <PasswordField
        id="volunteer-new-password"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        showStrength
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordField
        id="volunteer-confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        error={error}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button type="submit" className={primaryButton} disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

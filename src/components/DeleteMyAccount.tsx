import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { TextField } from './form/TextField'
import { dangerButton, secondaryButton } from './ui'
import { useApp } from '../hooks/useApp'
import { dataService } from '../services'
import type { User } from '../types'

const EFFECTS: Record<'DRIVER' | 'PARTNER' | 'VOLUNTEER', string> = {
  DRIVER:
    "You won't be able to sign in, and Relay Collective will stop sending you requests. Rides you've already finished stay on record. Requests waiting on you go to the next driver, and upcoming rides you accepted go back out to other drivers.",
  VOLUNTEER:
    "You won't be able to sign in any more. Your volunteer profile and the interests you saved stay with the closed account until the Relay Collective team deletes it.",
  PARTNER:
    "You won't be able to sign in any more. Past rides stay on record. If you're the last member of your organization who can sign in, rides that haven't started are cancelled, so drivers aren't sent to a pickup nobody is managing. A ride already on the way finishes as usual.",
}

// Asks the signed-in driver, volunteer or partner to type their name before closing the account.
export function DeleteMyAccount({ user, onClose }: { user: User; onClose: () => void }) {
  const { signOut } = useApp()
  const dialog = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const matches = typed.trim().toLowerCase() === user.name.trim().toLowerCase()
  const role = user.role === 'PARTNER' || user.role === 'VOLUNTEER' ? user.role : 'DRIVER'

  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => node?.close()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!matches || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await dataService.deleteMyAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
      return
    }
    try {
      await signOut()
    } catch {
      // The account is already closed. Signing out still leaves this page.
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-my-account-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[20px] border border-slate-200 bg-white p-6 text-ink rc-dialog shadow-[0_24px_48px_-12px_rgb(17_24_32/0.25)]"
      onCancel={(e) => {
        if (busy) e.preventDefault()
        else onClose()
      }}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h2 id="delete-my-account-title" className="text-xl font-bold">
            Delete your account?
          </h2>
          <p className="mt-2 text-slate-700">{EFFECTS[role]}</p>
          <p className="mt-2 font-semibold text-slate-700">This can't be undone.</p>
        </div>
        <TextField
          id="confirm-delete-my-account"
          label={`Type "${user.name}" to confirm`}
          autoComplete="off"
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:flex sm:flex-row-reverse">
          <button type="submit" className={dangerButton} disabled={!matches || busy}>
            <Trash2 className="h-5 w-5" aria-hidden /> {busy ? 'Deleting…' : 'Delete account'}
          </button>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Go back
          </button>
        </div>
      </form>
    </dialog>
  )
}

import { RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { dangerOutlineButton, secondaryButton } from '../../components/ui'
import { compactButton } from '../../components/workspace/styles'
import { useLoadable } from '../../hooks/useLoadable'
import { ERROR_GUIDANCE, isOpen, needsRetry } from '../../logic/accountDeletion'
import { dataService } from '../../services'
import type { User } from '../../types'
import { DeleteAccountDialog, DeletionProgress } from './DeleteAccountDialog'

interface Props {
  user: User
  isSelf: boolean
  onChanged: () => void // a deletion started or moved on: reload the account list
  onDeleted: () => void // the backend confirmed the deletion completed
}

// Account actions that can't be taken back, kept apart from the rest of the page.
// Removing someone from one organization is that organization's administrators' job (Organization → Team), and
// switching an account off on its own isn't offered, since nothing can switch it back on yet.
export function AccountDangerZone({ user, isSelf, onChanged, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  // A deletion already under way: its job, straight from the backend
  const preview = useLoadable(
    () => (user.deletionStatus ? dataService.previewAccountDeletion(user.id) : Promise.resolve(undefined)),
    `${user.id}|${user.deletionStatus ?? ''}`,
  )
  const job = preview.data?.job
  const underWay = !!user.deletionStatus

  return (
    <section aria-labelledby="danger-zone" className="rounded-xl border border-red-200 bg-white">
      <div className="border-b border-red-100 px-5 py-4">
        <h2 id="danger-zone" className="font-heading text-base font-bold text-red-800">
          Danger Zone
        </h2>
        <p className="mt-1 text-sm text-slate-600">Manage actions that affect this user’s account and access to Relay Collective.</p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h3 className="font-semibold text-ink">Permanently delete account</h3>
          {underWay ? (
            <>
              <p className="text-sm text-slate-700">
                {needsRetry(job)
                  ? 'This account’s deletion stopped before it finished. The account stays switched off until it completes.'
                  : 'This account is being deleted. It’s switched off, so the person can’t use Relay Collective.'}
              </p>
              {job?.errorCode && <p className="text-sm text-red-800">{ERROR_GUIDANCE[job.errorCode]}</p>}
              {job && isOpen(job) && <DeletionProgress job={job} />}
              {preview.error && <p className="text-sm text-red-700">{preview.error}</p>}
            </>
          ) : (
            <p className="max-w-prose text-sm text-slate-700">
              Deletes their sign-in and erases their personal information. Rides and other records their organization relies on stay, without their
              name. This can’t be undone through Relay Collective.
            </p>
          )}
          {isSelf && <p className="text-sm text-slate-500">You can’t delete the account you’re signed in with.</p>}
        </div>

        {!isSelf &&
          (underWay ? (
            <button type="button" className={`${secondaryButton} ${compactButton} shrink-0`} onClick={() => setOpen(true)} disabled={!job}>
              <RotateCcw className="h-4 w-4" aria-hidden /> {needsRetry(job) ? 'Review and retry' : 'View progress'}
            </button>
          ) : (
            <button type="button" className={`${dangerOutlineButton} ${compactButton} shrink-0`} onClick={() => setOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Permanently Delete Account
            </button>
          ))}
      </div>

      {open && (
        <DeleteAccountDialog
          user={user}
          job={underWay ? job : undefined}
          onClose={(changed) => {
            setOpen(false)
            if (changed) onChanged()
          }}
          onDeleted={() => {
            setOpen(false)
            onDeleted()
          }}
        />
      )}
    </section>
  )
}

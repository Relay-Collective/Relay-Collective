import { CheckCircle2, CircleAlert, LoaderCircle, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ModalDialog } from '../../components/membership/ModalDialog'
import { PasswordField } from '../../components/form/PasswordField'
import { TextField } from '../../components/form/TextField'
import { dangerButton, secondaryButton } from '../../components/ui'
import {
  ACTION_LABELS,
  BLOCKER_MESSAGES,
  CATEGORY_LABELS,
  CATEGORY_NOTES,
  ERROR_GUIDANCE,
  STEP_LABELS,
  STEP_ORDER,
  emailMatches,
  needsRetry,
  shownCategories,
} from '../../logic/accountDeletion'
import { formatDayTime } from '../../logic/formatTime'
import { dataService } from '../../services'
import type { AccountDeletionAction, AccountDeletionCategory, AccountDeletionJob, AccountDeletionPreview, User } from '../../types'

// Permanently deleting one account, for a platform admin. Every step is decided and checked by the backend:
// the preview comes from the data, the deletion runs server-side, and success is shown only once the
// backend says the job completed (docs/ACCOUNT_DELETION.md).

const POLL_MS = 1500

const ACTION_LOOK: Record<AccountDeletionAction, string> = {
  delete: 'text-red-700',
  anonymize: 'text-amber-800',
  remove: 'text-red-700',
  detach: 'text-slate-700',
  reassign: 'text-slate-700',
  retain: 'text-slate-700',
  none: 'text-slate-500',
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

// What the backend plans for each kind of data, with its own counts
export function DeletionImpactSummary({ categories }: { categories: AccountDeletionCategory[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">What deleting this account does to each kind of data</caption>
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2">
              Data
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Records
            </th>
            <th scope="col" className="px-3 py-2">
              Planned action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shownCategories(categories).map((c) => (
            <tr key={c.key} className="align-top">
              <th scope="row" className="px-3 py-2 font-medium text-ink">
                {CATEGORY_LABELS[c.key]}
                {CATEGORY_NOTES[c.key] && <span className="mt-0.5 block text-xs font-normal text-slate-500">{CATEGORY_NOTES[c.key]}</span>}
              </th>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.action === 'none' ? '—' : c.count}</td>
              <td className={`px-3 py-2 font-semibold ${ACTION_LOOK[c.action]}`}>{ACTION_LABELS[c.action]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The job's real state: which steps the backend has finished, and where it is now. No made-up percentages.
export function DeletionProgress({ job }: { job: AccountDeletionJob }) {
  const current = STEP_ORDER.indexOf(job.step)
  const stopped = job.status === 'failed' || job.status === 'requires_attention'
  return (
    <ol className="space-y-2 text-sm" aria-label="Deletion steps">
      {STEP_ORDER.map((step, i) => {
        const done = job.status === 'completed' || i < current
        const here = i === current && !done
        return (
          <li key={step} className="flex items-center gap-2" aria-current={here ? 'step' : undefined}>
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : here && stopped ? (
              <CircleAlert className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
            ) : here ? (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-rc-blue" aria-hidden />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" aria-hidden />
            )}
            <span className={done || here ? 'font-medium text-ink' : 'text-slate-500'}>
              {STEP_LABELS[step]}
              <span className="sr-only">{done ? ' (done)' : here ? (stopped ? ' (stopped here)' : ' (in progress)') : ' (not started)'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function JobFacts({ job }: { job: AccountDeletionJob }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-slate-500">Status</dt>
      <dd className="font-medium text-ink">{job.status.replace('_', ' ')}</dd>
      <dt className="text-slate-500">Attempts</dt>
      <dd className="text-ink">{job.attempts}</dd>
      <dt className="text-slate-500">Last update</dt>
      <dd className="text-ink">{formatDayTime(job.updatedAt)}</dd>
      <dt className="text-slate-500">Deletion ID</dt>
      <dd className="break-all font-mono text-xs text-ink">{job.id}</dd>
    </dl>
  )
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; preview: AccountDeletionPreview }
  | { kind: 'running'; job?: AccountDeletionJob }
  | { kind: 'result'; job: AccountDeletionJob }

interface Props {
  user: User
  job?: AccountDeletionJob // an open deletion to carry on with; otherwise a new one starts from a fresh preview
  onClose: (changed: boolean) => void
  onDeleted: () => void
}

export function DeleteAccountDialog({ user, job: openJob, onClose, onDeleted }: Props) {
  const [stage, setStage] = useState<Stage>(openJob ? { kind: 'result', job: openJob } : { kind: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [changed, setChanged] = useState(!!openJob)
  // Kept from the first preview: once deletion starts, the profile no longer has a name or email to show
  const [target, setTarget] = useState({ name: user.name, email: user.email })
  const busy = stage.kind === 'running'

  useEffect(() => {
    if (openJob) return
    let active = true
    dataService.previewAccountDeletion(user.id).then(
      (preview) => {
        if (!active) return
        if (preview.state === 'IN_PROGRESS' && preview.job) setStage({ kind: 'result', job: preview.job })
        else setStage({ kind: 'preview', preview })
        if (preview.name) setTarget({ name: preview.name, email: preview.email })
      },
      (err: unknown) => active && setStage({ kind: 'error', message: errorText(err) }),
    )
    return () => {
      active = false
    }
  }, [user.id, openJob])

  // While the backend works, show the step it's really on, read back from the backend
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => {
      dataService.previewAccountDeletion(user.id).then(
        (p) => p.job && setStage((s) => (s.kind === 'running' ? { kind: 'running', job: p.job } : s)),
        () => undefined, // the request itself reports failures
      )
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [busy, user.id])

  // fallback: where to go back to if the backend refuses before anything changes
  async function run(action: () => Promise<AccountDeletionJob>, fallback: Stage) {
    setError(undefined)
    setStage({ kind: 'running' })
    try {
      const job = await action()
      setChanged(true)
      setPassword('')
      setStage({ kind: 'result', job })
    } catch (err) {
      // Refused before anything changed (wrong password, a new blocker), or the connection dropped
      setError(errorText(err))
      setStage((s) => (s.kind === 'running' && s.job ? { kind: 'result', job: s.job } : fallback))
    }
  }

  function start(e: FormEvent) {
    e.preventDefault()
    if (!emailMatches(email, target.email) || !password) return
    void run(() => dataService.startAccountDeletion(user.id, { email, password }), stage)
  }

  function retry(e: FormEvent, job: AccountDeletionJob) {
    e.preventDefault()
    if (!password) return
    void run(() => dataService.retryAccountDeletion(job.id, password), stage)
  }

  async function refresh(job: AccountDeletionJob) {
    setError(undefined)
    try {
      const latest = await dataService.getAccountDeletion(job.id)
      if (latest) setStage({ kind: 'result', job: latest })
    } catch (err) {
      setError(errorText(err))
    }
  }

  const close = () => (stage.kind === 'result' && stage.job.status === 'completed' ? onDeleted() : onClose(changed))
  const formId = `delete-account-${user.id}`
  const errorBox = error && (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
      {error}
    </p>
  )

  let title = 'Permanently delete this account?'
  let body: ReactNode
  let footer: ReactNode = null

  if (stage.kind === 'loading') {
    body = (
      <p className="flex items-center gap-2 text-slate-600" role="status">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Checking what this account has…
      </p>
    )
  } else if (stage.kind === 'error') {
    body = (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
        {stage.message}
      </p>
    )
    footer = (
      <button type="button" className={secondaryButton} onClick={() => onClose(false)}>
        Close
      </button>
    )
  } else if (stage.kind === 'preview' && stage.preview.state === 'DELETED') {
    title = 'This account was permanently deleted'
    body = <p className="text-slate-700">It no longer exists in Relay Collective’s active systems. Refresh the user list to see the latest.</p>
    footer = (
      <button type="button" className={secondaryButton} onClick={onDeleted}>
        Back to users
      </button>
    )
  } else if (stage.kind === 'preview' && stage.preview.state === 'BLOCKED') {
    title = 'This account can’t be deleted yet'
    body = (
      <div className="space-y-3 text-sm">
        <p className="text-slate-700">
          Nothing has been changed. Relay Collective won’t delete <strong className="break-all">{target.email ?? target.name}</strong> until:
        </p>
        <ul className="space-y-2">
          {stage.preview.blockers.map((b) => (
            <li key={b} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {BLOCKER_MESSAGES[b]}
            </li>
          ))}
        </ul>
      </div>
    )
    footer = (
      <button type="button" className={secondaryButton} onClick={() => onClose(false)}>
        Close
      </button>
    )
  } else if (stage.kind === 'preview') {
    const matches = emailMatches(email, target.email)
    body = (
      <form id={formId} onSubmit={start} className="space-y-4" noValidate>
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-950">
          <p>
            You are about to permanently delete the account associated with <strong className="break-all">{target.email}</strong>.
          </p>
          <p>This will remove the user’s Relay Collective authentication account and applicable personal information from our active systems.</p>
          <p className="font-semibold">This action cannot be undone through Relay Collective.</p>
          <p>Certain historical records may be retained in anonymized form where necessary.</p>
        </div>
        <section aria-label="Account deletion summary" className="space-y-2">
          <h3 className="text-sm font-bold text-slate-600">Account deletion summary</h3>
          <DeletionImpactSummary categories={stage.preview.categories} />
          <p className="text-xs text-slate-500">
            Backups follow their own retention schedule and expire on their own; this doesn’t erase them immediately.
          </p>
        </section>
        <TextField
          id={`${formId}-email`}
          label={`Type ${target.email} to confirm`}
          autoComplete="off"
          spellCheck={false}
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint={email && !matches ? 'This doesn’t match the account’s email yet.' : undefined}
        />
        <PasswordField
          id={`${formId}-password`}
          label="Your password"
          hint="To confirm it’s you. Your session stays signed in."
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errorBox}
      </form>
    )
    footer = (
      <>
        <button type="submit" form={formId} className={dangerButton} disabled={!matches || !password}>
          <Trash2 className="h-5 w-5" aria-hidden /> Permanently Delete Account
        </button>
        <button type="button" className={secondaryButton} onClick={() => onClose(false)}>
          Cancel
        </button>
      </>
    )
  } else if (stage.kind === 'running') {
    title = 'Deleting account'
    body = (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="text-slate-700">Relay Collective is removing the account and its associated personal information.</p>
        {stage.job ? (
          <DeletionProgress job={stage.job} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Starting…
          </p>
        )}
      </div>
    )
    footer = (
      <button type="button" className={dangerButton} disabled>
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Deleting…
      </button>
    )
  } else if (stage.job.status === 'completed') {
    title = 'Account permanently deleted'
    body = (
      <div className="space-y-4" role="status">
        <p className="flex items-start gap-2 text-slate-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          The account has been removed from Relay Collective’s active systems.
        </p>
        <DeletionProgress job={stage.job} />
      </div>
    )
    footer = (
      <button type="button" className={secondaryButton} onClick={onDeleted} autoFocus>
        Done
      </button>
    )
  } else {
    const { job } = stage
    const stopped = needsRetry(job)
    title = stopped ? 'Account deletion could not be completed' : 'Deleting account'
    body = (
      <form id={formId} onSubmit={(e) => retry(e, job)} className="space-y-4" noValidate>
        {stopped ? (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">Some steps require attention. The account deletion has not been confirmed as complete.</p>
            <p>{job.errorCode ? ERROR_GUIDANCE[job.errorCode] : ERROR_GUIDANCE.INTERRUPTED}</p>
          </div>
        ) : (
          <p className="text-slate-700" role="status">
            Relay Collective is removing the account and its associated personal information.
          </p>
        )}
        <DeletionProgress job={job} />
        <JobFacts job={job} />
        <p className="text-sm text-slate-600">
          The account is switched off throughout, so the person can’t use Relay Collective while this is unfinished. Retrying carries on from the step
          that stopped; finished steps aren’t repeated.
        </p>
        {stopped && (
          <PasswordField
            id={`${formId}-password`}
            label="Your password"
            hint="To confirm it’s you before trying again."
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {errorBox}
      </form>
    )
    footer = (
      <>
        {stopped ? (
          <button type="submit" form={formId} className={dangerButton} disabled={!password}>
            <RotateCcw className="h-5 w-5" aria-hidden /> Retry deletion
          </button>
        ) : (
          <button type="button" className={secondaryButton} onClick={() => void refresh(job)}>
            <RotateCcw className="h-5 w-5" aria-hidden /> Check again
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={close}>
          Close
        </button>
      </>
    )
  }

  return (
    <ModalDialog
      open
      title={title}
      description={stage.kind === 'preview' ? `${target.name} · ${target.email ?? ''}` : undefined}
      busy={busy}
      onClose={close}
      footer={footer}
    >
      {body}
    </ModalDialog>
  )
}

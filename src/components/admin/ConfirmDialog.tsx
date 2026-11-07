import { LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { dangerButton, primaryButton, secondaryButton } from '../ui'

interface Props {
  open: boolean
  title: string
  body: ReactNode // what will happen, in plain words
  confirmLabel: string
  tone?: 'primary' | 'danger'
  busy?: boolean // the action is running: both buttons wait, so it can't be sent twice
  onConfirm: () => void
  onCancel: () => void
}

// Asks once before a decision that matters. Stays open while the action runs, so the
// result (or an error) is seen in context, and Escape can't dismiss it mid-request.
export function ConfirmDialog({ open, title, body, confirmLabel, tone = 'primary', busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId() // several dialogs can share a page

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault() // Escape: close through state, and never while busy
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rc-dialog rounded-[20px] p-6 text-rc-navy shadow-[0_24px_48px_-12px_rgb(17_24_32/0.25)]"
    >
      <h2 id={titleId} className="font-heading text-xl font-bold">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-slate-700">{body}</div>
      <div className="mt-6 grid gap-3 sm:flex sm:flex-row-reverse">
        <button type="button" className={tone === 'danger' ? dangerButton : primaryButton} disabled={busy} onClick={onConfirm}>
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />}
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={onCancel}>
          Go back
        </button>
      </div>
    </dialog>
  )
}

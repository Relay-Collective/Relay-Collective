import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { focusRing } from '../workspace/styles'

interface Props {
  open: boolean
  title: string
  description?: ReactNode
  busy?: boolean // an action is running: Escape and the close button wait
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

// A modal panel for reviewing and managing one person. Like ConfirmDialog, it stays open while an action
// runs so the result (or an error) is seen in context. Full width on phones, scrolls inside on short screens.
export function ModalDialog({ open, title, description, busy, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
        e.preventDefault()
        if (!busy) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rc-dialog rounded-xl p-0 text-rc-navy shadow-[0_24px_48px_-12px_rgb(17_24_32/0.25)] open:flex open:flex-col"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-xl font-bold">
            {title}
          </h2>
          {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
        </div>
        <button
          type="button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
          className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-rc-navy disabled:opacity-50 ${focusRing}`}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="grid gap-3 border-t border-slate-100 px-6 py-4 sm:flex sm:flex-row-reverse">{footer}</div>}
    </dialog>
  )
}

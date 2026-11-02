import { CircleCheck, LoaderCircle, MessageSquareHeart, RotateCcw, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FeedbackOpenOptions } from '../../context/feedbackContext'
import { myFeedbackPaths } from '../../feedback/paths'
import { formatReference, isDraftEmpty, pageLabel, sanitizeRoute, validateFeedback, workspaceFor, type FeedbackDraft, type FeedbackErrors } from '../../feedback/rules'
import type { PreparedScreenshot } from '../../feedback/screenshot'
import { retryScreenshot, sendFeedback, type SendOutcome } from '../../feedback/submit'
import { useApp } from '../../hooks/useApp'
import { dataService } from '../../services'
import type { User } from '../../types'
import { Notice } from '../admin/controls'
import { dangerOutlineButton, primaryButton, secondaryButton } from '../ui'
import { focusRing } from '../workspace/styles'
import { FeedbackForm } from './FeedbackForm'

type View = 'form' | 'discard' | 'sent'

const EMPTY: FeedbackDraft = { title: '', description: '' }

interface Props {
  user: User
  request?: { options: FeedbackOpenOptions; key: number } // a new key opens the dialog
  onClosed: () => void
}

// "Send feedback", from anywhere in the signed-in app. Opens over the current page, so nobody loses their place.
export function FeedbackDialog({ user, request, onClosed }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { refresh } = useApp()
  const [view, setView] = useState<View>('form')
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY)
  const [errors, setErrors] = useState<FeedbackErrors>({})
  const [screenshot, setScreenshot] = useState<PreparedScreenshot>()
  const [route, setRoute] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<string>()
  const [outcome, setOutcome] = useState<SendOutcome>()
  // One id per form: a retry after a lost answer finds the first submission instead of making another
  const requestId = useRef('')
  const sending = useRef(false) // stops a double click before the busy state has rendered
  const typeRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Open on each request, starting a fresh form about the page behind the dialog
  const openedKey = useRef<number>(undefined)
  useEffect(() => {
    const dialog = ref.current
    if (!request || !dialog || openedKey.current === request.key) return
    openedKey.current = request.key
    requestId.current = crypto.randomUUID()
    setDraft({ ...EMPTY, feedbackType: request.options.type, relatedRelease: request.options.release })
    setErrors({})
    setScreenshot(undefined)
    setSendError(undefined)
    setOutcome(undefined)
    setView('form')
    setRoute(sanitizeRoute(pathname))
    if (!dialog.open) dialog.showModal()
    requestAnimationFrame(() => (request.options.type ? titleRef : typeRef).current?.focus())
  }, [request, pathname])

  // Moving between form, "discard?", and "thank you": focus follows, so screen readers hear the new step
  useEffect(() => {
    if (view !== 'form') requestAnimationFrame(() => headingRef.current?.focus())
  }, [view])

  function close() {
    ref.current?.close()
    openedKey.current = undefined
    onClosed()
  }

  // Escape, the close button, the backdrop and Cancel all come here. Nothing typed is lost without asking.
  function requestClose() {
    if (busy) return
    if (view === 'form' && !isDraftEmpty(draft, !!screenshot)) setView('discard')
    else close()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (sending.current) return
    const found = validateFeedback(draft)
    setErrors(found)
    if (found.feedbackType || found.title || found.description) {
      ;(found.feedbackType ? typeRef : found.title ? titleRef : descriptionRef).current?.focus()
      return
    }
    sending.current = true
    setBusy(true)
    setSendError(undefined)
    try {
      const result = await sendFeedback(
        dataService,
        {
          feedbackType: draft.feedbackType!,
          title: draft.title.trim(),
          description: draft.description.trim(),
          sourcePage: route,
          sourceWorkspace: workspaceFor(user.role, route),
          relatedRelease: draft.feedbackType === 'release_feedback' ? draft.relatedRelease : undefined,
        },
        requestId.current,
        screenshot,
      )
      setOutcome(result)
      setView('sent')
      refresh() // My feedback and the admin inbox show it straight away
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'We couldn’t send your feedback. Please try again.')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  async function retry() {
    if (!outcome || !screenshot || sending.current) return
    sending.current = true
    setBusy(true)
    const result = await retryScreenshot(dataService, outcome.feedback.id, screenshot)
    setOutcome({ ...outcome, ...result })
    sending.current = false
    setBusy(false)
  }

  const links = myFeedbackPaths(user.role)

  return (
    <dialog
      ref={ref}
      aria-labelledby="feedback-dialog-title"
      aria-describedby="feedback-dialog-description"
      onCancel={(e) => {
        e.preventDefault() // Escape: close through requestClose, so a typed draft is never dropped silently
        requestClose()
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()} // a click on the backdrop
      className="workspace m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] max-w-none overflow-hidden rc-dialog rounded-xl bg-white p-0 text-rc-navy shadow-[0_24px_48px_-12px_rgb(17_24_32/0.25)] open:flex open:flex-col"
    >
      {view === 'sent' && outcome ? (
        <div className="overflow-y-auto px-6 py-8 text-center sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700" aria-hidden>
            <CircleCheck className="h-7 w-7" />
          </span>
          <h2 id="feedback-dialog-title" ref={headingRef} tabIndex={-1} className="mt-4 font-heading text-2xl font-bold tracking-tight focus:outline-none">
            Thank you for helping us improve.
          </h2>
          <p id="feedback-dialog-description" className="mt-2 text-slate-600">
            Your feedback has been submitted to the Relay Collective team.
          </p>
          <p className="mt-1 text-sm text-slate-500">Reference {formatReference(outcome.feedback.reference)}</p>
          {outcome.attachmentError && (
            <div className="mt-5 text-left">
              <Notice tone="error">
                <p className="font-semibold">Your feedback was saved, but the screenshot didn’t upload.</p>
                <p className="mt-0.5">{outcome.attachmentError}</p>
                <button type="button" onClick={() => void retry()} disabled={busy} className={`${secondaryButton} mt-3 min-h-11 px-4 text-sm`}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                  {busy ? 'Uploading…' : 'Try uploading again'}
                </button>
              </Notice>
            </div>
          )}
          {outcome.attachment && screenshot && (
            <p className="mt-3 text-sm text-slate-600" role="status">
              Screenshot attached.
            </p>
          )}
          <div className="mt-7 grid gap-3 sm:flex sm:justify-center">
            <button
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={() => {
                close()
                navigate(links.list)
              }}
            >
              View My Feedback
            </button>
            <button type="button" className={primaryButton} disabled={busy} onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : view === 'discard' ? (
        <div className="px-6 py-7 sm:px-8">
          <h2 id="feedback-dialog-title" ref={headingRef} tabIndex={-1} className="font-heading text-xl font-bold focus:outline-none">
            Discard your feedback?
          </h2>
          <p id="feedback-dialog-description" className="mt-2 text-sm text-slate-700">
            What you’ve written {screenshot ? 'and the screenshot you chose ' : ''}won’t be sent or saved.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-row-reverse">
            <button type="button" className={primaryButton} onClick={() => setView('form')}>
              Keep editing
            </button>
            <button type="button" className={dangerOutlineButton} onClick={close}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-rc-blue sm:flex" aria-hidden>
              <MessageSquareHeart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="feedback-dialog-title" className="font-heading text-lg font-bold leading-snug tracking-tight sm:text-xl">
                Help us make Relay Collective better.
              </h2>
              <p id="feedback-dialog-description" className="mt-0.5 text-sm text-slate-600">
                Found something that could work better? We’d love to hear your thoughts.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
              className={`-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rc-navy disabled:opacity-50 ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <FeedbackForm
              draft={draft}
              errors={errors}
              onChange={(next) => {
                setDraft(next)
                // Fix-as-you-go: a corrected field stops showing its error
                if (Object.keys(errors).length) {
                  const now = validateFeedback(next)
                  setErrors((e) => ({ feedbackType: e.feedbackType && now.feedbackType, title: e.title && now.title, description: e.description && now.description }))
                }
              }}
              screenshot={screenshot}
              onScreenshot={setScreenshot}
              pageLabel={pageLabel(route)}
              disabled={busy}
              typeRef={typeRef}
              titleRef={titleRef}
              descriptionRef={descriptionRef}
            />
          </div>

          <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
            {sendError && (
              <div className="mb-3">
                <Notice tone="error">{sendError}</Notice>
              </div>
            )}
            <div className="grid gap-3 sm:flex sm:flex-row-reverse">
              <button type="submit" className={primaryButton} disabled={busy}>
                {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                {busy ? 'Sending…' : 'Submit Feedback'}
              </button>
              <button type="button" className={secondaryButton} disabled={busy} onClick={requestClose}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  )
}

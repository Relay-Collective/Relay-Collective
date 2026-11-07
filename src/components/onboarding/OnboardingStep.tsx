import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { FormAlert } from '../auth/FormAlert'
import { SubmitButton } from '../auth/SubmitButton'
import { authLead, authTitle, eyebrow } from '../auth/styles'
import { ghostButton } from '../ui'

interface Props {
  stepKey: string // changes per step: replays the entrance and moves focus to the heading
  label?: string // e.g. "Step 2 of 5"
  title: string
  description: ReactNode
  direction?: 'forward' | 'back'
  onSubmit: () => void
  onBack?: () => void
  backLabel?: string
  submitLabel: string
  busy?: boolean
  busyLabel?: string
  error?: string
  children: ReactNode
}

// One onboarding step: the question, its fields, and Back / Continue.
export function OnboardingStep({
  stepKey,
  label,
  title,
  description,
  direction = 'forward',
  onSubmit,
  onBack,
  backLabel = 'Back',
  submitLabel,
  busy = false,
  busyLabel = 'Saving…',
  error,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Keyboard and screen reader users land on the new step's heading
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    panelRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [stepKey])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!busy) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div ref={panelRef} key={stepKey} className={direction === 'forward' ? 'animate-step-forward' : 'animate-step-back'}>
        <header className="mb-10">
          {label && <p className={eyebrow}>{label}</p>}
          <h1 tabIndex={-1} className={`${authTitle} mt-3 focus:outline-none sm:text-[38px]`}>
            {title}
          </h1>
          <div className={authLead}>{description}</div>
        </header>

        {children}

        {error && <FormAlert className="mt-8">{error}</FormAlert>}

        <div className="mt-12 flex flex-col-reverse gap-3 border-t border-rc-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {onBack ? (
            <button type="button" className={ghostButton} onClick={onBack} disabled={busy}>
              <ArrowLeft className="h-5 w-5" aria-hidden /> {backLabel}
            </button>
          ) : (
            <span />
          )}
          <SubmitButton busy={busy} busyLabel={busyLabel} className="sm:min-w-44">
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}

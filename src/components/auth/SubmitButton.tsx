import { ArrowRight, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { primaryButton } from '../ui'

interface Props {
  busy: boolean
  busyLabel: string // said while waiting, e.g. "Signing in…"
  children: ReactNode
  arrow?: boolean
  className?: string
}

// The form's main button. Disabled while working, so a double click can't submit twice.
export function SubmitButton({ busy, busyLabel, children, arrow = true, className = '' }: Props) {
  return (
    <button type="submit" className={`${primaryButton} ${className}`} disabled={busy} aria-busy={busy || undefined}>
      {busy ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {busyLabel}
        </>
      ) : (
        <>
          {children}
          {arrow && <ArrowRight className="h-5 w-5" aria-hidden />}
        </>
      )}
    </button>
  )
}

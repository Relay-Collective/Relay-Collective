import { AlertCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { secondaryButton } from '../ui'
import { compactButton } from './styles'

// The three states every data-backed section can be in besides "here's your data".
// Nothing is ever shown as a zero while it is still loading or failed to load.

// compact: one quiet row, for "all clear" states that shouldn't take the space of real work.
// Green only when the empty list is good news (nothing waiting); grey when it simply hasn't started.
export function EmptyState({ icon, title, text, action, compact, tone = 'clear' }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; compact?: boolean; tone?: 'clear' | 'neutral' }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px] ${
            tone === 'clear' ? 'bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.2),0_0_0_5px_rgb(16_185_129/0.06)]' : 'bg-slate-100 text-slate-500'
          }`}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-bold tracking-[-0.01em] text-ink">{title}</span>
          {text && <span className="block text-sm text-slate-600">{text}</span>}
        </span>
        {action && <span className="shrink-0">{action}</span>}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-100),0_0_0_6px_rgb(2_151_222/0.05)]" aria-hidden>
        {icon}
      </span>
      <p className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-600">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionError({ message = "We couldn't load your organization's activity. Please try again." }: { message?: string }) {
  const { refresh } = useApp()
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-10 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-red-600" aria-hidden />
      <p className="max-w-sm text-sm text-slate-700">{message}</p>
      <button type="button" onClick={refresh} className={`${secondaryButton} ${compactButton} mt-4`}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  )
}

// Grey bars where content will be. Screen readers hear one "Loading" instead.
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-slate-200/80 ${className}`} aria-hidden />
}

export function SkeletonRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  id: string
  step: number
  title: string
  description?: string
  done?: boolean // shows "Done" with a green check beside the title
  className?: string
  children: ReactNode
}

// One numbered question in the booking sheet. The number says where it sits in the order; the
// title asks the question in plain words. Sections share one card, split by hairlines.
export function FormSection({ id, step, title, description, done, className = '', children }: Props) {
  const headingId = `${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className={`scroll-mt-28 px-5 py-6 sm:px-7 sm:py-7 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <span className="w-7 shrink-0 pt-[0.2rem] font-display text-sm font-semibold tabular-nums text-slate-500" aria-hidden>
          {String(step).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-display text-xl font-bold leading-7 tracking-[-0.02em] text-balance text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
        </div>
        {done && (
          <span className="mt-0.5 inline-flex shrink-0 animate-pop items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            Done
          </span>
        )}
      </div>
      <div className="sm:pl-10">{children}</div>
    </section>
  )
}

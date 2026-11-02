import { ChevronLeft, ChevronRight, ChevronRight as Separator, CircleAlert, CircleCheck, Info, Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { input, secondaryButton } from '../ui'
import { compactButton, focusRing } from '../workspace/styles'

// Small building blocks shared by the admin console's management pages.

export function SearchField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <div className="relative w-full shrink-0 sm:max-w-sm 2xl:w-72">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden />
      <input type="search" className={`${input} min-h-11 pl-10 text-[15px]`} placeholder={placeholder} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export interface FilterOption<K extends string> {
  id: K
  label: string
  count?: number
  alert?: boolean // the count is work waiting
}

// One choice from a short list, as toggle buttons. Counts are shown only once they're known.
export function FilterTabs<K extends string>({ options, value, onChange, label }: { options: FilterOption<K>[]; value: K; onChange: (id: K) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 max-xl:pr-8 max-xl:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] 2xl:pb-0">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 ease-out-quart ${focusRing} ${
              on ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-200)]' : 'text-slate-600 hover:bg-slate-100 hover:text-rc-navy'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  on ? 'bg-white text-brand-700' : o.alert && o.count ? 'bg-sun-400 text-ink' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// The bar above a table: filters on one side, search on the other. Until there's room for both on one line,
// search sits on its own row under the filters, so neither squeezes the other.
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">{children}</div>
}

export function Pagination({ index, pages, total, size, onPage, noun }: { index: number; pages: number; total: number; size: number; onPage: (i: number) => void; noun: [string, string] }) {
  if (total === 0) return null
  const from = index * size + 1
  const to = Math.min(total, from + size - 1)
  return (
    <nav aria-label="Pages" className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600 sm:flex-row">
      <p aria-live="polite">
        {pages > 1 ? `${from}–${to} of ` : ''}
        {total} {total === 1 ? noun[0] : noun[1]}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={`${secondaryButton} ${compactButton}`} disabled={index === 0} onClick={() => onPage(index - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </button>
          <span className="tabular-nums">
            Page {index + 1} of {pages}
          </span>
          <button type="button" className={`${secondaryButton} ${compactButton}`} disabled={index >= pages - 1} onClick={() => onPage(index + 1)}>
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <Separator className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
            {item.to ? (
              <Link to={item.to} className={`rounded font-medium hover:text-rc-navy hover:underline ${focusRing}`}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

const NOTICE = {
  success: { icon: CircleCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  error: { icon: CircleAlert, className: 'border-red-200 bg-red-50 text-red-800' },
  info: { icon: Info, className: 'border-slate-200 bg-white text-slate-700' },
}

// The outcome of an action, in words, right where it happened
export function Notice({ tone, children, onDismiss }: { tone: keyof typeof NOTICE; children: ReactNode; onDismiss?: () => void }) {
  const { icon: Icon, className } = NOTICE[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`-m-1 rounded-lg p-1 hover:bg-black/5 ${focusRing}`}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

// A label/value list for detail pages
export function DetailList({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="font-medium text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words text-rc-navy">{value ?? <span className="text-slate-500">Not recorded</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

// "Oct 4, 2026" (and the time in a tooltip), or nothing when the record has no date
export function DateText({ at, withTime }: { at?: string; withTime?: boolean }) {
  if (!at) return <span className="text-slate-500">Not recorded</span>
  const d = new Date(at)
  const text = withTime
    ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <time dateTime={at} title={d.toLocaleString()}>
      {text}
    </time>
  )
}

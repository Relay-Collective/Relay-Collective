import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from './states'
import { focusRing } from './styles'

interface Props {
  label: string
  value: number | undefined // undefined while loading; never shown as 0
  hint: string
  icon: LucideIcon
  to: string
  alert?: boolean | 'amber' // red: something's wrong; amber: work is waiting
}

// A row of headline numbers in one panel, split by hairlines rather than set out as separate cards.
// Each cell is a subgrid of three rows (label, number, hint), so numbers line up even when a label wraps.
// Each cell carries a left and top edge; the grid is pulled 1px under the frame so the outer ones disappear,
// which keeps the lines right at any column count, including a last row that isn't full.
// bare: no frame of its own, for a strip along the foot of a card. The top row's edge becomes the divider.
export function MetricGroup({ className = '', bare, children }: { className?: string; bare?: boolean; children: ReactNode }) {
  return (
    <div className={bare ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)]'}>
      <div className={`-ml-px grid ${bare ? '' : '-mt-px'} ${className}`}>{children}</div>
    </div>
  )
}

// One headline number that opens the list behind it. Lives inside a MetricGroup.
export function MetricCard({ label, value, hint, icon: Icon, to, alert }: Props) {
  const loading = value === undefined
  const raised = alert && !!value
  const look =
    alert === 'amber'
      ? { cell: 'bg-sun-50 hover:bg-sun-100/70', icon: 'text-amber-800', hint: 'font-semibold text-amber-900' }
      : { cell: 'bg-red-50/60 hover:bg-red-50', icon: 'text-red-700', hint: 'font-semibold text-red-700' }
  return (
    <Link
      to={to}
      aria-label={loading ? `${label}: loading` : `${label}: ${value}. ${hint}`}
      className={`group relative row-span-3 grid min-w-0 grid-rows-subgrid content-start border-l border-t border-slate-200/80 px-4 py-4 transition-colors duration-150 ease-out-quart sm:px-6 sm:py-6 ${focusRing} focus-visible:z-10 focus-visible:ring-inset focus-visible:ring-offset-0 ${
        raised ? look.cell : 'hover:bg-brand-50/50'
      }`}
    >
      <span className="flex items-start gap-2 pr-5" aria-hidden>
        <Icon className={`mt-px h-4 w-4 shrink-0 ${raised ? look.icon : 'text-slate-400'}`} strokeWidth={2.25} />
        <span className="min-w-0 text-[13px] font-semibold leading-tight text-slate-600">{label}</span>
      </span>
      <ArrowUpRight
        className="absolute right-4 top-4 h-4 w-4 text-slate-300 opacity-0 transition duration-150 ease-out-quart group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-rc-navy group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden"
        aria-hidden
      />
      <span className="mt-4 block self-end font-heading text-[34px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-ink sm:text-[44px]" aria-hidden>
        {loading ? <Skeleton className="h-9 w-12" /> : value}
      </span>
      <span className={`mt-2 block self-start text-[13px] leading-snug ${raised ? look.hint : 'text-slate-500'}`} aria-hidden>
        {hint}
      </span>
    </Link>
  )
}

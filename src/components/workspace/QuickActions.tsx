import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { focusRing } from './styles'

export interface QuickAction {
  to: string
  label: string
  detail: string
  icon: LucideIcon
}

// Shortcuts to working pages only. The caller decides what this account may do.
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <ul className="p-2">
      {actions.map(({ to, label, detail, icon: Icon }) => (
        <li key={to}>
          <Link to={to} className={`group flex items-center gap-3 rounded-lg p-3 transition-colors duration-150 ease-out-quart hover:bg-slate-50 ${focusRing}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors duration-150 ease-out-quart group-hover:bg-brand-50 group-hover:text-rc-blue" aria-hidden>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-rc-navy">{label}</span>
              <span className="block truncate text-sm text-slate-500">{detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rc-navy" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogoMark, wordmark } from '../brand/LogoMark'
import { useApp } from '../../hooks/useApp'
import { focusRing } from '../workspace/styles'

// rail: icons only. full: icons and words. responsive: a rail on tablets, full on desktop.
export type SidebarMode = 'rail' | 'full' | 'responsive'

export interface NavEntry {
  to: string
  label: string
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean // active only on this exact address, not the pages under it
  match?: string[] // other addresses that also count as this entry, and the pages under them
  badge?: string // key into the sidebar's live counts
}

export interface NavGroup {
  label?: string
  items: NavEntry[]
}

// A button among the footer links, e.g. "Send feedback", which opens a dialog instead of a page
export interface NavAction {
  label: string
  icon: LucideIcon
  onClick: () => void
}

// A live count beside a link, and what it counts, for screen readers ("3 need attention")
export interface NavBadge {
  count: number
  label: string
  tone?: 'alert' | 'waiting' // red for problems, amber for work in a queue
}

interface Props {
  mode: SidebarMode
  onNavigate?: () => void // e.g. close the phone drawer
  onToggleCollapse?: () => void // desktop only
  home: { to: string; label: string }
  context: { initials: string; title: string; subtitle: string; className: string } // whose space this is
  contextIcon?: ReactNode // shown in place of the initials
  groups: NavGroup[]
  footer: NavEntry[]
  actions?: NavAction[] // after the footer links
  badges?: Record<string, NavBadge | undefined>
}

// The sidebar of a signed-in console: whose space it is, where you can go, and how to leave.
export function SidebarNav({ mode, onNavigate, onToggleCollapse, home, context, contextIcon, groups, footer, actions = [], badges = {} }: Props) {
  const { signOut } = useApp()
  const { pathname } = useLocation()

  // Words show in full mode, and from the desktop breakpoint in responsive mode. They stay readable to screen readers.
  const words = mode === 'full' ? '' : mode === 'rail' ? 'sr-only' : 'sr-only lg:not-sr-only'
  const onlyFull = mode === 'full' ? '' : mode === 'rail' ? 'hidden' : 'hidden lg:block'
  const onlyRail = mode === 'full' ? 'hidden' : mode === 'rail' ? '' : 'lg:hidden'
  const center = mode === 'full' ? '' : mode === 'rail' ? 'justify-center' : 'justify-center lg:justify-start'

  const item = (entry: NavEntry) => {
    const badge = entry.badge ? badges[entry.badge] : undefined
    const count = badge?.count ?? 0
    const badgeTone = badge?.tone === 'waiting' ? 'bg-sun-400 text-ink' : 'bg-care-red text-white'
    const Icon = entry.icon
    const matched = entry.match?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false
    return (
      <li key={entry.to}>
        <NavLink
          to={entry.to}
          end={entry.end}
          onClick={onNavigate}
          title={mode === 'full' ? undefined : entry.label}
          className={({ isActive: exact }) => {
            const isActive = exact || matched
            return `group/nav relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors duration-150 ease-out-quart ${center} ${focusRing} ${
              isActive ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-100)]' : 'text-slate-600 hover:bg-slate-100 hover:text-rc-navy'
            }`
          }}
        >
          <Icon className="h-5 w-5 shrink-0 transition-transform duration-150 ease-out-quart group-active/nav:scale-90" aria-hidden />
          <span className={`min-w-0 flex-1 truncate ${words}`}>{entry.label}</span>
          {count > 0 && (
            <>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${badgeTone} ${onlyFull}`} aria-hidden>
                {count}
              </span>
              <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${badgeTone} ${onlyRail}`} aria-hidden />
              <span className="sr-only">
                , {count} {badge?.label}
              </span>
            </>
          )}
        </NavLink>
      </li>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-14 shrink-0 items-center px-4 ${center}`}>
        <Link to={home.to} onClick={onNavigate} className={`inline-flex min-h-11 items-center gap-2.5 rounded-lg ${focusRing}`} aria-label={home.label}>
          <LogoMark className="h-8 w-8" />
          <span className={`${wordmark} text-[18px] ${onlyFull}`}>Relay Collective</span>
        </Link>
      </div>

      <div className="px-3 pb-4 pt-1">
        <div className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-rc-canvas p-2 ${center}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold ${context.className}`} aria-hidden>
            {contextIcon ?? context.initials}
          </span>
          <span className={`min-w-0 ${words}`}>
            <span className="block truncate text-sm font-bold text-rc-navy">{context.title}</span>
            <span className="block truncate text-xs text-slate-500">{context.subtitle}</span>
          </span>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group, i) => (
          <div key={group.label ?? i} className={i ? 'mt-5' : ''}>
            {group.label && (
              <>
                <p className={`px-3 pb-1.5 text-[13px] font-semibold text-slate-500 ${onlyFull}`} aria-hidden>
                  {group.label}
                </p>
                <div className={`mx-3 mb-2 border-t border-slate-200 ${onlyRail}`} aria-hidden />
              </>
            )}
            <ul className="space-y-0.5" aria-label={group.label}>
              {group.items.map(item)}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-slate-200 p-3">
        {(footer.length > 0 || actions.length > 0) && (
          <ul>
            {footer.map(item)}
            {actions.map(({ label, icon: Icon, onClick }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.() // close the phone drawer first, so the dialog isn't stacked on it
                    onClick()
                  }}
                  title={mode === 'full' ? undefined : label}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-slate-600 transition-colors duration-150 ease-out-quart hover:bg-slate-100 hover:text-rc-navy ${center} ${focusRing}`}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className={`min-w-0 flex-1 truncate text-left ${words}`}>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={`flex gap-0.5 ${mode === 'full' ? '' : mode === 'rail' ? 'flex-col' : 'flex-col lg:flex-row'}`}>
          <button
            type="button"
            onClick={() => void signOut()}
            title={mode === 'full' ? undefined : 'Sign out'}
            className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-slate-600 transition-colors duration-150 ease-out-quart hover:bg-red-50 hover:text-red-700 ${center} ${focusRing}`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span className={words}>Sign out</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden min-h-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 ease-out-quart hover:bg-slate-100 hover:text-rc-navy lg:flex ${mode === 'rail' ? 'w-full' : 'lg:w-11'} ${focusRing}`}
              aria-label={mode === 'rail' ? 'Expand sidebar' : 'Collapse sidebar'}
              title={mode === 'rail' ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {mode === 'rail' ? <PanelLeftOpen className="h-5 w-5 shrink-0" aria-hidden /> : <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

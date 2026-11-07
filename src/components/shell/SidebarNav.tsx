import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
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
// Console 2.1, the route rail: the landing page's world at work. The main links are stations on one electric route,
// and the relay point (the logo's cantaloupe centre) travels along it to the current page. The current page is a
// midnight pill, as in the landing's workspace picture, so it reads by shape and contrast, not colour alone.
// The icon rail (tablets, or collapsed) drops the route and keeps the midnight tile.
export function SidebarNav({ mode, onNavigate, onToggleCollapse, home, context, contextIcon, groups, footer, actions = [], badges = {} }: Props) {
  const { signOut } = useApp()
  const { pathname } = useLocation()
  const { ref: routeRef, line, relay, settled } = useRoute(pathname, mode)

  // Words show in full mode, and from the desktop breakpoint in responsive mode. They stay readable to screen readers.
  const words = mode === 'full' ? '' : mode === 'rail' ? 'sr-only' : 'sr-only lg:not-sr-only'
  const onlyFull = mode === 'full' ? '' : mode === 'rail' ? 'hidden' : 'hidden lg:block'
  const onlyFullFlex = mode === 'full' ? 'flex' : mode === 'rail' ? 'hidden' : 'hidden lg:flex'
  const onlyRail = mode === 'full' ? 'hidden' : mode === 'rail' ? '' : 'lg:hidden'
  const center = mode === 'full' ? '' : mode === 'rail' ? 'justify-center' : 'justify-center lg:justify-start'

  // onRoute: a main link, with its station on the route. Footer links have none.
  const item = (entry: NavEntry, onRoute: boolean) => {
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
          className={`group/nav flex items-center gap-1.5 rounded-xl ${focusRing}`}
        >
          {({ isActive: exact }) => {
            const current = exact || matched
            return (
              <>
                {onRoute && (
                  <span data-station data-current={current || undefined} className={`${onlyFullFlex} w-5 shrink-0 justify-center`} aria-hidden>
                    <span
                      className={`h-2.5 w-2.5 rounded-full border-2 bg-white transition-colors duration-150 ease-out-quart ${
                        current ? 'border-transparent' : 'border-brand-300 group-hover/nav:border-electric'
                      }`}
                    />
                  </span>
                )}
                <span
                  className={`relative flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-150 ease-out-quart ${center} ${
                    current
                      ? 'bg-ink text-white shadow-[var(--shadow-press)] [&>svg]:text-brand-300'
                      : 'text-slate-600 group-hover/nav:bg-slate-100 group-hover/nav:text-ink [&>svg]:text-slate-500 group-hover/nav:[&>svg]:text-ink'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 transition-[scale,color] duration-150 ease-out-quart group-active/nav:scale-90" aria-hidden />
                  <span className={`min-w-0 flex-1 truncate ${words}`}>{entry.label}</span>
                  {count > 0 && (
                    <>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${badgeTone} ${onlyFull}`} aria-hidden>
                        {count}
                      </span>
                      <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ${current ? 'ring-ink' : 'ring-white'} ${badgeTone} ${onlyRail}`} aria-hidden />
                      <span className="sr-only">
                        , {count} {badge?.label}
                      </span>
                    </>
                  )}
                </span>
              </>
            )
          }}
        </NavLink>
      </li>
    )
  }

  const quiet = `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-slate-600 transition-colors duration-150 ease-out-quart hover:bg-slate-100 hover:text-ink [&>svg]:text-slate-500 hover:[&>svg]:text-ink ${center} ${focusRing}`

  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 shrink-0 items-center px-4 ${center}`}>
        <Link to={home.to} onClick={onNavigate} className={`inline-flex min-h-11 items-center gap-2 rounded-xl ${focusRing}`} aria-label={home.label}>
          <LogoMark className="h-8 w-8" />
          <span className={`${wordmark} text-[19px] ${onlyFull}`}>Relay Collective</span>
        </Link>
      </div>

      <div className="px-3 pb-4 pt-1">
        <div className={`flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[var(--shadow-rest)] ${center}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-heading text-sm font-bold ${context.className}`} aria-hidden>
            {contextIcon ?? context.initials}
          </span>
          <span className={`min-w-0 ${words}`}>
            <span className="block truncate text-sm font-bold text-ink">{context.title}</span>
            <span className="block truncate text-xs font-medium text-slate-500">{context.subtitle}</span>
          </span>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <div ref={routeRef} className="relative">
          {/* The route and its relay point. Drawn only beside the words, and kept from assistive technology. */}
          {line && (
            <span
              className={`pointer-events-none absolute left-[9px] w-0.5 rounded-full bg-brand-300/80 ${onlyFull}`}
              style={{ top: line[0], height: line[1] - line[0] }}
              aria-hidden
            />
          )}
          <span
            className={`pointer-events-none absolute left-[3px] top-0 z-10 h-3.5 w-3.5 rounded-full bg-cantaloupe shadow-[0_0_0_3px_#fff,0_4px_10px_-2px_rgb(252_115_77/0.55)] ${settled ? 'rc-relay' : ''} ${onlyFull}`}
            style={{ translate: `0 ${(relay ?? 0) - 7}px`, opacity: relay === null ? 0 : 1 }}
            aria-hidden
          />
          {groups.map((group, i) => (
            <div key={group.label ?? i} className={i ? 'mt-4' : ''}>
              {group.label && (
                <>
                  <p className={`pb-1.5 pl-[2.375rem] text-[13px] font-semibold text-slate-500 ${onlyFull}`} aria-hidden>
                    {group.label}
                  </p>
                  <div className={`mx-3 mb-2 border-t border-slate-200 ${onlyRail}`} aria-hidden />
                </>
              )}
              <ul className="space-y-0.5" aria-label={group.label}>
                {group.items.map((entry) => item(entry, true))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* In full width the footer lines up with the links on the route, past the stations' column */}
      <div className={`space-y-0.5 border-t border-slate-200/80 p-3 ${mode === 'full' ? 'pl-[2.375rem]' : mode === 'responsive' ? 'lg:pl-[2.375rem]' : ''}`}>
        {(footer.length > 0 || actions.length > 0) && (
          <ul className="space-y-0.5">
            {footer.map((entry) => item(entry, false))}
            {actions.map(({ label, icon: Icon, onClick }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.() // close the phone drawer first, so the dialog isn't stacked on it
                    onClick()
                  }}
                  title={mode === 'full' ? undefined : label}
                  className={`w-full ${quiet}`}
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
            className={`${quiet} min-w-0 flex-1 hover:!bg-red-50 hover:!text-red-700 hover:[&>svg]:!text-red-700`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span className={words}>Sign out</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden min-h-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 ease-out-quart hover:bg-slate-100 hover:text-ink lg:flex ${mode === 'rail' ? 'w-full' : 'lg:w-11'} ${focusRing}`}
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

// Where the route runs (first station to last) and where the relay point rests (the current page's station), measured
// from the stations themselves so it follows any label length, text size or zoom. Hidden stations measure nothing.
function useRoute(pathname: string, mode: SidebarMode) {
  const ref = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState<[number, number] | null>(null)
  const [relay, setRelay] = useState<number | null>(null)
  const [settled, setSettled] = useState(false)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      const top = box.getBoundingClientRect().top
      const mid = (el: Element) => {
        const r = el.getBoundingClientRect()
        return r.height ? r.top - top + r.height / 2 : null
      }
      const stations = [...box.querySelectorAll('[data-station]')].map(mid).filter((y): y is number => y !== null)
      setLine(stations.length > 1 ? [stations[0], stations[stations.length - 1]] : null)
      const current = box.querySelector('[data-station][data-current]')
      setRelay(current ? mid(current) : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [pathname, mode])

  // The first placement lands without travelling; after that the relay point moves between stations
  useLayoutEffect(() => {
    if (relay === null || settled) return
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [relay, settled])

  return { ref, line, relay, settled }
}

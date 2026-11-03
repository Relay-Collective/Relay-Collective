import { CalendarPlus, History, Inbox, LayoutDashboard, MapPin, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ModuleBadge, ModuleIconTile } from '../../../components/workspace/ServiceModuleCard'
import { focusRing } from '../../../components/workspace/styles'
import { CARERIDE } from '../../../workspace/modules'
import { careRidePaths as paths } from '../paths'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  current: (pathname: string, view: string | null) => boolean
}

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

// CareRide's pages, mapped onto the screens that already exist. Requests and History are two views
// of the one requests list; a ride's own page sits under Requests.
const TABS: Tab[] = [
  { to: paths.transport, label: 'Overview', icon: LayoutDashboard, current: (p) => p === paths.transport },
  {
    to: paths.requests,
    label: 'Requests',
    icon: Inbox,
    current: (p, view) => (p === paths.requests && view !== 'past') || under(p, `${paths.transport}/rides`),
  },
  { to: paths.newRide, label: 'New ride', icon: CalendarPlus, current: (p) => under(p, paths.newRide) },
  { to: paths.destinations, label: 'Destinations', icon: MapPin, current: (p) => under(p, paths.destinations) },
  { to: `${paths.requests}?view=past`, label: 'History', icon: History, current: (p, view) => p === paths.requests && view === 'past' },
]

// CareRide is a module inside the workspace, not a separate site. Its name, symbol and pages sit above
// the existing transportation screens, which render unchanged in the outlet. The workspace header
// still names the organization, and the sidebar still leads back to the platform.
export function CareRideLayout() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const view = params.get('view')
  const nav = useRef<HTMLElement>(null)

  // On a narrow screen the tabs scroll sideways: keep the current one in view (e.g. History, the last)
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname, view])

  return (
    <>
      <div className="no-print mb-7 border-b border-slate-200">
        <div className="flex items-center gap-3 pb-4">
          <ModuleIconTile module={CARERIDE} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-heading text-xl font-bold leading-tight tracking-[-0.025em] text-rc-navy">{CARERIDE.name}</span>
              <ModuleBadge status="active" />
            </p>
            <p className="text-sm text-slate-500">{CARERIDE.tagline}</p>
          </div>
        </div>
        <nav
          ref={nav}
          aria-label={CARERIDE.name}
          className="-mb-px -mx-1 flex gap-1 overflow-x-auto px-1 max-md:pr-8 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]"
        >
          {TABS.map(({ to, label, icon: Icon, current }) => {
            const on = current(pathname, view)
            return (
              <Link
                key={label}
                to={to}
                aria-current={on ? 'page' : undefined}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors duration-150 ease-out-quart ${focusRing} focus-visible:ring-offset-0 ${
                  on ? 'border-brand-600 text-rc-navy' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-rc-navy'
                }`}
              >
                <Icon className={`h-4 w-4 ${on ? 'text-brand-600' : ''}`} aria-hidden />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <Outlet />
    </>
  )
}

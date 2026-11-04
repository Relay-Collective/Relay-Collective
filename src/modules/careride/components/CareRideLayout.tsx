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
      <div className="no-print mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          <ModuleIconTile module={CARERIDE} size="lg" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-heading text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink">{CARERIDE.name}</span>
              <ModuleBadge status="active" />
            </p>
            <p className="text-sm text-slate-500">{CARERIDE.tagline}</p>
          </div>
        </div>
        {/* A segmented bar: the current page is a white pill raised off the track, so it reads by shape, not colour alone */}
        <nav
          ref={nav}
          aria-label={CARERIDE.name}
          className="-mx-4 overflow-x-auto px-4 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] sm:mx-0 sm:px-0"
        >
          <div className="inline-flex gap-1 rounded-full bg-slate-200/60 p-1 shadow-[inset_0_1px_2px_rgb(17_24_32/0.06)] max-md:mr-8">
            {TABS.map(({ to, label, icon: Icon, current }) => {
              const on = current(pathname, view)
              return (
                <Link
                  key={label}
                  to={to}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-out-quart ${focusRing} focus-visible:ring-offset-0 ${
                    on ? 'bg-white text-ink shadow-[0_1px_2px_rgb(17_24_32/0.08),0_4px_12px_-6px_rgb(17_24_32/0.2)]' : 'text-slate-600 hover:bg-white/60 hover:text-ink'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${on ? 'text-brand-600' : ''}`} aria-hidden />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
      <Outlet />
    </>
  )
}

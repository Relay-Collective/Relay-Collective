import { MessageSquarePlus } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { VolunteerProvider } from '../../context/VolunteerProvider'
import { useApp } from '../../hooks/useApp'
import { useFeedback } from '../../hooks/useFeedback'
import { useVolunteer } from '../../hooks/useVolunteer'
import { NotificationBell } from '../../modules/careride'
import { initials } from '../../logic/initials'
import { VOLUNTEER_FEEDBACK_NAV, VOLUNTEER_HELP_NAV, volunteerNav, volunteerTabs, volunteerTitle } from '../../volunteer/navigation'
import { identityLabel } from '../../volunteer/workspace'
import { FirstRideInstall } from '../../pwa/Install'
import { volunteerPaths } from '../../volunteer/paths'
import { AccountMenu } from '../AccountMenu'
import { SidebarNav } from '../shell/SidebarNav'
import { ShellHeader } from '../shell/ShellHeader'
import { SidebarShell, type SidebarSlotProps } from '../shell/SidebarShell'
import { AppFooter, LoadErrorBanner, PendingApprovalNotice, RideNotices } from '../ShellNotices'
import { focusRing } from '../workspace/styles'

// A volunteer's signed-in app: their own workspace, adapted to how they take part (src/volunteer/workspace.ts).
// CareRide drivers keep CareRide (transportation) in it; general volunteers have no driving pages.
export function VolunteerShell() {
  return (
    <VolunteerProvider>
      <ShellFrame />
    </VolunteerProvider>
  )
}

function ShellFrame() {
  const { driver } = useVolunteer()
  return (
    <SidebarShell
      storageKey="rc-volunteer-sidebar-collapsed"
      sidebar={(props) => <VolunteerSidebar {...props} />}
      header={(props) => <VolunteerHeader {...props} />}
      banner={
        driver?.status === 'PENDING' && (
          <div className="no-print border-b border-amber-200 bg-sun-50">
            <PendingApprovalNotice isDriver statusLink={volunteerPaths.verification} className="px-4 py-3 sm:px-6 lg:px-8" />
          </div>
        )
      }
      bottomBar={<VolunteerTabBar />}
      footer={<AppFooter />}
    >
      <RideNotices />
      <FirstRideInstall />
      <LoadErrorBanner />
      <Outlet />
    </SidebarShell>
  )
}

function VolunteerSidebar(props: SidebarSlotProps) {
  const { currentUser } = useApp()
  const { workspace, offers } = useVolunteer()
  const { openFeedback, unseenCount } = useFeedback()
  const name = currentUser?.name ?? ''
  return (
    <SidebarNav
      {...props}
      home={{ to: volunteerPaths.overview, label: 'Relay Collective volunteer workspace home' }}
      context={{
        initials: initials(name),
        title: name || 'Your workspace',
        subtitle: identityLabel(workspace),
        className: 'bg-coral-400 text-ink',
      }}
      groups={volunteerNav(workspace)}
      footer={[VOLUNTEER_HELP_NAV, VOLUNTEER_FEEDBACK_NAV]}
      actions={[{ label: 'Send feedback', icon: MessageSquarePlus, onClick: () => openFeedback() }]}
      badges={{
        requests: { count: offers.data?.length ?? 0, label: 'ride requests waiting', tone: 'waiting' },
        feedback: { count: unseenCount, label: 'with new updates', tone: 'waiting' },
      }}
    />
  )
}

// The bar above every page: where you are, and the account menu. Each page still has its own h1.
function VolunteerHeader({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation()
  return (
    <ShellHeader onOpenMenu={onOpenMenu} menuOpen={menuOpen} context="Volunteer workspace" title={volunteerTitle(pathname)}>
      <NotificationBell />
      <AccountMenu />
    </ShellHeader>
  )
}

// Phones: the main places as a tab bar, so the next ride is never more than one tap away
function VolunteerTabBar() {
  const { workspace, offers } = useVolunteer()
  const count = offers.data?.length ?? 0
  return (
    <nav aria-label="Quick">
      <ul className="flex">
        {volunteerTabs(workspace).map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `group/tab relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors duration-150 ease-out-quart ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0 ${
                  isActive ? 'text-ink' : 'text-slate-500 active:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* The current tab is marked by shape as well as colour: a midnight pill behind its icon, as in the sidebar */}
                  <span
                    className={`relative flex h-8 w-[min(3.5rem,100%)] items-center justify-center rounded-full transition-[background-color,scale] duration-200 ease-out-expo group-active/tab:scale-95 ${
                      isActive ? 'bg-ink text-brand-300 shadow-[var(--shadow-press)]' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                    {badge && count > 0 && (
                      <span className="absolute -right-0.5 -top-1 min-w-5 rounded-full bg-sun-400 px-1.5 text-center text-[11px] font-bold leading-5 tabular-nums text-ink ring-2 ring-white" aria-hidden>
                        {count}
                      </span>
                    )}
                  </span>
                  {label}
                  {badge && count > 0 && <span className="sr-only">, {count} waiting</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

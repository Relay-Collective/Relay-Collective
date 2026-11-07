import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { useCurrentOrg } from '../hooks/useCurrent'
import { HOME_FOR } from '../logic/homeFor'
import type { UserRole } from '../types'
import { AccountMenu } from './AccountMenu'
import { Logo } from './Logo'
import { AppFooter, LoadErrorBanner, PendingApprovalNotice, RideNotices } from './ShellNotices'
import type { Tone } from './ui'

type NavLinkItem = { to: string; label: string }

const ACTIVE_NAV: Record<Tone, { soft: string; solid: string }> = {
  brand: { soft: 'bg-brand-50 text-brand-700', solid: 'bg-brand-600 text-white' },
  ink: { soft: 'bg-slate-100 text-ink', solid: 'bg-ink text-white' },
  coral: { soft: 'bg-coral-50 text-coral-700', solid: 'bg-coral-700 text-white' },
  teal: { soft: 'bg-teal-50 text-teal-700', solid: 'bg-teal-700 text-white' },
  amber: { soft: 'bg-sun-100 text-amber-900', solid: 'bg-sun-400 text-ink' },
}

type NavItem = NavLinkItem & { badge?: number }

const PROVIDER_NAV: NavItem[] = [
  { to: '/org/drivers', label: 'Our drivers' },
  { to: '/org/bookings', label: 'Bookings' },
]

// Main links for transport providers. Partner organizations, drivers, and platform admins have their own consoles
// (WorkspaceShell, VolunteerShell, AdminShell).
function useNavLinks(role: UserRole | undefined): NavItem[] {
  return role === 'ORG_ADMIN' ? PROVIDER_NAV : []
}

function Badge({ count, active }: { count?: number; active: boolean }) {
  if (!count) return null
  return (
    <span
      className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
        active ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'
      }`}
    >
      {count}
      <span className="sr-only"> new {count === 1 ? 'request' : 'requests'}</span>
    </span>
  )
}

// The signed-in app for transport providers: header with navigation and account menu.
export function Layout() {
  const { currentUser } = useApp()
  const org = useCurrentOrg()
  const role = currentUser?.role
  const links = useNavLinks(role)

  // Active navigation is electric in every console; the role's own colour stays on its avatar
  const activeNav = ACTIVE_NAV.brand

  const pending = org?.status === 'PENDING'

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white pt-[var(--safe-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" to={role ? HOME_FOR[role] : '/'} />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive ? activeNav.soft : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    <Badge count={l.badge} active={isActive} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <AccountMenu />
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pb-3 sm:px-6 lg:hidden" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? activeNav.solid : 'bg-slate-100 text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  <Badge count={l.badge} active={isActive} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {pending && (
        <div className="no-print border-b border-amber-200 bg-sun-50">
          <PendingApprovalNotice isDriver={false} className="mx-auto max-w-5xl px-4 py-3 sm:px-6" />
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <RideNotices />
        <LoadErrorBanner />
        <Outlet />
      </main>

      <AppFooter className="mx-auto max-w-5xl px-4 pb-10 sm:px-6" />
    </div>
  )
}

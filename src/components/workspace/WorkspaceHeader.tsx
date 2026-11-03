import { CalendarPlus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useWorkspace } from '../../hooks/useWorkspace'
import { workspaceTitle } from '../../workspace/navigation'
import { paths } from '../../workspace/paths'
import { AccountMenu } from '../AccountMenu'
import { ShellHeader } from '../shell/ShellHeader'
import { primaryButton } from '../ui'
import { compactButton, focusRing } from './styles'

// The bar above every workspace page: where you are, for which organization, and the one thing staff do most.
// Each page still has its own h1, so this names the section without repeating it as a heading.
// The booking form, the requests list and the transportation home carry their own "Request a ride", so the bar leaves it out there.
export function WorkspaceHeader({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation()
  const { org } = useWorkspace()
  const showRequest = !pathname.startsWith(paths.newRide) && pathname !== paths.requests && pathname !== paths.transport

  return (
    <ShellHeader
      onOpenMenu={onOpenMenu}
      menuOpen={menuOpen}
      // The organization leads back to the workspace overview, from any module
      context={
        pathname === paths.overview ? (
          (org?.name ?? 'Your organization')
        ) : (
          <Link to={paths.overview} className={`rounded hover:text-rc-navy hover:underline hover:underline-offset-4 ${focusRing}`}>
            {org?.name ?? 'Your organization'}
          </Link>
        )
      }
      title={workspaceTitle(pathname)}
    >
      {showRequest && (
        <Link to={paths.newRide} className={`${primaryButton} ${compactButton} max-sm:px-3.5`}>
          <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
          {/* Phones keep a short visible label: an icon alone hides the main action */}
          <span className="sm:hidden">Request</span>
          <span className="max-sm:hidden">Request a ride</span>
        </Link>
      )}
      <AccountMenu />
    </ShellHeader>
  )
}

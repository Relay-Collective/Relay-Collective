import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { focusRing } from '../../../components/workspace/styles'
import { useApp } from '../../../hooks/useApp'
import { useLoadable } from '../../../hooks/useLoadable'
import { hasCareRideInbox, notificationPath } from '../../../logic/notificationPaths'
import { dataService } from '../../../services'

export function NotificationBell() {
  const { currentUser } = useApp()
  const id = hasCareRideInbox(currentUser?.role) ? currentUser?.id : undefined
  const count = useLoadable(() => id ? dataService.countUnreadNotifications() : Promise.resolve(0), id)
  if (!id) return null
  const unread = count.data ?? 0
  return (
    <Link to={notificationPath(currentUser?.role)}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white text-rc-navy hover:bg-slate-50 active:bg-slate-100 ${focusRing}`}>
      <Bell className="size-5" aria-hidden />
      {unread > 0 && <span aria-hidden className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand-700 px-1 text-center text-xs font-bold leading-5 text-white ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}

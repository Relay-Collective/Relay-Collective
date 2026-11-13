import { useApp } from '../../../hooks/useApp'
import { useLoadable } from '../../../hooks/useLoadable'
import { hasCareRideInbox } from '../../../logic/notificationPaths'
import { dataService } from '../../../services'

export function useInbox(update?: string) {
  const { currentUser } = useApp()
  const id = hasCareRideInbox(currentUser?.role) ? currentUser?.id : undefined
  return useLoadable(() => id ? dataService.loadNotifications(update) : Promise.resolve({ items: [], unread: 0 }), `${id ?? ''}:${update ?? ''}`)
}

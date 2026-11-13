import { ArrowRight, Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { secondaryButton } from '../../../components/ui'
import { PageHeader } from '../../../components/workspace/PageHeader'
import { panel } from '../../../components/workspace/styles'
import { useApp } from '../../../hooks/useApp'
import { formatDayTime } from '../../../logic/formatTime'
import { hasCareRideInbox, notificationPath, notificationRidePath } from '../../../logic/notificationPaths'
import { dataService } from '../../../services'
import { NOTIFICATION_LABELS } from './model'
import { PushSettings } from './PushSettings'
import { useInbox } from './useInbox'

export function NotificationsEntry() {
  const { currentUser } = useApp()
  const { search } = useLocation()
  return <Navigate to={`${notificationPath(currentUser?.role)}${search}`} replace />
}

export function Notifications() {
  const { currentUser, refresh } = useApp()
  const { search } = useLocation()
  const navigate = useNavigate()
  const query = new URLSearchParams(search).get('update') ?? ''
  const update = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(query) ? query : undefined
  const { data, error } = useInbox(update)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  if (!currentUser || !hasCareRideInbox(currentUser.role)) return <Navigate to="/home" replace />
  const { role } = currentUser
  const items = (data?.items ?? []).filter((item) => !unreadOnly || !item.read_at)
  const selected = update ? items.find((item) => item.id === update) : undefined
  const sorted = selected ? [selected, ...items.filter((item) => item !== selected)] : items

  async function mark(id?: string, to?: string) {
    setBusy(true)
    setActionError('')
    try {
      await dataService.markNotificationsRead(id)
      refresh()
      if (to) navigate(to)
    } catch {
      if (to) navigate(to)
      else setActionError('Couldn’t mark your updates as read. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Ride requests and updates from CareRide." />
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className={`${panel} min-w-0`} aria-labelledby="careride-inbox-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 id="careride-inbox-title" className="font-heading text-lg font-bold text-rc-navy">Inbox {data?.unread ? `· ${data.unread} unread` : ''}</h2>
            <button type="button" className={secondaryButton} disabled={busy || !data?.unread} onClick={() => void mark()}>
              <CheckCheck className="size-4" aria-hidden /> Mark all as read
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pt-3 sm:px-5" aria-label="Filter notifications">
            {(['All', 'Unread'] as const).map((filter) => {
              const active = unreadOnly === (filter === 'Unread')
              return <button key={filter} type="button" aria-pressed={active}
                className={`${secondaryButton} ${active ? 'border-brand-700 bg-brand-50' : ''}`}
                onClick={() => setUnreadOnly(filter === 'Unread')}>{filter}</button>
            })}
          </div>
          {error && <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-sm text-red-700">
            {error} <button type="button" className={secondaryButton} onClick={refresh}>Try again</button>
          </div>}
          {actionError && <p role="alert" className="px-4 py-2 text-sm text-red-700">{actionError}</p>}
          {update && data && !data.items.some((item) => item.id === update) && <p className="px-4 pt-3 text-sm text-slate-700">That update isn’t available for this account.</p>}
          {!data && !error && <p role="status" className="p-5 text-sm text-slate-600">Loading updates…</p>}
          {data && sorted.length === 0 && <p className="flex items-center gap-2 p-5 text-sm text-slate-600"><Bell className="size-4" aria-hidden /> {unreadOnly ? 'You’re caught up.' : 'New CareRide updates will appear here.'}</p>}
          {sorted.length > 0 && <ul className="divide-y divide-slate-100">
            {sorted.map((item) => {
              const to = notificationRidePath(role, item)
              return (
                <li key={item.id} className={`px-4 py-2 last:rounded-b-2xl sm:px-5 ${item.id === update ? 'bg-brand-50' : ''}`}>
                  <Link to={to} aria-current={item.id === update ? 'true' : undefined}
                    onClick={(event) => {
                      if (item.read_at || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      if (!busy) void mark(item.id, to)
                    }}
                    className="flex min-h-14 items-center gap-3 rounded-lg py-2 text-sm hover:underline focus-visible:outline-2 focus-visible:outline-brand-700">
                    <span aria-hidden className={`size-2 shrink-0 rounded-full ${item.read_at ? 'bg-slate-200' : 'bg-brand-700'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-rc-navy">{NOTIFICATION_LABELS[item.kind]}</span>
                      <time dateTime={item.created_at} className="block text-xs text-slate-600">{formatDayTime(item.created_at)}</time>
                      {!item.read_at && <span className="sr-only">Unread</span>}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-slate-600" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>}
          {data && data.items.length >= 50 && <p className="p-4 text-xs text-slate-600">Showing the latest 50 updates.</p>}
        </section>
        <PushSettings key={currentUser.id} />
      </div>
    </div>
  )
}

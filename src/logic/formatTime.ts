// Plain, unambiguous dates for staff, drivers, and the printed slip.
// e.g. "Sat, Oct 3, 11:18 AM". No seconds, no numeric dates like 10/3/2026.

const DAY_TIME: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

export function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, DAY_TIME)
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, TIME)
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Weeks start on Sunday, matching the request-hours editor.
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms))
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

// "Today", "Tomorrow", or "Mon, Oct 5".
export function dayLabel(ms: number, now: number): string {
  const days = Math.round((startOfDay(ms) - startOfDay(now)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// "5 min ago", "3 h ago", "2 days ago", or the date for anything older than a week
export function timeAgo(at: string, now: number): string {
  const ms = now - new Date(at).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < HOUR) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`
  const days = Math.floor(ms / DAY)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

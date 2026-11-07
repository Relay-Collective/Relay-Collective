import type { ProductFeedback } from '../types'

// When this person last opened each of their feedback items, so a reply or status change can show as new.
// Kept in this browser only: losing it just means some items show "Updated" once more.

function key(userId: string): string {
  return `careride-seen-feedback:${userId}`
}

export function readSeenFeedback(userId: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? '{}')
    return value && typeof value === 'object' ? (value as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function markFeedbackSeen(userId: string, feedback: Pick<ProductFeedback, 'id' | 'updatedAt'>): Record<string, string> {
  const next = { ...readSeenFeedback(userId), [feedback.id]: feedback.updatedAt }
  try {
    localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    // Ignore: it may show as updated again after a reload
  }
  return next
}

// Something happened after it was sent (a reply, a status change) that this person hasn't opened yet
export function hasUnseenUpdate(feedback: Pick<ProductFeedback, 'id' | 'createdAt' | 'updatedAt'>, seen: Record<string, string>): boolean {
  const since = seen[feedback.id] ?? feedback.createdAt
  return new Date(feedback.updatedAt).getTime() > new Date(since).getTime()
}

import { adminTitle } from '../admin/navigation'
import type { FeedbackWorkspace, ProductFeedbackPriority, ProductFeedbackStatus, ProductFeedbackType, UserRole } from '../types'
import { volunteerTitle } from '../volunteer/navigation'
import { volunteerPaths } from '../volunteer/paths'
import { workspaceTitle } from '../workspace/navigation'

// Feedback & Suggestions: the rules and words shared by the form, both backends and the admin console.
// The database checks the same limits again (supabase/migrations/20261028120000_product_feedback.sql).

export const MAX_TITLE = 150
export const MAX_DESCRIPTION = 5000
export const MAX_MESSAGE = 5000
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const SUBMISSIONS_PER_HOUR = 20
// A screenshot can be added (or retried) for a day after sending
export const ATTACH_WINDOW_HOURS = 24

export const FEEDBACK_TYPES: { id: ProductFeedbackType; label: string; hint: string }[] = [
  { id: 'bug', label: 'Bug report', hint: 'Something broke or behaved unexpectedly' },
  { id: 'feature_request', label: 'Feature request', hint: 'Something you wish Relay Collective could do' },
  { id: 'improvement', label: 'Improvement suggestion', hint: 'Something that works, but could work better' },
  { id: 'release_feedback', label: 'Feedback on an update', hint: 'About something new or changed' },
  { id: 'general', label: 'General feedback', hint: 'Anything else on your mind' },
]

export const TYPE_LABELS = Object.fromEntries(FEEDBACK_TYPES.map((t) => [t.id, t.label])) as Record<ProductFeedbackType, string>

export const STATUS_ORDER: ProductFeedbackStatus[] = ['new', 'under_review', 'planned', 'in_progress', 'resolved', 'closed']

export const STATUS_LABELS: Record<ProductFeedbackStatus, string> = {
  new: 'New',
  under_review: 'Under review',
  planned: 'Planned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

// What each status means to the person who sent the feedback
export const STATUS_MEANINGS: Record<ProductFeedbackStatus, string> = {
  new: 'Received. The team hasn’t looked at it yet.',
  under_review: 'The team is looking into it.',
  planned: 'The team plans to act on it.',
  in_progress: 'The team is working on it.',
  resolved: 'The team has addressed it.',
  closed: 'The team has finished with it.',
}

export const PRIORITY_ORDER: ProductFeedbackPriority[] = ['low', 'medium', 'high', 'critical']

export const PRIORITY_LABELS: Record<ProductFeedbackPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const WORKSPACE_LABELS: Record<FeedbackWorkspace, string> = {
  organization: 'Organization workspace',
  volunteer: 'Volunteer workspace',
  driver: 'Driver (transportation)',
  admin: 'Admin console',
}

export function formatReference(reference: number): string {
  return `FB-${reference}`
}

export const isDone = (status: ProductFeedbackStatus) => status === 'resolved' || status === 'closed'

// ---- The page feedback was sent from

const ID_SEGMENT = /\d|^[0-9a-f-]{20,}$/i

// The current address as something safe to keep: the path only (no query, fragment or origin), and any part
// that could identify a record, a person or a link (anything with a digit, or long) replaced by ":id".
// This app's own route words never contain digits.
export function sanitizeRoute(location: string): string | undefined {
  const path = location.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//')) return undefined
  const cleaned = path
    .split('/')
    .map((segment) => {
      let decoded: string
      try {
        decoded = decodeURIComponent(segment)
      } catch {
        return ':id'
      }
      if (!decoded) return ''
      return ID_SEGMENT.test(decoded) || decoded.length > 40 || !/^[A-Za-z_.-]+$/.test(decoded) ? ':id' : decoded
    })
    .join('/')
  return cleaned.length <= 200 ? cleaned : undefined
}

// "Organization workspace · Transportation", from a sanitized route
export function pageLabel(route: string | undefined): string | undefined {
  if (!route) return undefined
  if (route === '/workspace' || route.startsWith('/workspace/')) return `${WORKSPACE_LABELS.organization} · ${workspaceTitle(route)}`
  if (route === '/volunteer' || route.startsWith('/volunteer/')) return `${WORKSPACE_LABELS.volunteer} · ${volunteerTitle(route)}`
  if (route === '/admin' || route.startsWith('/admin/')) return `${WORKSPACE_LABELS.admin} · ${adminTitle(route)}`
  if (route === '/org' || route.startsWith('/org/')) return 'Transport provider'
  return route
}

// Which workspace the person is in. The backend decides again from their role; drivers on the
// transportation pages are sending feedback about driving. General volunteers are always in the volunteer workspace.
export function workspaceFor(role: UserRole, route: string | undefined): FeedbackWorkspace {
  if (role === 'PLATFORM_ADMIN') return 'admin'
  if (role === 'DRIVER') return route?.startsWith(volunteerPaths.transport) ? 'driver' : 'volunteer'
  if (role === 'VOLUNTEER') return 'volunteer'
  return 'organization'
}

// ---- The form

export interface FeedbackDraft {
  feedbackType?: ProductFeedbackType
  title: string
  description: string
  relatedRelease?: string
}

export type FeedbackErrors = Partial<Record<'feedbackType' | 'title' | 'description', string>>

export const TYPE_REQUIRED = 'Choose what kind of feedback this is.'
export const TITLE_REQUIRED = 'Add a short title.'
export const TITLE_TOO_LONG = `Keep the title to ${MAX_TITLE} characters or fewer.`
export const DESCRIPTION_REQUIRED = 'Tell us a little more in the description.'
export const DESCRIPTION_TOO_LONG = `Keep the description to ${MAX_DESCRIPTION.toLocaleString('en-US')} characters or fewer.`
export const MESSAGE_REQUIRED = 'Write a message first.'
export const MESSAGE_TOO_LONG = `Keep the message to ${MAX_MESSAGE.toLocaleString('en-US')} characters or fewer.`
export const TOO_MANY = 'You’ve sent a lot of feedback in the last hour. Please try again a little later.'
export const ADMINS_ONLY = 'Only Relay Collective admins can manage feedback.'
export const TRIAGE_CONFLICT = 'Another admin changed this feedback a moment ago. Check the latest details, then try again.'
export const ASSIGN_ADMINS_ONLY = 'Feedback can only be assigned to a Relay Collective admin.'

export function validateFeedback(draft: FeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {}
  const title = draft.title.trim()
  const description = draft.description.trim()
  if (!draft.feedbackType || !TYPE_LABELS[draft.feedbackType]) errors.feedbackType = TYPE_REQUIRED
  if (!title) errors.title = TITLE_REQUIRED
  else if (title.length > MAX_TITLE) errors.title = TITLE_TOO_LONG
  if (!description) errors.description = DESCRIPTION_REQUIRED
  else if (description.length > MAX_DESCRIPTION) errors.description = DESCRIPTION_TOO_LONG
  return errors
}

export function isDraftEmpty(draft: FeedbackDraft, hasFile: boolean): boolean {
  return !draft.title.trim() && !draft.description.trim() && !hasFile
}

export function validateMessage(message: string): string | undefined {
  const text = message.trim()
  if (!text) return MESSAGE_REQUIRED
  if (text.length > MAX_MESSAGE) return MESSAGE_TOO_LONG
  return undefined
}

// ---- Screenshots

export type ScreenshotType = (typeof SCREENSHOT_TYPES)[number]

export const SCREENSHOT_WRONG_TYPE = 'Choose a PNG, JPEG or WebP image.'
export const SCREENSHOT_TOO_BIG = 'Choose an image of 5 MB or less.'
export const SCREENSHOT_UNREADABLE = 'That file doesn’t look like a PNG, JPEG or WebP image.'

// The first bytes of each allowed format, so a renamed file of another kind is turned away
export function sniffImageType(bytes: Uint8Array): ScreenshotType | undefined {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b)
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return undefined
}

export function checkScreenshot(file: { type: string; size: number }): string | undefined {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.type)) return SCREENSHOT_WRONG_TYPE
  if (file.size < 1 || file.size > MAX_SCREENSHOT_BYTES) return SCREENSHOT_TOO_BIG
  return undefined
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The display name kept with a screenshot: no folders, no control characters, not too long
export function cleanFileName(name: string, type: ScreenshotType): string {
  // eslint-disable-next-line no-control-regex
  const base = name.replace(/^.*[/\\]/, '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp'
  return (base || `screenshot.${ext}`).slice(0, 120)
}

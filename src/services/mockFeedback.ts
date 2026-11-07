import {
  ADMINS_ONLY,
  ASSIGN_ADMINS_ONLY,
  ATTACH_WINDOW_HOURS,
  checkScreenshot,
  isDone,
  MAX_DESCRIPTION,
  MAX_TITLE,
  PRIORITY_ORDER,
  sanitizeRoute,
  STATUS_ORDER,
  SUBMISSIONS_PER_HOUR,
  TOO_MANY,
  TRIAGE_CONFLICT,
  validateFeedback,
  validateMessage,
} from '../feedback/rules'
import type {
  AdminFeedbackDetail,
  AdminFeedbackRow,
  FeedbackAttachment,
  FeedbackMessage,
  FeedbackStatusChange,
  FeedbackSummary,
  FeedbackVisibility,
  FeedbackWorkspace,
  ProductFeedback,
  ProductFeedbackPriority,
  ProductFeedbackStatus,
  ProductFeedbackThread,
  User,
} from '../types'
import type { FeedbackPage, FeedbackQuery, NewProductFeedback, TriageChange } from './dataService'

// The demo backend's Feedback & Suggestions, following the same rules as the database functions in
// supabase/migrations/20261028120000_product_feedback.sql. Each function gets the demo database and the
// signed-in user, and runs inside mockService's transact (so nothing is saved if it throws).

export interface StoredFeedback extends ProductFeedback {
  clientRequestId: string
  submittedBy: string // User id
  organizationId?: string
  priority?: ProductFeedbackPriority
  assignedTo?: string // User id of a platform admin
}

export interface StoredFeedbackMessage extends FeedbackMessage {
  feedbackId: string
  authorId: string
}

export interface StoredFeedbackAttachment extends FeedbackAttachment {
  feedbackId: string
  uploadedBy: string
  createdAt: string
}

export interface StoredStatusChange extends FeedbackStatusChange {
  feedbackId: string
  changedBy?: string
}

export interface ProductFeedbackStore {
  nextReference: number
  submissions: StoredFeedback[]
  messages: StoredFeedbackMessage[]
  attachments: StoredFeedbackAttachment[]
  history: StoredStatusChange[]
}

export function emptyFeedbackStore(): ProductFeedbackStore {
  return { nextReference: 1001, submissions: [], messages: [], attachments: [], history: [] }
}

interface Db {
  users: User[]
  organizations: { id: string; name: string }[]
  productFeedback: ProductFeedbackStore
}

const RELEASE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const GRANT_MINUTES = 60

function now(): string {
  return new Date().toISOString()
}

function requireAdmin(user: User | undefined, message = 'Only Relay Collective admins can see feedback.'): User {
  if (user?.role !== 'PLATFORM_ADMIN') throw new Error(message)
  return user
}

function publicView({ clientRequestId, submittedBy, organizationId, priority, assignedTo, ...feedback }: StoredFeedback): ProductFeedback {
  void clientRequestId
  void submittedBy
  void organizationId
  void priority
  void assignedTo
  return feedback
}

function recordStatus(db: Db, feedbackId: string, previous: ProductFeedbackStatus | undefined, next: ProductFeedbackStatus, by?: User) {
  db.productFeedback.history.push({
    id: crypto.randomUUID(),
    feedbackId,
    previousStatus: previous,
    newStatus: next,
    changedAt: now(),
    changedBy: by?.id,
  })
}

export function submitFeedback(db: Db, user: User | undefined, input: NewProductFeedback, clientRequestId: string): ProductFeedback {
  if (!user) throw new Error('Please sign in to send feedback.')
  const store = db.productFeedback
  const earlier = store.submissions.find((f) => f.submittedBy === user.id && f.clientRequestId === clientRequestId)
  if (earlier) return publicView(earlier)

  const errors = validateFeedback(input)
  const firstError = errors.feedbackType ?? errors.title ?? errors.description
  if (firstError) throw new Error(firstError)
  const hourAgo = Date.now() - 60 * 60 * 1000
  if (store.submissions.filter((f) => f.submittedBy === user.id && new Date(f.createdAt).getTime() > hourAgo).length >= SUBMISSIONS_PER_HOUR) {
    throw new Error(TOO_MANY)
  }

  const workspace: FeedbackWorkspace =
    // Same as the database: drivers may say it's about driving; volunteers and drivers are otherwise in the volunteer workspace
    user.role === 'PLATFORM_ADMIN'
      ? 'admin'
      : user.role === 'DRIVER' && input.sourceWorkspace === 'driver'
        ? 'driver'
        : user.role === 'DRIVER' || user.role === 'VOLUNTEER'
          ? 'volunteer'
          : 'organization'
  const at = now()
  const stored: StoredFeedback = {
    id: crypto.randomUUID(),
    reference: store.nextReference++,
    clientRequestId,
    submittedBy: user.id,
    organizationId: user.orgId,
    feedbackType: input.feedbackType,
    title: input.title.trim().slice(0, MAX_TITLE),
    description: input.description.trim().slice(0, MAX_DESCRIPTION),
    sourcePage: input.sourcePage ? sanitizeRoute(input.sourcePage) : undefined,
    sourceWorkspace: workspace,
    relatedRelease: input.feedbackType === 'release_feedback' && input.relatedRelease && RELEASE.test(input.relatedRelease) ? input.relatedRelease : undefined,
    status: 'new',
    createdAt: at,
    updatedAt: at,
  }
  store.submissions.push(stored)
  recordStatus(db, stored.id, undefined, 'new', user)
  return publicView(stored)
}

// The upload grant: where the file goes. Same checks as begin_feedback_attachment.
export function beginAttachment(db: Db, user: User | undefined, feedbackId: string, file: { type: string; size: number }, fileName: string): StoredFeedbackAttachment {
  const feedback = db.productFeedback.submissions.find((f) => f.id === feedbackId)
  if (!user || !feedback || feedback.submittedBy !== user.id) throw new Error('You can only add a screenshot to your own feedback.')
  if (Date.now() - new Date(feedback.createdAt).getTime() > ATTACH_WINDOW_HOURS * 60 * 60 * 1000) {
    throw new Error('Screenshots can only be added within a day of sending feedback.')
  }
  const problem = checkScreenshot(file)
  if (problem) throw new Error(problem)
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'
  const existing = db.productFeedback.attachments.find((a) => a.feedbackId === feedbackId)
  if (existing?.uploadedAt) throw new Error('This feedback already has a screenshot.')
  const grant: StoredFeedbackAttachment = {
    id: existing?.id ?? crypto.randomUUID(),
    feedbackId,
    uploadedBy: user.id,
    storagePath: existing && existing.mimeType === file.type ? existing.storagePath : `${feedbackId}/${crypto.randomUUID()}.${ext}`,
    fileName: fileName.replace(/^.*[/\\]/, '').slice(0, 120) || `screenshot.${ext}`,
    mimeType: file.type,
    fileSize: file.size,
    createdAt: now(),
  }
  db.productFeedback.attachments = [...db.productFeedback.attachments.filter((a) => a !== existing), grant]
  return grant
}

export function confirmAttachment(db: Db, user: User | undefined, attachmentId: string): FeedbackAttachment {
  const grant = db.productFeedback.attachments.find((a) => a.id === attachmentId)
  if (!user || !grant || grant.uploadedBy !== user.id) throw new Error('You can only add a screenshot to your own feedback.')
  if (!grant.uploadedAt && Date.now() - new Date(grant.createdAt).getTime() > GRANT_MINUTES * 60 * 1000) {
    throw new Error('The screenshot hasn’t finished uploading. Please try again.')
  }
  grant.uploadedAt ??= now()
  return attachmentView(grant)
}

function attachmentView({ id, storagePath, fileName, mimeType, fileSize, uploadedAt }: StoredFeedbackAttachment): FeedbackAttachment {
  return { id, storagePath, fileName, mimeType, fileSize, uploadedAt }
}

// Who may see a screenshot: its submitter and platform admins
export function canReadAttachment(db: Db, user: User | undefined, storagePath: string): boolean {
  const attachment = db.productFeedback.attachments.find((a) => a.storagePath === storagePath && a.uploadedAt)
  const feedback = attachment && db.productFeedback.submissions.find((f) => f.id === attachment.feedbackId)
  return !!feedback && (user?.role === 'PLATFORM_ADMIN' || feedback.submittedBy === user?.id)
}

export function listMine(db: Db, user: User | undefined): ProductFeedback[] {
  if (!user) return []
  return db.productFeedback.submissions
    .filter((f) => f.submittedBy === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicView)
}

export function getMine(db: Db, user: User | undefined, feedbackId: string): ProductFeedbackThread | undefined {
  const store = db.productFeedback
  const feedback = store.submissions.find((f) => f.id === feedbackId && !!user && f.submittedBy === user.id)
  if (!feedback) return undefined
  const attachment = store.attachments.find((a) => a.feedbackId === feedbackId && a.uploadedAt)
  return {
    feedback: publicView(feedback),
    // Never internal notes, and never who wrote a reply or changed a status
    messages: store.messages
      .filter((m) => m.feedbackId === feedbackId && m.visibility === 'public')
      .map(({ id, message, visibility, createdAt }) => ({ id, message, visibility, createdAt })),
    history: store.history
      .filter((h) => h.feedbackId === feedbackId)
      .map(({ id, previousStatus, newStatus, changedAt }) => ({ id, previousStatus, newStatus, changedAt })),
    attachment: attachment && attachmentView(attachment),
  }
}

// ---- Platform admins

export function summary(db: Db, user: User | undefined): FeedbackSummary {
  requireAdmin(user)
  const all = db.productFeedback.submissions
  const count = (s: ProductFeedbackStatus) => all.filter((f) => f.status === s).length
  return {
    total: all.length,
    new: count('new'),
    underReview: count('under_review'),
    planned: count('planned'),
    inProgress: count('in_progress'),
    resolved: count('resolved'),
    closed: count('closed'),
  }
}

function person(db: Db, id: string | undefined) {
  const user = id ? db.users.find((u) => u.id === id) : undefined
  return user && { id: user.id, name: user.name }
}

function adminRow(db: Db, f: StoredFeedback): AdminFeedbackRow {
  const { description, ...rest } = publicView(f)
  void description
  const submitter = db.users.find((u) => u.id === f.submittedBy)
  const org = f.organizationId ? db.organizations.find((o) => o.id === f.organizationId) : undefined
  return {
    ...rest,
    priority: f.priority,
    // A deleted demo account leaves its feedback behind, like a deactivated profile does
    submittedBy: { id: f.submittedBy, name: submitter?.name ?? 'Closed account', active: !!submitter },
    organization: org && { id: org.id, name: org.name },
    assignedTo: person(db, f.assignedTo),
    hasAttachment: db.productFeedback.attachments.some((a) => a.feedbackId === f.id && !!a.uploadedAt),
  }
}

export function list(db: Db, user: User | undefined, { limit, offset, ...q }: FeedbackQuery): FeedbackPage {
  requireAdmin(user)
  const search = q.search?.trim().toLowerCase()
  const reference = search?.match(/^(fb-?)?(\d{1,15})$/i)?.[2]
  const from = q.from ? new Date(`${q.from}T00:00:00`).getTime() : undefined
  const to = q.to ? new Date(`${q.to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000 : undefined
  const matching = db.productFeedback.submissions
    .filter(
      (f) =>
        (!q.type || f.feedbackType === q.type) &&
        (!q.status || f.status === q.status) &&
        (!q.priority || (q.priority === 'none' ? !f.priority : f.priority === q.priority)) &&
        (!q.workspace || f.sourceWorkspace === q.workspace) &&
        (!q.organizationId || f.organizationId === q.organizationId) &&
        (!q.release || f.relatedRelease === q.release) &&
        (from === undefined || new Date(f.createdAt).getTime() >= from) &&
        (to === undefined || new Date(f.createdAt).getTime() < to) &&
        (!search ||
          String(f.reference) === reference ||
          f.title.toLowerCase().includes(search) ||
          f.description.toLowerCase().includes(search)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.reference - a.reference)
  return { total: matching.length, rows: matching.slice(offset, offset + limit).map((f) => adminRow(db, f)) }
}

export function detail(db: Db, user: User | undefined, feedbackId: string): AdminFeedbackDetail | undefined {
  requireAdmin(user)
  const f = db.productFeedback.submissions.find((x) => x.id === feedbackId)
  if (!f) return undefined
  const { hasAttachment, ...row } = adminRow(db, f)
  void hasAttachment
  const submitter = db.users.find((u) => u.id === f.submittedBy)
  const attachment = db.productFeedback.attachments.find((a) => a.feedbackId === f.id)
  return {
    ...row,
    description: f.description,
    submittedBy: { ...row.submittedBy, role: submitter?.role ?? 'PARTNER', email: submitter?.email },
    attachment: attachment && attachmentView(attachment),
    messages: db.productFeedback.messages
      .filter((m) => m.feedbackId === f.id)
      .map(({ id, message, visibility, createdAt, authorId }) => ({ id, message, visibility, createdAt, authorName: person(db, authorId)?.name })),
    history: db.productFeedback.history
      .filter((h) => h.feedbackId === f.id)
      .map(({ id, previousStatus, newStatus, changedAt, changedBy }) => ({ id, previousStatus, newStatus, changedAt, changedByName: person(db, changedBy)?.name })),
  }
}

export function assignees(db: Db, user: User | undefined) {
  requireAdmin(user, ADMINS_ONLY)
  return db.users.filter((u) => u.role === 'PLATFORM_ADMIN').map((u) => ({ id: u.id, name: u.name }))
}

export function updateTriage(db: Db, user: User | undefined, feedbackId: string, change: TriageChange): void {
  const admin = requireAdmin(user, ADMINS_ONLY)
  const f = db.productFeedback.submissions.find((x) => x.id === feedbackId)
  if (!f) throw new Error('Feedback not found.')
  const at = now()
  if (change.field === 'status') {
    if (!STATUS_ORDER.includes(change.value)) throw new Error('Choose a status.')
    if (f.status !== change.expected) throw new Error(TRIAGE_CONFLICT)
    if (f.status === change.value) return
    const previous = f.status
    if (isDone(change.value) && !isDone(previous)) f.resolvedAt = at
    else if (!isDone(change.value)) f.resolvedAt = undefined
    f.status = change.value
    recordStatus(db, f.id, previous, change.value, admin)
  } else if (change.field === 'priority') {
    if (change.value && !PRIORITY_ORDER.includes(change.value)) throw new Error('Choose a priority.')
    if (f.priority !== change.expected) throw new Error(TRIAGE_CONFLICT)
    if (f.priority === change.value) return
    f.priority = change.value
  } else {
    if (change.value && db.users.find((u) => u.id === change.value)?.role !== 'PLATFORM_ADMIN') throw new Error(ASSIGN_ADMINS_ONLY)
    if (f.assignedTo !== change.expected) throw new Error(TRIAGE_CONFLICT)
    if (f.assignedTo === change.value) return
    f.assignedTo = change.value
  }
  f.updatedAt = at
}

export function addMessage(db: Db, user: User | undefined, feedbackId: string, message: string, visibility: FeedbackVisibility): void {
  const admin = requireAdmin(user, 'Only Relay Collective admins can reply to feedback.')
  if (visibility !== 'public' && visibility !== 'internal') throw new Error('Choose who can see this message.')
  const problem = validateMessage(message)
  if (problem) throw new Error(problem)
  const f = db.productFeedback.submissions.find((x) => x.id === feedbackId)
  if (!f) throw new Error('Feedback not found.')
  const at = now()
  db.productFeedback.messages.push({ id: crypto.randomUUID(), feedbackId, authorId: admin.id, message: message.trim(), visibility, createdAt: at })
  if (visibility === 'public') f.updatedAt = at
}

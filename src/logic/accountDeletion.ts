import type {
  AccountDeletionAction,
  AccountDeletionBlocker,
  AccountDeletionCategory,
  AccountDeletionCategoryKey,
  AccountDeletionErrorCode,
  AccountDeletionJob,
  AccountDeletionStep,
} from '../types'

// Words for permanent account deletion. The backend decides what happens and counts it
// (supabase/migrations/20261029150000_account_deletion.sql, and the mock); this says it to the admin.

export const DELETED_NAME = 'Deleted account'

// What the admin types to confirm: the account's sign-in email, ignoring case and spaces around it
export function emailMatches(typed: string, email: string | undefined): boolean {
  return !!email && typed.trim().toLowerCase() === email.trim().toLowerCase()
}

export const CATEGORY_LABELS: Record<AccountDeletionCategoryKey, string> = {
  auth_account: 'Supabase sign-in account',
  profile: 'Profile: name, phone and email',
  volunteer_profile: 'Volunteer profile and volunteering interests',
  organization_membership: 'Organization membership',
  driver_profile: 'Driver profile: vehicle, cities and hours',
  driver_documents: 'Driver verification documents',
  open_rides: 'Open rides they were driving or offered',
  product_feedback: 'Feedback & Suggestions they sent',
  personal_files: 'Uploaded files (screenshots, documents)',
  feedback_assignments: 'Feedback assigned to them',
  feedback_replies: 'Replies they wrote on others’ feedback',
  join_requests: 'Requests to join organizations',
  invitations: 'Invitations sent to their email',
  ride_issue_reports: 'Issues they flagged on rides',
  rides_requested: 'Rides they booked for their organization',
  rides_driven: 'Rides they drove',
  ride_ratings: 'Ratings they gave rides for their organization',
  ride_history: 'Ride history lines they signed',
  organization_applications: 'Organization applications they submitted',
  preferences: 'Notification and display preferences',
  deletion_record: 'Record of this deletion',
}

export const ACTION_LABELS: Record<AccountDeletionAction, string> = {
  delete: 'Permanently delete',
  anonymize: 'Anonymize',
  remove: 'Remove',
  detach: 'Unassign',
  reassign: 'Send to other drivers',
  retain: 'Keep',
  none: 'Nothing stored',
}

// The why behind keeping or anonymizing, shown under the row
export const CATEGORY_NOTES: Partial<Record<AccountDeletionCategoryKey, string>> = {
  profile: `Shown as “${DELETED_NAME}” where shared records still point to it, and removed entirely when nothing does.`,
  volunteer_profile: 'Deleted with the interests they chose.',
  organization_membership: 'The organization and everyone else in it stay.',
  driver_profile: 'Kept only as an anonymous placeholder while finished rides point to it.',
  open_rides: 'Upcoming rides they accepted, and requests waiting on them, go to the next driver.',
  product_feedback: 'Deleted with their replies, history and screenshots, since the text may describe them.',
  feedback_replies: `The organization’s support history. The author shows as “${DELETED_NAME}”.`,
  rides_requested: `The organization’s records. The booker shows as “${DELETED_NAME}”.`,
  rides_driven: `Kept for the organizations they served. The driver shows as “${DELETED_NAME}”.`,
  ride_ratings: 'The organization’s rating of a ride, not about the person.',
  ride_history: `Each line still says what happened; the name becomes “${DELETED_NAME}”.`,
  organization_applications: 'The organization’s record. Update the organization’s contact details if they name this person.',
  preferences: 'Kept only on the person’s own device, never by Relay Collective.',
  deletion_record: 'Who deleted the account and when, without the person’s name or email.',
}

// Always shown, so the admin sees the account itself is covered; the rest only when there's something to act on
const ALWAYS_SHOWN: AccountDeletionCategoryKey[] = ['auth_account', 'profile', 'preferences', 'deletion_record']

export function shownCategories(categories: AccountDeletionCategory[]): AccountDeletionCategory[] {
  return categories.filter((c) => c.count > 0 || ALWAYS_SHOWN.includes(c.key))
}

// Same words as the database's refusals in admin_begin_account_deletion
export const BLOCKER_MESSAGES: Record<AccountDeletionBlocker, string> = {
  SELF: 'You can’t delete the account you’re signed in with.',
  LAST_PLATFORM_ADMIN: 'This is the only Relay Collective admin account, so it can’t be deleted.',
  LAST_ORG_ADMIN: 'This person is their organization’s only administrator. Make another member an administrator first.',
  ORG_OPEN_RIDES: 'This is the last member of their organization, and it still has open rides. Cancel them first.',
  LAST_PROVIDER_ADMIN: 'This person is the only administrator of a transport provider with active drivers.',
  DRIVER_ON_TRIP: 'This driver has a client in the car right now. Try again once the ride is finished.',
  NO_SIGN_IN_EMAIL: 'This account has no sign-in email to confirm, so it can’t be deleted here.',
}

export const STEP_LABELS: Record<AccountDeletionStep, string> = {
  storage: 'Removing their files',
  records: 'Erasing their records',
  auth: 'Deleting their sign-in',
  verify: 'Checking nothing personal is left',
  done: 'Done',
}

export const STEP_ORDER: AccountDeletionStep[] = ['storage', 'records', 'auth', 'verify']

// What went wrong and what to do about it, without internals
export const ERROR_GUIDANCE: Record<AccountDeletionErrorCode, string> = {
  STORAGE_DELETE_FAILED: 'Storage didn’t remove all of their files. Nothing else has been erased yet. Try again in a few minutes.',
  RECORDS_CLEANUP_FAILED:
    'Their records couldn’t be erased, so none were changed. Try again; if it keeps happening, ask a developer to check the database log for this deletion.',
  AUTH_DELETE_FAILED:
    'Their records are erased, but Supabase didn’t delete their sign-in. They still can’t use Relay Collective. Try again in a few minutes.',
  VERIFICATION_FAILED:
    'Something personal was still there after every step ran. Try again; if it keeps happening, ask a developer to check this deletion.',
  INTERRUPTED: 'The deletion stopped part-way, for example on a dropped connection. Try again to carry on from where it stopped.',
}

export function isOpen(job: Pick<AccountDeletionJob, 'status'> | undefined): boolean {
  return !!job && job.status !== 'completed'
}

// The backend lets another attempt take over a running job nobody has touched for a minute
export const STALLED_AFTER_MS = 60_000

// Failed, or started and then left (the request that was running it was cut off)
export function needsRetry(job: Pick<AccountDeletionJob, 'status' | 'updatedAt'> | undefined, now = Date.now()): boolean {
  if (!job) return false
  if (job.status === 'failed' || job.status === 'requires_attention') return true
  return (job.status === 'pending' || job.status === 'in_progress') && now - new Date(job.updatedAt).getTime() > STALLED_AFTER_MS
}

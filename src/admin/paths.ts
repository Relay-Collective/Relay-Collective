// Every address in the platform admin console, in one place.
export type ReviewKind = 'organizations' | 'drivers'

const ROOT = '/admin'

export const adminPaths = {
  overview: ROOT,
  organizations: `${ROOT}/organizations`,
  organization: (id: string) => `${ROOT}/organizations/${id}`,
  users: `${ROOT}/users`,
  user: (id: string) => `${ROOT}/users/${id}`,
  approvals: `${ROOT}/approvals`,
  review: (kind: ReviewKind, id: string) => `${ROOT}/approvals/${kind}/${id}`,
  services: `${ROOT}/services`,
  transportation: `${ROOT}/transportation`,
  ride: (id: string) => `${ROOT}/transportation/rides/${id}`,
  activity: `${ROOT}/activity`,
  issues: `${ROOT}/issues`,
  feedback: `${ROOT}/feedback`,
  feedbackItem: (id: string) => `${ROOT}/feedback/${encodeURIComponent(id)}`,
  settings: `${ROOT}/settings`,
  search: `${ROOT}/search`,
} as const

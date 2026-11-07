import type { JoinRequestStatus, MembershipStatus, OrgRole, OrganizationDirectoryEntry } from '../types'

// Rules for organization membership shared by the screens and the demo backend.
// The database functions in supabase/migrations/20261029120000_organization_membership.sql enforce the same.

export const MIN_SEARCH_LENGTH = 2
export const SEARCH_RESULT_LIMIT = 8

export const ORG_ROLES: { value: OrgRole; label: string; description: string; can: string[] }[] = [
  {
    value: 'STAFF',
    label: 'Staff',
    description: 'Uses your organization’s services.',
    can: ['Request and track rides for the people you serve', 'Manage saved destinations', 'See who is on the team'],
  },
  {
    value: 'ADMIN',
    label: 'Administrator',
    description: 'Everything staff can do, and manages the team.',
    can: [
      'Everything staff can do',
      'Approve or decline requests to join',
      'Invite, change roles and remove members',
      'Choose whether people can find your organization',
    ],
  },
]

export function roleLabel(role: OrgRole): string {
  return ORG_ROLES.find((r) => r.value === role)?.label ?? role
}

// Descriptive only: what someone says they do. It never picks their role.
export const POSITION_SUGGESTIONS = ['Case Worker', 'Program Coordinator', 'Volunteer Coordinator', 'Administrative Staff']

export const REQUEST_STATUS_LABEL: Record<JoinRequestStatus, string> = {
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Not approved',
  cancelled: 'Withdrawn',
}

export const MEMBER_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: 'Active',
  removed: 'Removed',
  closed: 'Account closed',
}

// Whitespace squeezed, trimmed, and capped, the way the database reads a search
export function normalizeSearch(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function canSearch(query: string): boolean {
  return normalizeSearch(query).length >= MIN_SEARCH_LENGTH
}

// Names containing the search, those starting with it first, then alphabetically
export function rankDirectory<T extends Pick<OrganizationDirectoryEntry, 'name'>>(entries: T[], query: string, limit = SEARCH_RESULT_LIMIT): T[] {
  const q = normalizeSearch(query).toLowerCase()
  if (q.length < MIN_SEARCH_LENGTH) return []
  return entries
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const starts = Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q))
      return starts || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
    .slice(0, limit)
}

// The parts of a name that match the search, for highlighting in results
export function highlightParts(name: string, query: string): { text: string; match: boolean }[] {
  const q = normalizeSearch(query).toLowerCase()
  const at = q ? name.toLowerCase().indexOf(q) : -1
  if (at < 0) return [{ text: name, match: false }]
  return [
    { text: name.slice(0, at), match: false },
    { text: name.slice(at, at + q.length), match: true },
    { text: name.slice(at + q.length), match: false },
  ].filter((p) => p.text)
}

// Trimmed, or undefined when empty
export function optionalText(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v ? v : undefined
}

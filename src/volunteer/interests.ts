import type { VolunteerInterest } from '../types'

// Volunteering interests: every kind, its words, and what it means today, in one place.
// The database accepts exactly these codes (supabase/migrations/20261104120100_general_volunteers.sql);
// adding one takes a migration as well as an entry here.
//
// An interest is something a volunteer would like to do. It is never permission to do it: choosing
// Transportation doesn't make anyone a CareRide driver, and no other interest opens a service.

export interface InterestDefinition {
  id: VolunteerInterest
  label: string
  description: string
  // Where this kind of help happens on Relay Collective today, if anywhere. Only CareRide is running, and
  // driving for it is its own enrollment and verification.
  availability: string
  operational: boolean // a Relay Collective service exists for it today (it still needs its own enrollment)
}

export const VOLUNTEER_INTERESTS: InterestDefinition[] = [
  {
    id: 'TRANSPORTATION',
    label: 'Transportation',
    description: 'Helping people get to appointments and services through CareRide.',
    availability: 'CareRide is running. Driving for it is a separate enrollment, with verification by the Relay Collective team.',
    operational: true,
  },
  {
    id: 'FOOD_DISTRIBUTION',
    label: 'Food distribution',
    description: 'Helping distribute food or prepare community meals.',
    availability: 'Not on Relay Collective yet. We’ve saved your interest.',
    operational: false,
  },
  {
    id: 'COMMUNITY_OUTREACH',
    label: 'Community outreach',
    description: 'Supporting community engagement, events, and outreach.',
    availability: 'Not on Relay Collective yet. We’ve saved your interest.',
    operational: false,
  },
  {
    id: 'RESOURCE_COORDINATION',
    label: 'Resource coordination',
    description: 'Helping organize donations, supplies, and community resources.',
    availability: 'Not on Relay Collective yet. We’ve saved your interest.',
    operational: false,
  },
  {
    id: 'GENERAL',
    label: 'General volunteering',
    description: 'Open to different opportunities as they come up.',
    availability: 'We’ve saved your interest for when more opportunities arrive.',
    operational: false,
  },
]

const BY_ID = new Map(VOLUNTEER_INTERESTS.map((d) => [d.id, d]))

export function isVolunteerInterest(value: unknown): value is VolunteerInterest {
  return typeof value === 'string' && BY_ID.has(value as VolunteerInterest)
}

export function interestDefinition(id: VolunteerInterest): InterestDefinition {
  return BY_ID.get(id)!
}

export function interestLabel(id: VolunteerInterest): string {
  return interestDefinition(id).label
}

// Known interests only, each once, in the order above. Anything else is dropped.
export function normalizeInterests(values: readonly unknown[]): VolunteerInterest[] {
  const chosen = new Set(values.filter(isVolunteerInterest))
  return VOLUNTEER_INTERESTS.map((d) => d.id).filter((id) => chosen.has(id))
}

// Adds the interest if it isn't chosen, removes it if it is
export function toggleInterest(current: readonly VolunteerInterest[], id: VolunteerInterest): VolunteerInterest[] {
  return normalizeInterests(current.includes(id) ? current.filter((i) => i !== id) : [...current, id])
}

export const INTERESTS_REQUIRED = 'Choose at least one way you’d like to help.'
export const INTEREST_UNKNOWN = 'One of those volunteering interests isn’t one we offer. Please choose again.'

// Why this list can't be saved, in the backend's words, or undefined when it can
export function interestsError(values: readonly unknown[]): string | undefined {
  if (values.some((v) => !isVolunteerInterest(v))) return INTEREST_UNKNOWN
  if (!values.length) return INTERESTS_REQUIRED
  return undefined
}

export function sameInterests(a: readonly VolunteerInterest[], b: readonly VolunteerInterest[]): boolean {
  const x = normalizeInterests(a)
  const y = normalizeInterests(b)
  return x.length === y.length && x.every((id, i) => id === y[i])
}

import type { FieldErrors } from '../components/driverDraft'
import { EMAIL, MAX_NAME, isPhone, tooLong } from '../logic/validate'
import type { NewOrganizationApplication } from '../services/dataService'
import type { Identity, OrgKind, PlatformInterest, ServiceCategory } from '../types'

// Form state for registering a partner organization, one step at a time.
export interface OrganizationDraft {
  orgName: string
  kind?: OrgKind
  address: string
  city: string
  placeId?: string // set once an address is picked from the list
  website: string
  description: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactRole: string
  serviceCategories: ServiceCategory[]
  platformInterests: PlatformInterest[]
  acknowledged: boolean
}

export const MAX_DESCRIPTION = 1000

// What we already know about the person goes in up front: they're usually the contact.
export function emptyOrganizationDraft(identity: Identity): OrganizationDraft {
  return {
    orgName: '',
    address: '',
    city: '',
    website: '',
    description: '',
    contactName: identity.name,
    contactEmail: identity.email,
    contactPhone: '',
    contactRole: '',
    serviceCategories: [],
    // The one capability that exists today; planned ones are opt-in signals only
    platformInterests: ['TRANSPORTATION'],
    acknowledged: false,
  }
}

function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

// "example.org" is fine to type; the backend stores a full https:// address
export function normalizeWebsite(value: string): string {
  const v = value.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

const WEBSITE = /^https?:\/\/[^\s/]+\.[^\s]+$/i

export function validateIdentity(d: OrganizationDraft): FieldErrors {
  return compact({
    orgName: d.orgName.trim() ? tooLong(d.orgName, MAX_NAME) : 'Enter your organization’s name.',
    kind: d.kind ? undefined : 'Choose the option that describes your organization best.',
    address: d.placeId ? undefined : d.address.trim() ? 'Pick a matching address from the list.' : 'Search for your address and pick it from the list.',
    website: !d.website.trim() || WEBSITE.test(normalizeWebsite(d.website)) ? undefined : 'Check the website address, e.g. example.org.',
    description: !d.description.trim()
      ? 'Add a sentence or two about what your organization does.'
      : d.description.trim().length > MAX_DESCRIPTION
        ? `Keep it under ${MAX_DESCRIPTION} characters.`
        : undefined,
  })
}

export function validateContact(d: OrganizationDraft): FieldErrors {
  return compact({
    contactName: d.contactName.trim() ? tooLong(d.contactName, MAX_NAME) : 'Enter who we should contact.',
    contactEmail: !d.contactEmail.trim() ? 'Enter a contact email.' : EMAIL.test(d.contactEmail.trim()) ? undefined : 'That email doesn’t look right. Check for typos.',
    contactPhone: isPhone(d.contactPhone) ? undefined : 'Enter a 10-digit phone number.',
    contactRole: d.contactRole.trim() ? tooLong(d.contactRole, 120) : 'Tell us your role, e.g. Program coordinator.',
  })
}

export function validateServices(d: OrganizationDraft): FieldErrors {
  return compact({ serviceCategories: d.serviceCategories.length ? undefined : 'Choose at least one.' })
}

export function validateInterests(): FieldErrors {
  return {} // all optional
}

export function validateReview(d: OrganizationDraft): FieldErrors {
  return compact({ acknowledged: d.acknowledged ? undefined : 'Please confirm to submit your application.' })
}

export function toApplication(d: OrganizationDraft): NewOrganizationApplication {
  return {
    orgName: d.orgName.trim(),
    kind: d.kind ?? 'OTHER',
    website: normalizeWebsite(d.website) || undefined,
    description: d.description.trim(),
    address: d.address.trim(),
    city: d.city,
    contactName: d.contactName.trim(),
    contactEmail: d.contactEmail.trim(),
    contactPhone: d.contactPhone.trim(),
    contactRole: d.contactRole.trim(),
    serviceCategories: d.serviceCategories,
    platformInterests: d.platformInterests,
  }
}

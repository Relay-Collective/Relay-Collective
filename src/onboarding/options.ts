import {
  Apple,
  BarChart3,
  Briefcase,
  Bus,
  HandHeart,
  HeartPulse,
  Home,
  Megaphone,
  Package,
  Share2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { OrgKind, PlatformInterest, ServiceCategory } from '../types'

// What an organization can say about itself during onboarding. Descriptive only: nothing here
// changes what an account can do. Access comes from approval and membership, decided by the backend.

export const ORG_KINDS: { value: OrgKind; label: string; description: string }[] = [
  { value: 'NONPROFIT', label: 'Registered nonprofit or charity', description: 'Incorporated, with charitable or nonprofit status.' },
  { value: 'COMMUNITY_GROUP', label: 'Community organization', description: 'A grassroots group, collective, or mutual aid network.' },
  { value: 'FAITH_BASED', label: 'Faith-based organization', description: 'A congregation or faith group serving the community.' },
  { value: 'PUBLIC_AGENCY', label: 'Public or health agency', description: 'A government, health authority, or public service program.' },
  { value: 'OTHER', label: 'Something else', description: 'Tell us more in the description.' },
]

export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string; icon: LucideIcon }[] = [
  { value: 'HOUSING', label: 'Housing and shelter', icon: Home },
  { value: 'FOOD', label: 'Food security', icon: Apple },
  { value: 'HEALTH', label: 'Healthcare access', icon: HeartPulse },
  { value: 'TRANSPORTATION', label: 'Transportation assistance', icon: Bus },
  { value: 'OUTREACH', label: 'Community outreach', icon: Megaphone },
  { value: 'EMPLOYMENT', label: 'Employment support', icon: Briefcase },
  { value: 'OTHER', label: 'Other community services', icon: HandHeart },
]

export type Availability = 'live' | 'planned'

export const PLATFORM_INTERESTS: { value: PlatformInterest; label: string; description: string; icon: LucideIcon; availability: Availability }[] = [
  {
    value: 'TRANSPORTATION',
    label: 'Transportation coordination',
    description: 'Book free rides for the people you serve, with vetted volunteer drivers.',
    icon: Bus,
    availability: 'live',
  },
  {
    value: 'VOLUNTEERS',
    label: 'Volunteer coordination',
    description: 'Share volunteers and schedules across organizations.',
    icon: Users,
    availability: 'planned',
  },
  {
    value: 'RESOURCES',
    label: 'Resource sharing',
    description: 'Lend and borrow supplies, space, and equipment.',
    icon: Package,
    availability: 'planned',
  },
  {
    value: 'REFERRALS',
    label: 'Partner referrals',
    description: 'Connect the people you serve with partner services.',
    icon: Share2,
    availability: 'planned',
  },
  {
    value: 'REPORTING',
    label: 'Impact reporting',
    description: 'See and share the difference your work makes.',
    icon: BarChart3,
    availability: 'planned',
  },
]

export const AVAILABILITY_LABEL: Record<Availability, string> = { live: 'Available now', planned: 'Planned' }

export function labelOf<T extends string>(list: { value: T; label: string }[], value: T): string {
  return list.find((o) => o.value === value)?.label ?? value
}

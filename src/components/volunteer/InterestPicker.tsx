import { Apple, Car, HandHeart, Megaphone, Package, type LucideIcon } from 'lucide-react'
import { CheckCard } from '../onboarding/CheckCard'
import { FieldMessage } from '../form/FieldMessage'
import { label as labelClass } from '../ui'
import type { VolunteerInterest } from '../../types'
import { toggleInterest, VOLUNTEER_INTERESTS } from '../../volunteer/interests'

const ICONS: Record<VolunteerInterest, LucideIcon> = {
  TRANSPORTATION: Car,
  FOOD_DISTRIBUTION: Apple,
  COMMUNITY_OUTREACH: Megaphone,
  RESOURCE_COORDINATION: Package,
  GENERAL: HandHeart,
}

export function InterestIcon({ interest, className = 'h-5 w-5' }: { interest: VolunteerInterest; className?: string }) {
  const Icon = ICONS[interest]
  return <Icon className={className} aria-hidden />
}

// "How would you like to help?" One checkbox card per interest; any number can be chosen.
// Choosing one records an interest, nothing more: the description under each says so where it matters.
export function InterestPicker({
  value,
  onChange,
  error,
  disabled,
  legend = 'How would you like to help?',
  showLegend = true,
}: {
  value: VolunteerInterest[]
  onChange: (next: VolunteerInterest[]) => void
  error?: string
  disabled?: boolean
  legend?: string
  showLegend?: boolean
}) {
  return (
    <fieldset aria-describedby="interests-message" disabled={disabled}>
      <legend className={showLegend ? labelClass : 'sr-only'}>{legend}</legend>
      <p className="mb-3 text-sm text-slate-600">Choose as many as you like.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {VOLUNTEER_INTERESTS.map((d) => (
          <CheckCard
            key={d.id}
            checked={value.includes(d.id)}
            onChange={() => onChange(toggleInterest(value, d.id))}
            title={d.label}
            description={d.description}
            icon={<InterestIcon interest={d.id} />}
          />
        ))}
      </div>
      <FieldMessage id="interests-message" error={error} />
    </fieldset>
  )
}

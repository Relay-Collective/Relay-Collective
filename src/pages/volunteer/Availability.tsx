import { CalendarClock, Info, MapPin, ShieldOff } from 'lucide-react'
import { DriverCityFields } from '../../components/DriverFields'
import type { DriverDraft } from '../../components/driverDraft'
import { RequestHoursEditor } from '../../components/RequestHoursEditor'
import { RequestStatusCard } from '../../components/RequestStatusCard'
import { SaveBar } from '../../components/volunteer/SaveBar'
import { SettingsSection as Section } from '../../components/volunteer/SettingsSection'
import { RestrictedState } from '../../components/volunteer/states'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SkeletonRows } from '../../components/workspace/states'
import { useDriverEdits } from '../../hooks/useDriverEdits'
import { useVolunteer } from '../../hooks/useVolunteer'
import { requestHoursError } from '../../logic/requestHours'
import type { Driver } from '../../types'

// When Relay Collective may send this driver requests, and where. It's never a promise to drive.
export function Availability() {
  const { driver, driverLoaded } = useVolunteer()
  if (!driverLoaded) return <SkeletonRows rows={3} label="Loading your availability" />
  if (!driver) {
    return (
      <RestrictedState icon={<ShieldOff className="h-6 w-6" />} title="This service isn't available to your account.">
        <p>Availability is for drivers. There's no driver profile on this account.</p>
      </RestrictedState>
    )
  }
  return <AvailabilityForm driver={driver} />
}

function AvailabilityForm({ driver }: { driver: Driver }) {
  const edits = useDriverEdits(driver, ['requestHours', 'serviceCities'], (s) => ({
    requestHours: requestHoursError(s.requestHours),
    serviceCities: s.serviceCities.length ? undefined : 'Pick at least one city.',
  }))
  const { current, change, errors } = edits
  // DriverCityFields works on a whole driver draft; only its cities are read back
  const draft = { ...driver, ...current, name: '', phone: '' } as DriverDraft

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        eyebrow="Transportation"
        title="Availability"
        description="Choose when and where Relay Collective sends you ride requests. You always decide which ones to accept."
      />

      <RequestStatusCard driver={driver} />

      <p className="flex items-start gap-2 rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)] p-4 text-sm text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-rc-blue" aria-hidden />
        <span>
          <strong className="font-semibold text-rc-navy">Changes apply to new requests only.</strong> Rides you've already accepted stay on your list. If
          you can't make one, open it and choose “I can't make it” so the organization can find another driver. Need a break? Turn your days off here:
          there's no separate pause.
        </span>
      </p>

      <Section
        id="hours-title"
        icon={<CalendarClock className="h-5 w-5" />}
        title="Request hours"
        description="We only send requests during these hours. Each day has one window, and it can't cross midnight."
      >
        <RequestHoursEditor value={current.requestHours} onChange={(requestHours) => change({ requestHours })} error={errors.requestHours} />
      </Section>

      <Section id="area-title" icon={<MapPin className="h-5 w-5" />} title="Service area" description="Requests are only sent for rides that start in these cities.">
        <DriverCityFields value={draft} onChange={(d) => change({ serviceCities: d.serviceCities })} errors={errors} />
      </Section>

      <SaveBar dirty={edits.dirty} state={edits.state} onSave={edits.save} onCancel={edits.discard} />
    </div>
  )
}

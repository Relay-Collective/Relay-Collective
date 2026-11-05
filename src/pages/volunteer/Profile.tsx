import { ArrowRight, CalendarClock, Car, Lock, ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DetailList } from '../../components/admin/controls'
import { DriverVehicleFields } from '../../components/DriverFields'
import type { DriverDraft } from '../../components/driverDraft'
import { SaveBar } from '../../components/volunteer/SaveBar'
import { SettingsSection } from '../../components/volunteer/SettingsSection'
import { InterestsSection } from '../../components/volunteer/InterestsSection'
import { RestrictedState } from '../../components/volunteer/states'
import { ServiceParticipation } from '../../components/volunteer/ServiceParticipation'
import { VerificationSummary } from '../../components/volunteer/VerificationSummary'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { useApp } from '../../hooks/useApp'
import { useDriverEdits } from '../../hooks/useDriverEdits'
import { useVolunteer } from '../../hooks/useVolunteer'
import { initials } from '../../logic/initials'
import { describeRequestHours } from '../../logic/requestHours'
import { MAX_NAME, tooLong } from '../../logic/validate'
import type { Driver, User } from '../../types'
import { volunteerPaths } from '../../volunteer/paths'

// Who the volunteer is, the ways they'd like to help, the services they actually take part in, and (for CareRide
// drivers only) their transportation details. Interests and service participation are kept apart on purpose.
// Contact details and approval are changed by the Relay Collective team; only vehicle details are editable here,
// and the backend refuses anything else.
export function Profile() {
  const { currentUser } = useApp()
  const { workspace, driver, driverLoaded } = useVolunteer()
  if (!currentUser) return null
  if (!driverLoaded) return <SkeletonRows rows={4} label="Loading your profile" />
  const isDriver = workspace.experience === 'CARERIDE_DRIVER'

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        title="My profile"
        description={
          isDriver
            ? 'Your details, how you take part in Relay Collective, and your transportation information.'
            : 'Your details, the ways you’d like to help, and the services you take part in.'
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <PersonalInfo user={currentUser} driver={isDriver} />
          <InterestsSection compact />
        </div>
        <div className="space-y-6">
          <ServiceParticipation />
          {driver ? (
            <>
              <TransportationDetails driver={driver} />
              <VerificationSummary driver={driver} />
            </>
          ) : (
            // Only a driver account can be missing its transportation details. A general volunteer never had any.
            isDriver && (
              <RestrictedState icon={<ShieldOff className="h-6 w-6" />} title="No transportation profile">
                <p>This account isn't set up to drive, so there are no transportation details to show.</p>
              </RestrictedState>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function PersonalInfo({ user, driver }: { user: User; driver: boolean }) {
  return (
    <section aria-labelledby="personal-title" className={panel}>
      <div className={panelHead}>
        <h2 id="personal-title" className={panelTitle}>
          Personal information
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Managed by Relay Collective
        </span>
      </div>
      <div className="flex items-center gap-4 px-5 pt-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-coral-400 font-heading text-lg font-bold text-ink" aria-hidden>
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold text-rc-navy">{user.name}</p>
          <p className="truncate text-sm text-slate-600">{user.email ?? 'No sign-in email on file'}</p>
        </div>
      </div>
      <div className="mt-3">
        <DetailList
          rows={[
            ['Display name', user.name],
            ['Email', user.email ?? '—'],
            ['Mobile phone', user.phone || '—'],
          ]}
        />
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        {driver
          ? 'Your first name and phone number are shared only with the organization whose ride you accept. '
          : 'Your contact details are seen only by the Relay Collective team. '}
        To change your name or phone number, contact the Relay Collective team.
      </p>
    </section>
  )
}

function TransportationDetails({ driver }: { driver: Driver }) {
  const approved = driver.status === 'APPROVED'
  const edits = useDriverEdits(driver, ['vehicle', 'seats', 'wheelchairAccessible'], (s) => ({
    vehicle: s.vehicle.trim() ? tooLong(s.vehicle, MAX_NAME) : 'Describe your vehicle so passengers can find it.',
  }))
  // DriverVehicleFields works on a whole driver draft; only the vehicle fields are read back
  const draft = { ...driver, ...edits.current, name: '', phone: '' } as DriverDraft

  return (
    <>
      <SettingsSection
        id="vehicle-title"
        icon={<Car className="h-5 w-5" />}
        title="Transportation details"
        description="Your vehicle, and who it can carry. We only send you rides it can take."
      >
        <DriverVehicleFields
          value={draft}
          onChange={({ vehicle, seats, wheelchairAccessible }) => {
            const patch: Partial<Pick<Driver, 'vehicle' | 'seats' | 'wheelchairAccessible'>> = {}
            if (vehicle !== edits.current.vehicle) patch.vehicle = vehicle
            if (seats !== edits.current.seats) patch.seats = seats
            if (wheelchairAccessible !== edits.current.wheelchairAccessible) patch.wheelchairAccessible = wheelchairAccessible
            edits.change(patch)
          }}
          errors={edits.errors}
          lockCapacity={approved}
          showCities={false}
        />
      </SettingsSection>

      <section aria-labelledby="area-summary-title" className={panel}>
        <div className={panelHead}>
          <h2 id="area-summary-title" className={`${panelTitle} flex items-center gap-2`}>
            <CalendarClock className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Availability and area
          </h2>
          <Link to={volunteerPaths.availability} className={panelLink}>
            Change <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <DetailList
          rows={[
            ['Operating area', driver.serviceCities.join(', ') || 'None chosen'],
            ['Request hours', describeRequestHours(driver.requestHours)],
          ]}
        />
      </section>

      <SaveBar dirty={edits.dirty} state={edits.state} onSave={edits.save} onCancel={edits.discard} />
    </>
  )
}

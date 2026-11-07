import { HeartHandshake, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SaveBar } from '../../components/volunteer/SaveBar'
import { SettingsSection } from '../../components/volunteer/SettingsSection'
import { InterestPicker } from '../../components/volunteer/InterestPicker'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel } from '../../components/workspace/styles'
import { useApp } from '../../hooks/useApp'
import type { SaveState } from '../../hooks/useDriverEdits'
import { useVolunteer } from '../../hooks/useVolunteer'
import { dataService } from '../../services'
import type { VolunteerInterest } from '../../types'
import { interestsError, sameInterests } from '../../volunteer/interests'

// A volunteer's interests: add or remove any, then save. Only the interests change. Driving, availability,
// verification and every other permission stay exactly as they were (the backend changes nothing else).
//
// A driver from before general volunteering has no volunteer profile yet. Nothing is created when the page opens:
// their first save adds one (register_volunteer() keeps them a DRIVER, with their driver profile untouched).
export function Interests() {
  const { currentUser } = useApp()
  const { volunteer, workspace } = useVolunteer()
  const driver = workspace.experience === 'CARERIDE_DRIVER'

  return (
    <div className="space-y-6 pb-28">
      <PageHeader title="Volunteering interests" description="The kinds of help you’d like to give. Update them as your interests change." />
      {volunteer.error && volunteer.data === undefined ? (
        <section className={panel} aria-label="Volunteering interests">
          <SectionError message="We couldn't load your interests. Please try again." />
        </section>
      ) : volunteer.data === undefined || !currentUser ? (
        <SkeletonRows rows={3} label="Loading your interests" />
      ) : volunteer.data === null && !driver ? (
        // A general volunteer always has one (registration makes both together), so this is never expected
        <section className={panel} aria-label="Volunteering interests">
          <SectionError message="We couldn't find your volunteer profile. Contact the Relay Collective team if this keeps happening." />
        </section>
      ) : (
        <InterestsForm saved={volunteer.data?.interests ?? []} firstTime={volunteer.data === null} name={currentUser.name} driver={driver} />
      )}
    </div>
  )
}

function InterestsForm({ saved, firstTime, name, driver }: { saved: VolunteerInterest[]; firstTime: boolean; name: string; driver: boolean }) {
  const { refresh } = useApp()
  // What's saved: from the page's load, then from each successful save
  const [baseline, setBaseline] = useState<VolunteerInterest[]>(saved)
  const [chosen, setChosen] = useState<VolunteerInterest[]>(saved)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [showError, setShowError] = useState(false)
  const [created, setCreated] = useState(!firstTime)
  const dirty = !sameInterests(chosen, baseline)
  const problem = interestsError(chosen)

  // Leaving the page (closing the tab, reloading) with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save() {
    if (!dirty || state.kind === 'saving') return
    if (problem) {
      setShowError(true)
      return
    }
    setState({ kind: 'saving' })
    try {
      if (created) {
        const updated = await dataService.updateMyVolunteerInterests(chosen)
        setBaseline(updated.interests)
        setChosen(updated.interests)
      } else {
        // The first interests of a driver account: adds their volunteer profile. Their role and driving don't change.
        await dataService.registerVolunteer({ name, interests: chosen })
        setBaseline(chosen)
        setCreated(true)
      }
      setShowError(false)
      setState({ kind: 'saved' })
      refresh()
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : "We couldn't save your interests. Please try again." })
    }
  }

  return (
    <>
      <SettingsSection
        id="interests-title"
        icon={<HeartHandshake className="h-5 w-5" />}
        title="How would you like to help?"
        description={created ? 'Add or remove any. Keep at least one.' : 'Besides driving, choose any other ways you’d like to help.'}
      >
        <InterestPicker
          legend="How would you like to help?"
          showLegend={false}
          value={chosen}
          onChange={(next) => {
            setChosen(next)
            setShowError(false)
            if (state.kind !== 'saving') setState({ kind: 'idle' })
          }}
          error={showError ? problem : undefined}
          disabled={state.kind === 'saving'}
        />
        <p className="mt-5 flex items-start gap-2 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-rc-teal-ink" aria-hidden />
          {driver
            ? 'Interests don’t change your CareRide driving, availability or verification, and removing Transportation doesn’t affect your rides.'
            : 'Interests don’t sign you up for anything or give access to a service. Driving for CareRide is a separate enrollment, verified by the Relay Collective team.'}
        </p>
      </SettingsSection>
      <SaveBar
        dirty={dirty}
        state={state}
        onSave={() => void save()}
        onCancel={() => {
          setChosen(baseline)
          setShowError(false)
          setState({ kind: 'idle' })
        }}
      />
    </>
  )
}

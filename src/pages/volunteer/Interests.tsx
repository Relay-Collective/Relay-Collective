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
import { useMyVolunteerProfile } from '../../hooks/useVolunteerProfile'
import { dataService } from '../../services'
import type { VolunteerInterest } from '../../types'
import { interestsError, sameInterests } from '../../volunteer/interests'

// A volunteer's interests: add or remove any, then save. Only the interests change. Driving, verification
// and every other permission stay exactly as they were (the backend changes nothing else).
export function Interests() {
  const profile = useMyVolunteerProfile()

  return (
    <div className="space-y-6 pb-28">
      <PageHeader title="Volunteering interests" description="The kinds of help you’d like to give. Update them as your interests change." />
      {profile.error && !profile.data ? (
        <section className={panel} aria-label="Volunteering interests">
          <SectionError message="We couldn't load your interests. Please try again." />
        </section>
      ) : profile.data === undefined ? (
        <SkeletonRows rows={3} label="Loading your interests" />
      ) : profile.data === null ? (
        <section className={`${panel} px-6 py-8 text-center text-slate-600`}>This account doesn’t have a volunteer profile.</section>
      ) : (
        <InterestsForm saved={profile.data.interests} />
      )}
    </div>
  )
}

function InterestsForm({ saved }: { saved: VolunteerInterest[] }) {
  const { refresh } = useApp()
  // What's saved: from the page's load, then from each successful save
  const [baseline, setBaseline] = useState<VolunteerInterest[]>(saved)
  const [chosen, setChosen] = useState<VolunteerInterest[]>(saved)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [showError, setShowError] = useState(false)
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
      const updated = await dataService.updateMyVolunteerInterests(chosen)
      setBaseline(updated.interests)
      setChosen(updated.interests)
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
        description="Add or remove any. Keep at least one."
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
          Interests don’t sign you up for anything or give access to a service. Driving for CareRide is a separate enrollment, verified by the Relay
          Collective team.
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

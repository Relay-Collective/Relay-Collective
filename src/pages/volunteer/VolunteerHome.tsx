import { ArrowRight, CircleCheck, Clock, HeartHandshake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DetailList } from '../../components/admin/controls'
import { InterestIcon } from '../../components/volunteer/InterestPicker'
import { Greeting, PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { secondaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { useNow } from '../../hooks/useNow'
import { useMyVolunteerProfile } from '../../hooks/useVolunteerProfile'
import { greetingFor } from '../../logic/formatTime'
import type { User, VolunteerProfile } from '../../types'
import { interestDefinition } from '../../volunteer/interests'
import { PARTICIPANT_KIND_LABELS } from '../../volunteer/participation'
import { volunteerPaths } from '../../volunteer/paths'

// A general volunteer's home: who they are here, the interests they saved, and honestly what's running today.
// No driving pages: this account has no CareRide driver profile, whatever its interests say.
export function VolunteerHome() {
  const { currentUser } = useApp()
  const profile = useMyVolunteerProfile()
  const now = new Date(useNow())
  if (!currentUser) return null
  const first = currentUser.name.trim().split(/\s+/)[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={<Greeting greeting={greetingFor(now.getHours())} name={first || undefined} />}
        eyebrow={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        description="Welcome to Relay Collective. Here’s how you’ve said you’d like to help."
      />
      {profile.error && !profile.data ? (
        <section className={panel} aria-label="Your volunteering interests">
          <SectionError message="We couldn't load your volunteer profile. Please try again." />
        </section>
      ) : profile.data === undefined ? (
        <SkeletonRows rows={3} label="Loading your volunteer profile" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
          <div className="space-y-6">
            <Interests profile={profile.data} />
          </div>
          <Identity user={currentUser} profile={profile.data} />
        </div>
      )}
    </div>
  )
}

function Interests({ profile }: { profile: VolunteerProfile | null }) {
  return (
    <section aria-labelledby="interests-title" className={panel}>
      <div className={panelHead}>
        <h2 id="interests-title" className={panelTitle}>
          Your volunteering interests
        </h2>
        <Link to={volunteerPaths.interests} className={panelLink}>
          Update interests <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {!profile || !profile.interests.length ? (
        <EmptyState
          icon={<HeartHandshake className="h-6 w-6" />}
          title="No interests saved yet"
          text="Tell us how you’d like to help."
          action={
            <Link to={volunteerPaths.interests} className={`${secondaryButton} ${compactButton}`}>
              Choose interests
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {profile.interests.map((id) => {
            const d = interestDefinition(id)
            return (
              <li key={id} className="flex items-start gap-4 px-5 py-4 sm:px-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rc-mint text-rc-teal-ink">
                  <InterestIcon interest={id} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-rc-navy">{d.label}</p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-600">
                    {d.operational ? (
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                    {d.availability}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
        Interests tell us how you’d like to contribute. They don’t sign you up for anything, and choosing one doesn’t guarantee an opportunity is
        available.
      </p>
    </section>
  )
}

function Identity({ user, profile }: { user: User; profile: VolunteerProfile | null }) {
  const since = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : undefined
  return (
    <section aria-labelledby="identity-title" className={panel}>
      <div className={panelHead}>
        <h2 id="identity-title" className={panelTitle}>
          Volunteer profile
        </h2>
      </div>
      <DetailList
        rows={[
          ['Name', user.name],
          ['Email', user.email ?? '—'],
          ['Taking part as', PARTICIPANT_KIND_LABELS.GENERAL_VOLUNTEER],
          ...(since ? ([['Volunteer since', since]] as [string, string][]) : []),
        ]}
      />
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        The one service running on Relay Collective today is CareRide (transportation). Other kinds of volunteering aren’t on Relay Collective yet.
      </p>
    </section>
  )
}

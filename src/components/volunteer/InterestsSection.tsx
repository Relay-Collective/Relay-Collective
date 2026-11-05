import { ArrowRight, CircleCheck, Clock, HeartHandshake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useVolunteer } from '../../hooks/useVolunteer'
import type { VolunteerInterest } from '../../types'
import { interestDefinition } from '../../volunteer/interests'
import { volunteerPaths } from '../../volunteer/paths'
import { interestStatus, type VolunteerWorkspace } from '../../volunteer/workspace'
import { secondaryButton } from '../ui'
import { EmptyState, SectionError, SkeletonRows } from '../workspace/states'
import { compactButton, panel, panelHead, panelLink, panelTitle } from '../workspace/styles'
import { InterestIcon } from './InterestPicker'

// One interest: what it is, and what it means for this person today. The status line comes from their actual
// CareRide enrollment, so "interested in Transportation" is never mistaken for "drives for CareRide".
export function InterestItem({ interest, workspace, compact }: { interest: VolunteerInterest; workspace: VolunteerWorkspace; compact?: boolean }) {
  const d = interestDefinition(interest)
  // Shown as taking part only when they actually drive for CareRide; every other line is about what's available
  const active = interest === 'TRANSPORTATION' && workspace.careRide === 'APPROVED'
  const StatusIcon = active ? CircleCheck : Clock
  return (
    <li className={`flex items-start gap-4 ${compact ? 'px-5 py-3.5' : 'px-5 py-4 sm:px-6'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rc-mint text-rc-teal-ink">
        <InterestIcon interest={interest} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-rc-navy">{d.label}</p>
        {!compact && <p className="text-sm text-slate-600">{d.description}</p>}
        <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
          <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} aria-hidden />
          {interestStatus(interest, workspace)}
        </p>
      </div>
    </li>
  )
}

// "Your volunteering interests": the ways this person has chosen to contribute, with the way to change them.
// compact: a side panel (the driver dashboard, the profile). Reads what the workspace already loaded.
export function InterestsSection({ compact = false }: { compact?: boolean }) {
  const { workspace, volunteer } = useVolunteer()
  const manage = (
    <Link to={volunteerPaths.interests} className={panelLink}>
      Manage interests <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )

  return (
    <section aria-labelledby="interests-title" className={panel}>
      <div className={panelHead}>
        <div>
          <h2 id="interests-title" className={panelTitle}>
            Your volunteering interests
          </h2>
          <p className="text-sm text-slate-500">The ways you’ve chosen to contribute.</p>
        </div>
        {workspace.interests.length > 0 && manage}
      </div>
      {volunteer.error && volunteer.data === undefined ? (
        <SectionError message="We couldn't load your interests. Please try again." />
      ) : volunteer.data === undefined ? (
        <SkeletonRows rows={2} label="Loading your interests" />
      ) : workspace.interests.length === 0 ? (
        <EmptyState
          compact
          tone="neutral"
          icon={<HeartHandshake />}
          title="No interests saved yet"
          text={
            workspace.experience === 'CARERIDE_DRIVER'
              ? 'Besides driving, tell us other ways you’d like to help. It doesn’t change your driving.'
              : 'Tell us how you’d like to help.'
          }
          action={
            <Link to={volunteerPaths.interests} className={`${secondaryButton} ${compactButton}`}>
              Choose interests
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100" aria-label="Your volunteering interests">
          {workspace.interests.map((id) => (
            <InterestItem key={id} interest={id} workspace={workspace} compact={compact} />
          ))}
        </ul>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Interests tell us how you’d like to contribute. They don’t sign you up for anything or change what you can do.
      </p>
    </section>
  )
}

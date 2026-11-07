import { Boxes, HeartHandshake, Users } from 'lucide-react'
import { OpportunityList } from '../../components/volunteer/OpportunityList'
import { RequireApprovedDriver } from '../../components/volunteer/states'
import { PageHeader } from '../../components/workspace/PageHeader'
import { panelTitle } from '../../components/workspace/styles'

// Planned kinds of opportunity. Listed so the page's scope is clear; none of them is offered yet.
const PLANNED = [
  { icon: Users, name: 'Volunteer assignments', text: 'Event help, food distribution, and other community shifts.' },
  { icon: Boxes, name: 'Resource delivery', text: 'Moving supplies between partner organizations.' },
  { icon: HeartHandshake, name: 'Partner initiatives', text: 'Projects run jointly by several nonprofits.' },
]

// Everything a volunteer can say yes to. Today that's transportation requests the backend matched to this driver.
export function Opportunities() {
  return (
    <RequireApprovedDriver>
      <div className="space-y-6">
        <PageHeader
          title="Opportunities"
          description="Requests sent to you because they fit your vehicle, the cities you drive in, and your availability. Accept what suits you and decline the rest."
        />

        <section aria-labelledby="transport-requests-title">
          <h2 id="transport-requests-title" className={`${panelTitle} mb-3`}>
            Transportation requests
          </h2>
          <OpportunityList showMap />
        </section>

        <section aria-labelledby="planned-title" className="rounded-xl border border-dashed border-slate-300 p-5">
          <h2 id="planned-title" className="font-sans text-sm font-semibold text-rc-navy">
            Planned, not available yet
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Other kinds of opportunity will appear here once partner organizations can post them.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {PLANNED.map(({ icon: Icon, name, text }) => (
              <li key={name} className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">{name}</span>
                  <span className="block text-sm text-slate-500">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </RequireApprovedDriver>
  )
}

import { PageHeader } from '../../components/workspace/PageHeader'
import { PlannedModuleCard, ServiceModuleCard } from '../../components/workspace/ServiceModuleCard'
import { panelTitle } from '../../components/workspace/styles'
import { ACTIVE_MODULES, PLANNED_MODULES } from '../../workspace/modules'

// Every service module: the ones the organization can use now, and the ones still planned.
export function Services() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Modules"
        description="Relay Collective is one shared platform for nonprofits. Each module adds one kind of work, built on the same organization, team, and access."
      />

      <section aria-labelledby="active-title">
        <h2 id="active-title" className={`${panelTitle} mb-3`}>
          Available to your organization
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ACTIVE_MODULES.map((m) => (
            <ServiceModuleCard key={m.id} module={m} />
          ))}
        </div>
      </section>

      <section aria-labelledby="planned-title">
        <h2 id="planned-title" className={panelTitle}>
          Planned
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-slate-500">These modules are in development and can't be used yet.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLANNED_MODULES.map((m) => (
            <PlannedModuleCard key={m.id} module={m} />
          ))}
        </div>
      </section>
    </div>
  )
}

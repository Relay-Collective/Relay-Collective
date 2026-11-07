import { ChevronRight, Info, MapPin, Truck, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ORG_KIND, USER_KIND } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { Breadcrumbs, DateText, DetailList } from '../../components/admin/controls'
import { ReviewActions } from '../../components/admin/ReviewActions'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { isFinished } from '../../modules/careride/domain'

// One organization: who they are, where they work, who can sign in for them, and how they take part
export function OrganizationDetail() {
  const { id = '' } = useParams()
  const { orgs, houses, accounts, drivers, rides, personName } = useAdmin()
  const org = orgs.data?.find((o) => o.id === id)

  const crumbs = [{ label: 'Organizations', to: adminPaths.organizations }, { label: org?.name ?? 'Organization' }]

  if (!orgs.data) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className={panel}>{orgs.error ? <SectionError message="We couldn't load this organization. Please try again." /> : <SkeletonRows rows={4} label="Loading organization" />}</div>
      </div>
    )
  }
  if (!org) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className={panel}>
          <EmptyState icon={<Info className="h-6 w-6" />} title="Organization not found" text="It may have been removed, or the link is wrong." />
        </div>
      </div>
    )
  }

  const location = houses.data?.filter((h) => h.orgId === org.id) ?? []
  const members = accounts.data?.filter((u) => u.orgId === org.id) ?? []
  const orgDrivers = drivers.data?.filter((d) => d.orgId === org.id) ?? []
  const isPartner = org.type === 'PARTNER_ORG'
  const driverIds = new Set(orgDrivers.map((d) => d.id))
  const orgRides = (rides.data ?? []).filter((r) => (isPartner ? r.orgId === org.id : !!r.driverId && driverIds.has(r.driverId)))
  const reviewer = personName(org.reviewedBy)

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={crumbs} />
        <PageHeader
          title={org.name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={org.status} />
              <span className="text-sm">{ORG_KIND[org.type].label}</span>
            </span>
          }
        />
      </div>

      {org.status === 'PENDING' && (
        <section aria-labelledby="review-title" className={`${panel} border-amber-200 p-5`}>
          <h2 id="review-title" className={panelTitle}>
            This registration is waiting for review
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Check the details below, then decide.</p>
          <ReviewActions subject="ORGANIZATION" id={org.id} name={org.name} contact={`${org.contactName}, ${org.contactPhone}`} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="overview-title" className={panel}>
          <div className={panelHead}>
            <h2 id="overview-title" className={panelTitle}>
              Registration
            </h2>
          </div>
          <DetailList
            rows={[
              ['Type', ORG_KIND[org.type].label],
              ['Contact person', org.contactName],
              ['Contact phone', org.contactPhone],
              ['Hears about bookings', org.bookingNotifications],
              ['Registered', org.createdAt && <DateText at={org.createdAt} withTime />],
              ['Status', <VerificationBadge key="s" status={org.status} />],
            ]}
          />
        </section>

        <section aria-labelledby="history-title" className={panel}>
          <div className={panelHead}>
            <h2 id="history-title" className={panelTitle}>
              Review record
            </h2>
          </div>
          <DetailList
            rows={[
              ['Last decision', org.status === 'PENDING' ? 'None yet' : org.reviewedAt ? <DateText key="d" at={org.reviewedAt} withTime /> : undefined],
              ['Decided by', org.status === 'PENDING' ? '—' : reviewer],
            ]}
          />
          <p className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Only the latest decision is stored. Earlier decisions on this organization aren’t kept.
          </p>
        </section>

        {isPartner && (
          <section aria-labelledby="location-title" className={panel}>
            <div className={panelHead}>
              <h2 id="location-title" className={`${panelTitle} flex items-center gap-2`}>
                <MapPin className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Location
              </h2>
            </div>
            {!houses.data ? (
              <SkeletonRows rows={1} />
            ) : location.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-600">No location on file.</p>
            ) : (
              location.map((h) => (
                <DetailList
                  key={h.id}
                  rows={[
                    ['Name', h.name],
                    ['Address', `${h.address}, ${h.city}`],
                    ['Front desk phone', h.phone],
                  ]}
                />
              ))
            )}
          </section>
        )}

        <section aria-labelledby="members-title" className={panel}>
          <div className={panelHead}>
            <h2 id="members-title" className={`${panelTitle} flex items-center gap-2`}>
              <Users className="h-4 w-4 text-rc-blue" aria-hidden /> Accounts
            </h2>
          </div>
          {!accounts.data ? (
            <SkeletonRows rows={1} />
          ) : members.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No one can sign in for this organization.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((u) => (
                <li key={u.id}>
                  <Link to={adminPaths.user(u.id)} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-rc-navy">{u.name}</span>
                      <span className="block truncate text-sm text-slate-600">
                        {USER_KIND[u.role]}
                        {u.email && ` · ${u.email}`}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {isPartner && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Partner organizations share one staff account.</p>}
        </section>

        <section aria-labelledby="services-title" className={`${panel} lg:col-span-2`}>
          <div className={panelHead}>
            <h2 id="services-title" className={`${panelTitle} flex items-center gap-2`}>
              <Truck className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Service participation
            </h2>
          </div>
          <DetailList
            rows={[
              ['Module', ORG_KIND[org.type].service],
              ...(isPartner
                ? ([
                    ['Rides requested', rides.data ? orgRides.length : undefined],
                    ['Open now', rides.data ? orgRides.filter((r) => !isFinished(r)).length : undefined],
                    ['Completed', rides.data ? orgRides.filter((r) => r.status === 'COMPLETED').length : undefined],
                  ] as [string, number | undefined][])
                : ([
                    ['Drivers', drivers.data ? orgDrivers.length : undefined],
                    ['Rides given by its drivers', rides.data ? orgRides.length : undefined],
                  ] as [string, number | undefined][])),
            ]}
          />
          <p className="border-t border-slate-100 px-5 py-3 text-sm">
            <Link to={`${adminPaths.transportation}?org=${org.id}`} className="font-semibold text-rc-blue hover:underline">
              See this organization’s rides in Transportation
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}

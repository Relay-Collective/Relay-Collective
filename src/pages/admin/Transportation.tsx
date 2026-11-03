import { BadgeCheck, CarFront, ChevronRight, CircleCheck, Clock, Route, TriangleAlert, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { FilterTabs, Notice, SearchField, Toolbar } from '../../components/admin/controls'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { StatusBadge } from '../../modules/careride'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { ModuleBadge } from '../../components/workspace/ServiceModuleCard'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { BACKGROUND_LABELS } from '../../constants'
import { useAdmin } from '../../hooks/useAdmin'
import { matches, RIDE_STAGES, rideStage, rideStageCounts, type RideStage } from '../../logic/adminSummary'
import { formatDayTime } from '../../logic/formatTime'
import { requestReference, rideBadgeLabel } from '../../modules/careride/domain'
import { ALL_RIDES_LIMIT } from '../../services/dataService'
import type { Driver, Organization, Ride } from '../../types'

type StageFilter = 'all' | RideStage

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Oversight of the transportation module: how requests are moving, the driver pool, and providers.
// Admins watch and investigate here; booking and driving stay with organizations and drivers.
export function Transportation() {
  const { rides, drivers, orgs, orgName, driverName, personName } = useAdmin()
  const [params, setParams] = useSearchParams()
  const picked = params.get('stage')
  const stage: StageFilter = RIDE_STAGES.some((s) => s.id === picked) ? (picked as RideStage) : 'all'
  const orgFilter = params.get('org') ?? ''
  const [query, setQuery] = useState('')

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const allRides = rides.data ?? []
  const filterOrg = orgs.data?.find((o) => o.id === orgFilter)
  const providerDriverIds = new Set((drivers.data ?? []).filter((d) => d.orgId === orgFilter).map((d) => d.id))
  const ofOrg = filterOrg
    ? allRides.filter((r) => (filterOrg.type === 'PARTNER_ORG' ? r.orgId === filterOrg.id : !!r.driverId && providerDriverIds.has(r.driverId)))
    : allRides
  const counts = rideStageCounts(ofOrg)
  const shownRides = ofOrg.filter((r) => (stage === 'all' || rideStage(r) === stage) && matches(query, r.destinationName, orgName(r.orgId), requestReference(r.id)))
  const pendingDrivers = drivers.data?.filter((d) => d.status === 'PENDING').length
  const providers = orgs.data?.filter((o) => o.type === 'TRANSPORT_PROVIDER') ?? []

  const rideColumns: Column<Ride>[] = [
    {
      id: 'ride',
      header: 'Ride',
      sortValue: (r) => r.destinationName.toLowerCase(),
      cell: (r) => (
        <>
          <Link to={adminPaths.ride(r.id)} className={`rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
            {r.returnOfRideId ? 'Return from' : 'To'} {r.destinationName}
          </Link>
          <span className="block text-xs text-slate-500">Ref. #{requestReference(r.id)}</span>
        </>
      ),
    },
    { id: 'org', header: 'Organization', sortValue: (r) => orgName(r.orgId), cell: (r) => orgName(r.orgId) ?? '—' },
    { id: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} label={rideBadgeLabel(r)} /> },
    { id: 'pickup', header: 'Pickup', sortValue: (r) => r.pickupTime, cell: (r) => <span className="whitespace-nowrap">{formatDayTime(r.pickupTime)}</span> },
    { id: 'driver', header: 'Driver', className: 'hidden xl:table-cell', cell: (r) => driverName(r.driverId) ?? <span className="text-slate-500">—</span> },
    {
      id: 'action',
      header: '',
      align: 'right',
      cell: (r) => (
        <Link to={adminPaths.ride(r.id)} aria-label={`View ride ${requestReference(r.id)}`} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}>
          View <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ),
    },
  ]

  const driverColumns: Column<Driver>[] = [
    {
      id: 'name',
      header: 'Driver',
      sortValue: (d) => personName(d.userId)?.toLowerCase(),
      cell: (d) => (
        <Link to={adminPaths.user(d.userId)} className={`rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
          {personName(d.userId) ?? 'Unnamed driver'}
        </Link>
      ),
    },
    { id: 'background', header: 'Drives as', className: 'hidden lg:table-cell', cell: (d) => BACKGROUND_LABELS[d.background] },
    { id: 'org', header: 'Provider', className: 'hidden lg:table-cell', cell: (d) => orgName(d.orgId) ?? 'Independent' },
    { id: 'vehicle', header: 'Vehicle', cell: (d) => `${d.seats} ${d.seats === 1 ? 'seat' : 'seats'}${d.wheelchairAccessible ? ' · wheelchair' : ''}` },
    { id: 'status', header: 'Status', sortValue: (d) => d.status, cell: (d) => <VerificationBadge status={d.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Transportation operations <ModuleBadge status="active" />
          </span>
        }
        title="CareRide"
        description="Oversee ride requests, the driver pool, and transport providers. Organizations book and drivers drive; this view is for monitoring and investigating."
      />

      <section aria-label="Transportation metrics">
        <MetricGroup className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Finding a driver" value={rides.data && counts.waiting} hint="Drivers are being asked" icon={Clock} to={`${adminPaths.transportation}?stage=waiting`} />
        <MetricCard label="No driver available" value={rides.data && counts.noDriver} hint="Waiting on the organization" icon={TriangleAlert} to={`${adminPaths.transportation}?stage=noDriver`} alert />
        <MetricCard label="Scheduled" value={rides.data && counts.scheduled} hint="A driver has accepted" icon={Route} to={`${adminPaths.transportation}?stage=scheduled`} />
        <MetricCard label="Under way" value={rides.data && counts.underWay} hint="Driver on the way or riding" icon={CarFront} to={`${adminPaths.transportation}?stage=underWay`} />
        <MetricCard label="Completed" value={rides.data && counts.completed} hint="All loaded rides" icon={CircleCheck} to={`${adminPaths.transportation}?stage=completed`} />
        <MetricCard label="Drivers to review" value={pendingDrivers} hint="Verification queue" icon={BadgeCheck} to={`${adminPaths.approvals}?view=drivers`} alert="amber" />
      </MetricGroup>
      </section>

      {rides.data && rides.data.length >= ALL_RIDES_LIMIT && (
        <Notice tone="info">Showing the {ALL_RIDES_LIMIT.toLocaleString()} rides with the latest pickup times. Older rides aren’t counted here.</Notice>
      )}

      <section aria-labelledby="rides-title" className={panel}>
        <div className={panelHead}>
          <h2 id="rides-title" className={panelTitle}>
            Ride requests
          </h2>
          <div className="flex w-full min-w-0 flex-col gap-2 xl:w-auto xl:flex-row">
          <SearchField value={query} onChange={setQuery} label="Search rides by place, organization, or reference" placeholder="Search place, organization, ref." />
          <select
            aria-label="Organization"
            value={orgFilter}
            onChange={(e) => setParam('org', e.target.value)}
            className={`min-h-11 w-full min-w-0 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-rc-navy xl:w-56 ${focusRing}`}
          >
            <option value="">All organizations</option>
            {(orgs.data ?? []).map((o: Organization) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          </div>
        </div>
        <Toolbar>
          <FilterTabs
            label="Stage"
            value={stage}
            onChange={(v) => setParam('stage', v)}
            options={[
              { id: 'all' as StageFilter, label: 'All', count: rides.data ? ofOrg.length : undefined },
              ...RIDE_STAGES.map((s) => ({ id: s.id as StageFilter, label: s.label, count: rides.data ? counts[s.id] : undefined, alert: s.id === 'noDriver' })),
            ]}
          />
        </Toolbar>
        {!rides.data ? (
          rides.error ? <SectionError message="We couldn't load rides. Please try again." /> : <SkeletonRows rows={5} label="Loading rides" />
        ) : shownRides.length === 0 ? (
          <EmptyState icon={<Truck className="h-6 w-6" />} title="No rides match" text="Try another stage, organization, or search." />
        ) : (
          <DataTable
            caption="Ride requests, with organization, status, pickup time, and driver"
            columns={rideColumns}
            rows={shownRides}
            rowKey={(r) => r.id}
            noun={['ride', 'rides']}
            resetKey={`${stage}|${orgFilter}|${query}`}
            initialSort={{ id: 'pickup', direction: 'desc' }}
            highlight={(r) => rideStage(r) === 'noDriver'}
            card={(r) => (
              <Link to={adminPaths.ride(r.id)} className={`flex items-start gap-3 p-4 ${focusRing} focus-visible:ring-inset`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-rc-navy">
                    {r.returnOfRideId ? 'Return from' : 'To'} {r.destinationName}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {orgName(r.orgId)} · {formatDayTime(r.pickupTime)}
                  </span>
                  <span className="mt-2 block">
                    <StatusBadge status={r.status} label={rideBadgeLabel(r)} />
                  </span>
                </span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              </Link>
            )}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <section aria-labelledby="drivers-title" className={`${panel} xl:col-span-2`}>
          <div className={panelHead}>
            <h2 id="drivers-title" className={panelTitle}>
              Drivers
            </h2>
          </div>
          {!drivers.data ? (
            drivers.error ? <SectionError message="We couldn't load drivers. Please try again." /> : <SkeletonRows rows={3} label="Loading drivers" />
          ) : drivers.data.length === 0 ? (
            <EmptyState icon={<CarFront className="h-6 w-6" />} title="No drivers yet" />
          ) : (
            <DataTable
              caption="Drivers, with provider, vehicle, and verification status"
              columns={driverColumns}
              rows={drivers.data}
              rowKey={(d) => d.id}
              pageSize={10}
              noun={['driver', 'drivers']}
              initialSort={{ id: 'name', direction: 'asc' }}
              highlight={(d) => d.status === 'PENDING'}
              card={(d) => (
                <Link to={adminPaths.user(d.userId)} className={`flex items-center gap-3 p-4 ${focusRing} focus-visible:ring-inset`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-rc-navy">{personName(d.userId) ?? 'Unnamed driver'}</span>
                    <span className="block text-sm text-slate-600">
                      {BACKGROUND_LABELS[d.background]} · {orgName(d.orgId) ?? 'Independent'}
                    </span>
                  </span>
                  <VerificationBadge status={d.status} />
                </Link>
              )}
            />
          )}
        </section>

        <section aria-labelledby="providers-title" className={panel}>
          <div className={panelHead}>
            <h2 id="providers-title" className={panelTitle}>
              Transport providers
            </h2>
          </div>
          {!orgs.data ? (
            <SkeletonRows rows={2} />
          ) : providers.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No transport providers are registered.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {providers.map((o) => (
                <li key={o.id}>
                  <Link to={adminPaths.organization(o.id)} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-rc-navy">{o.name}</span>
                      <span className="block text-sm text-slate-600">
                        {plural((drivers.data ?? []).filter((d) => d.orgId === o.id).length, 'driver', 'drivers')}
                      </span>
                    </span>
                    <VerificationBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

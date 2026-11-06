import { ArrowRight, FileText, Info } from 'lucide-react'
import { DRIVER_APPLICATION_SOURCE_LABELS, driverApplicationSource } from '../../volunteer/participation'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ORG_KIND } from '../../admin/labels'
import { adminPaths, type ReviewKind } from '../../admin/paths'
import { Breadcrumbs, DateText, DetailList } from '../../components/admin/controls'
import { ReviewActions } from '../../components/admin/ReviewActions'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { BACKGROUND_LABELS } from '../../constants'
import { useAdmin } from '../../hooks/useAdmin'
import { useData } from '../../hooks/useData'
import { ORG_KINDS, PLATFORM_INTERESTS, SERVICE_CATEGORIES, labelOf } from '../../onboarding/options'
import { dataService } from '../../services'
import { approvalQueue } from '../../logic/adminSummary'
import { describeRequestHours } from '../../logic/requestHours'
import type { ReviewOutcome } from '../../hooks/useReview'

// One application, with everything it submitted and the decision to make
export function Review() {
  const { kind, id = '' } = useParams() as { kind: ReviewKind; id: string }
  const { orgs, drivers, accounts, houses, personName, orgName } = useAdmin()
  const [outcome, setOutcome] = useState<ReviewOutcome>()
  const isOrg = kind === 'organizations'
  // What the organization told us when it applied. Organizations from before onboarding have none.
  const application = useData(() => (isOrg ? dataService.getOrganizationApplication(id) : Promise.resolve(undefined)), `${kind}:${id}`)
  const ready = orgs.data && drivers.data

  const org = isOrg ? orgs.data?.find((o) => o.id === id) : undefined
  const driver = isOrg ? undefined : drivers.data?.find((d) => d.id === id)
  const record = org ?? driver
  const name = org?.name ?? personName(driver?.userId) ?? (isOrg ? 'Organization' : 'Driver')
  const crumbs = [{ label: 'Approvals', to: adminPaths.approvals }, { label: name }]

  if (!ready || !record) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className={panel}>
          {!ready ? (
            orgs.error || drivers.error ? <SectionError message="We couldn't load this application. Please try again." /> : <SkeletonRows rows={4} label="Loading application" />
          ) : (
            <EmptyState icon={<Info className="h-6 w-6" />} title="Application not found" text="It may have been removed, or the link is wrong." />
          )}
        </div>
      </div>
    )
  }

  const account = isOrg ? accounts.data?.find((u) => u.orgId === org!.id) : accounts.data?.find((u) => u.id === driver!.userId)
  const location = org && houses.data?.find((h) => h.orgId === org.id)
  const next = approvalQueue(orgs.data!, drivers.data!).find((i) => i.id !== id)
  const contact = org ? `${org.contactName}, ${org.contactPhone}` : [account?.phone, account?.email].filter(Boolean).join(' or ') || undefined

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={crumbs} />
        <PageHeader
          title={name}
          description={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <VerificationBadge status={record.status} />
              {isOrg ? 'Organization registration' : 'Driver verification'} · submitted <DateText at={record.createdAt} />
            </span>
          }
        />
      </div>

      <section aria-labelledby="decision-title" className={`${panel} p-5 ${record.status === 'PENDING' ? 'border-amber-200' : ''}`}>
        <h2 id="decision-title" className={panelTitle}>
          Decision
        </h2>
        {record.status === 'PENDING' || outcome ? (
          <div className="mt-3">
            <ReviewActions subject={isOrg ? 'ORGANIZATION' : 'DRIVER'} id={record.id} name={name} contact={contact} onOutcome={setOutcome} />
            {outcome && outcome.kind !== 'error' && (
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {next && (
                  <Link to={adminPaths.review(next.subject === 'ORGANIZATION' ? 'organizations' : 'drivers', next.id)} className="inline-flex items-center gap-1 font-semibold text-rc-blue hover:underline">
                    Next application <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
                <Link to={adminPaths.approvals} className="font-semibold text-rc-blue hover:underline">
                  Back to approvals
                </Link>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            {record.status === 'APPROVED' ? 'Approved' : 'Marked not approved'}
            {record.reviewedAt && (
              <>
                {' '}
                on <DateText at={record.reviewedAt} withTime />
              </>
            )}
            {personName(record.reviewedBy) && ` by ${personName(record.reviewedBy)}`}.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="submitted-title" className={panel}>
          <div className={panelHead}>
            <h2 id="submitted-title" className={panelTitle}>
              Submitted information
            </h2>
          </div>
          {org ? (
            <DetailList
              rows={[
                ['Organization', org.name],
                ['Type', ORG_KIND[org.type].label],
                ['Contact person', org.contactName],
                ['Contact phone', org.contactPhone],
                ['Hears about bookings', org.bookingNotifications],
                ['Pickup location', location ? `${location.address}, ${location.city}` : org.type === 'PARTNER_ORG' ? undefined : 'Not needed for a provider'],
                ...(application
                  ? ([
                      ['Organization kind', labelOf(ORG_KINDS, application.kind)],
                      ['Website', application.website],
                      ['Contact email', application.contactEmail],
                      ['Contact role', application.contactRole],
                      ['Description', application.description],
                      ['Services', application.serviceCategories.map((c) => labelOf(SERVICE_CATEGORIES, c)).join(', ')],
                      ['Interested in', application.platformInterests.map((p) => labelOf(PLATFORM_INTERESTS, p)).join(', ') || undefined],
                    ] as [string, string | undefined][])
                  : []),
              ]}
            />
          ) : (
            driver && (
              <DetailList
                rows={[
                  ['Applied through', DRIVER_APPLICATION_SOURCE_LABELS[driverApplicationSource(driver)]],
                  ['Drives as', BACKGROUND_LABELS[driver.background]],
                  ['Organization', orgName(driver.orgId) ?? 'Independent'],
                  ['Vehicle', driver.vehicle],
                  ['Passenger seats', String(driver.seats)],
                  ['Wheelchair accessible', driver.wheelchairAccessible ? 'Yes' : 'No'],
                  ['Service area', driver.serviceCities.join(', ') || 'None chosen'],
                  ['Request hours', describeRequestHours(driver.requestHours)],
                ]}
              />
            )
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="account-title" className={panel}>
            <div className={panelHead}>
              <h2 id="account-title" className={panelTitle}>
                Sign-in account
              </h2>
              {account && (
                <Link to={adminPaths.user(account.id)} className="text-sm font-semibold text-rc-blue hover:underline">
                  View account
                </Link>
              )}
            </div>
            <DetailList
              rows={[
                ['Name', account?.name],
                ['Email', account?.email],
                ['Phone', account?.phone || undefined],
              ]}
            />
          </section>

          {driver && (
            <section aria-labelledby="documents-title" className={panel}>
              <div className={panelHead}>
                <h2 id="documents-title" className={panelTitle}>
                  Verification documents
                </h2>
              </div>
              {driver.licenceFile || driver.proofFile ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {[
                    ['Driver’s licence', driver.licenceFile],
                    ['Proof of professional driving', driver.proofFile],
                  ]
                    .filter(([, file]) => file)
                    .map(([label, file]) => (
                      <li key={label} className="flex items-center gap-3 px-5 py-3">
                        <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                        <span className="flex-1 text-rc-navy">{label}</span>
                        <span className="text-slate-600">{file}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-slate-600">No documents on file. Uploading documents isn’t built yet, so check the licence with the driver directly.</p>
              )}
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Only file names are recorded; documents are never shown through a public link.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

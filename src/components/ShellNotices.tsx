import { AlertTriangle, ArrowRight, Clock, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { isDemoBackend } from '../services'
import { resetDemoData } from '../services/mockService'
import { ConfirmButton } from './ConfirmButton'
import { IncomingRequests } from './IncomingRequests'
import { RideAcceptedNotice } from './RideAcceptedNotice'
import { RideCancelledNotice } from './RideCancelledNotice'
import { dangerButton, secondaryButton } from './ui'

// Shared by every signed-in layout, so drivers, providers, admins, and the organization workspace
// all hear about the same things in the same way.

export function PendingApprovalNotice({ isDriver, statusLink, className = '' }: { isDriver: boolean; statusLink?: string; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-sm font-medium text-amber-900 ${className}`}>
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      Your account is waiting for approval from the Relay Collective team.
      {!isDriver && ' You can set things up in the meantime.'}
      {statusLink && (
        <Link to={statusLink} className="ml-1 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
          Application status <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </p>
  )
}

// Ride news that pops up in the page, so it never covers the ride slip or the fare tile
export function RideNotices() {
  return (
    <div className="no-print mb-6 flex flex-col gap-3 empty:mb-0 empty:hidden">
      <RideCancelledNotice />
      <IncomingRequests />
      <RideAcceptedNotice />
    </div>
  )
}

export function LoadErrorBanner() {
  const { loadError, refresh } = useApp()
  if (!loadError) return null
  return (
    <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Some information didn't load.</strong> {loadError}
        </span>
      </p>
      <button type="button" className={`${secondaryButton} min-h-10 shrink-0 px-4 text-sm`} onClick={refresh}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  )
}

export function AppFooter({ className = '' }: { className?: string }) {
  const { refresh } = useApp()
  return (
    <footer className={`no-print text-sm text-slate-500 ${className}`}>
      {isDemoBackend ? 'Demo data only. ' : ''}Relay Collective is an independent platform.{' '}
      {/* Used before every demo, so it stays visible, but asks first: it wipes everything. Local mock only. */}
      {isDemoBackend && (
        <ConfirmButton
          className="inline-flex min-h-12 items-center font-semibold underline-offset-2 hover:underline"
          title="Reset all demo data?"
          body="Every ride, account and change goes back to the starting demo."
          confirmLabel="Yes, reset everything"
          confirmClassName={dangerButton}
          onConfirm={() => {
            resetDemoData()
            refresh()
          }}
        >
          Reset demo data
        </ConfirmButton>
      )}
    </footer>
  )
}

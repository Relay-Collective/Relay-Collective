import { CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { MatchPreview } from '../../logic/driverMatchPreview'

// Tells staff before sending whether any driver could take the ride, and if not, why.
// A match is only a fit: nobody has been asked or has accepted until the ride is sent.
export function MatchLine({ match }: { match?: MatchPreview }) {
  if (!match) {
    return (
      <p className="flex items-center gap-2.5 px-1 text-sm text-slate-600">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        Checking drivers…
      </p>
    )
  }
  if (match.count > 0) {
    return (
      <p role="status" className="flex gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
        <span>
          <strong className="font-semibold">
            {match.count} {match.count === 1 ? 'driver can' : 'drivers can'} take this ride
          </strong>
          <span className="block text-emerald-800">Nobody has accepted yet. Drivers are asked once you send it.</span>
        </span>
      </p>
    )
  }
  return (
    <p role="status" className="flex gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <span>
        <strong className="font-semibold">No driver fits this ride right now:</strong> {match.reason} You can still send it. If nobody accepts by the
        pickup time, it's cancelled and you'll see other options.
      </span>
    </p>
  )
}

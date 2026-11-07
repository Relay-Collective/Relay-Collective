import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useReview, type ReviewOutcome } from '../../hooks/useReview'
import type { ReviewSubject } from '../../logic/adminSummary'
import type { VerificationStatus } from '../../types'
import { dangerOutlineButton, primaryButton } from '../ui'
import { ConfirmDialog } from './ConfirmDialog'
import { Notice } from './controls'

// What each decision does, in the product's own terms
const EFFECT: Record<ReviewSubject, Record<'APPROVED' | 'REJECTED', string>> = {
  ORGANIZATION: {
    APPROVED: 'The organization is marked verified, and the "waiting for approval" notice leaves its workspace.',
    REJECTED: 'The organization is marked not approved. Its account and any details it entered stay.',
  },
  DRIVER: {
    APPROVED: 'The driver starts getting ride requests that match their area, hours, and vehicle.',
    REJECTED: "The driver won't be sent ride requests. Their account stays.",
  },
}

interface Props {
  subject: ReviewSubject
  id: string
  name: string
  contact?: string // how to reach the applicant, since nothing tells them automatically
  onOutcome?: (outcome: ReviewOutcome) => void
}

// Approve and reject, each confirmed first. The result is said in words where the buttons were.
export function ReviewActions({ subject, id, name, contact, onOutcome }: Props) {
  const { review, busy } = useReview()
  const [asking, setAsking] = useState<'APPROVED' | 'REJECTED'>()
  const [outcome, setOutcome] = useState<ReviewOutcome>()

  async function decide(status: VerificationStatus) {
    const result = await review(subject, id, status)
    setAsking(undefined)
    setOutcome(result)
    onOutcome?.(result)
  }

  const noun = subject === 'ORGANIZATION' ? 'organization' : 'driver'

  if (outcome?.kind === 'done') {
    return (
      <Notice tone="success">
        <strong>{name}</strong> {outcome.status === 'APPROVED' ? 'was approved' : 'was marked not approved'}.
        {contact && ' Relay Collective doesn’t notify them automatically, so let them know.'}
      </Notice>
    )
  }

  return (
    <div className="space-y-3">
      {outcome && <Notice tone={outcome.kind === 'conflict' ? 'info' : 'error'}>{outcome.message}</Notice>}
      <div className="grid gap-2 sm:flex">
        <button type="button" className={primaryButton} disabled={busy} onClick={() => setAsking('APPROVED')}>
          <Check className="h-5 w-5" aria-hidden /> Approve
        </button>
        <button type="button" className={dangerOutlineButton} disabled={busy} onClick={() => setAsking('REJECTED')}>
          <X className="h-5 w-5" aria-hidden /> Reject
        </button>
      </div>
      <ConfirmDialog
        open={!!asking}
        title={asking === 'APPROVED' ? `Approve ${name}?` : `Reject ${name}?`}
        tone={asking === 'REJECTED' ? 'danger' : 'primary'}
        confirmLabel={asking === 'APPROVED' ? `Approve ${noun}` : `Reject ${noun}`}
        busy={busy}
        body={
          asking && (
            <>
              <p>{EFFECT[subject][asking]}</p>
              {contact && (
                <p>
                  Relay Collective doesn’t notify them automatically. Reach them at <strong>{contact}</strong>.
                </p>
              )}
              {asking === 'REJECTED' && <p>There’s no place to record a reason yet, so note it wherever your team keeps review notes.</p>}
            </>
          )
        }
        onConfirm={() => asking && void decide(asking)}
        onCancel={() => setAsking(undefined)}
      />
    </div>
  )
}

import { useCallback, useRef, useState } from 'react'
import type { ReviewSubject } from '../logic/adminSummary'
import { VERIFICATION_TEXT } from '../logic/adminSummary'
import { dataService } from '../services'
import type { VerificationStatus } from '../types'
import { useApp } from './useApp'

export type ReviewOutcome =
  | { kind: 'done'; status: VerificationStatus }
  | { kind: 'conflict'; message: string } // someone else decided first; nothing was changed
  | { kind: 'error'; message: string }

// Approves or rejects one application. Reads the latest status first, so a decision another admin
// already made isn't overwritten, and ignores a second click while the first is still running.
// The database checks the caller is a platform admin either way.
export function useReview() {
  const { refresh, users } = useApp()
  const [busy, setBusy] = useState(false)
  const running = useRef(false)

  const review = useCallback(
    async (subject: ReviewSubject, id: string, status: VerificationStatus): Promise<ReviewOutcome> => {
      if (running.current) return { kind: 'error', message: 'This decision is already being saved.' }
      running.current = true
      setBusy(true)
      try {
        const current =
          subject === 'ORGANIZATION'
            ? (await dataService.listOrganizations()).find((o) => o.id === id)
            : (await dataService.listDrivers()).find((d) => d.id === id)
        if (!current) return { kind: 'conflict', message: 'This application no longer exists. It may have been removed.' }
        if (current.status !== 'PENDING') {
          const by = users.find((u) => u.id === current.reviewedBy)?.name
          return {
            kind: 'conflict',
            message: `This was already reviewed${by ? ` by ${by}` : ''}: ${VERIFICATION_TEXT[current.status].toLowerCase()}. Nothing was changed.`,
          }
        }
        if (subject === 'ORGANIZATION') await dataService.setOrgStatus(id, status)
        else await dataService.setDriverStatus(id, status)
        return { kind: 'done', status }
      } catch (err) {
        return { kind: 'error', message: err instanceof Error ? err.message : "We couldn't save this decision. Please try again." }
      } finally {
        running.current = false
        setBusy(false)
        refresh() // show the latest state, whatever happened
      }
    },
    [refresh, users],
  )

  return { review, busy }
}

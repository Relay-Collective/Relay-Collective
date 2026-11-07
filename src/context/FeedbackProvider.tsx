import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { FeedbackDialog } from '../components/feedback/FeedbackDialog'
import { hasUnseenUpdate, markFeedbackSeen, readSeenFeedback } from '../feedback/seen'
import { useApp } from '../hooks/useApp'
import { useLoadable } from '../hooks/useLoadable'
import { dataService } from '../services'
import type { ProductFeedback } from '../types'
import { FeedbackContext, type FeedbackOpenOptions } from './feedbackContext'

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useApp()
  const userId = currentUser?.id ?? ''
  // Admins see everyone's feedback in the console instead
  const tracksOwn = !!currentUser && currentUser.role !== 'PLATFORM_ADMIN'
  const mine = useLoadable(() => (tracksOwn ? dataService.listMyProductFeedback() : Promise.resolve([])), tracksOwn ? userId : '')
  const [seen, setSeen] = useState(() => ({ userId, map: readSeenFeedback(userId) }))
  if (seen.userId !== userId) setSeen({ userId, map: readSeenFeedback(userId) }) // someone else signed in
  const seenMap = seen.map
  const [request, setRequest] = useState<{ options: FeedbackOpenOptions; key: number }>()

  const openFeedback = useCallback((options: FeedbackOpenOptions = {}) => setRequest((r) => ({ options, key: (r?.key ?? 0) + 1 })), [])
  const isUnseen = useCallback((f: ProductFeedback) => hasUnseenUpdate(f, seenMap), [seenMap])
  const markSeen = useCallback(
    (f: ProductFeedback) => {
      if (userId && isUnseen(f)) setSeen({ userId, map: markFeedbackSeen(userId, f) })
    },
    [userId, isUnseen],
  )
  const unseenCount = mine.data?.filter(isUnseen).length ?? 0

  const value = useMemo(
    () => ({ openFeedback, canSend: !!currentUser, mine, unseenCount, isUnseen, markSeen }),
    [openFeedback, currentUser, mine, unseenCount, isUnseen, markSeen],
  )

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {currentUser && <FeedbackDialog user={currentUser} request={request} onClosed={() => setRequest(undefined)} />}
    </FeedbackContext.Provider>
  )
}

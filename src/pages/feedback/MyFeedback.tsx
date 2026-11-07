import { ChevronRight, MessageSquarePlus, MessagesSquare } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, FilterTabs } from '../../components/admin/controls'
import { FeedbackStatusBadge, FeedbackTypeLabel, UpdatedPill } from '../../components/feedback/FeedbackBadges'
import { primaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, focusRing, panel } from '../../components/workspace/styles'
import { myFeedbackPaths } from '../../feedback/paths'
import { formatReference, isDone, pageLabel } from '../../feedback/rules'
import { useApp } from '../../hooks/useApp'
import { useFeedback } from '../../hooks/useFeedback'

type Show = 'all' | 'open' | 'done'

// The signed-in person's own feedback and where each piece stands. Only ever their own: the backend
// returns nothing else, whatever this page asks for.
export function MyFeedback() {
  const { currentUser } = useApp()
  const { mine, openFeedback, isUnseen } = useFeedback()
  const [show, setShow] = useState<Show>('all')
  if (!currentUser) return null
  const links = myFeedbackPaths(currentUser.role)
  const all = mine.data ?? []
  const shown = all.filter((f) => show === 'all' || (show === 'done') === isDone(f.status))
  const sendButton = (
    <button type="button" className={`${primaryButton} ${compactButton}`} onClick={() => openFeedback()}>
      <MessageSquarePlus className="h-4 w-4" aria-hidden /> Send Feedback
    </button>
  )

  return (
    <div className="space-y-4">
      <PageHeader title="My Feedback" description="Track your suggestions, reported issues, and improvement requests." actions={all.length > 0 && sendButton} />
      <section aria-label="Your feedback" className={panel}>
        {!mine.data ? (
          mine.error ? <SectionError message="We couldn't load your feedback. Please try again." /> : <SkeletonRows rows={3} label="Loading your feedback" />
        ) : all.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="h-6 w-6" />}
            title="No feedback submitted yet."
            text="Have an idea or noticed something that could work better? Share it with our team."
            action={sendButton}
          />
        ) : (
          <>
            <div className="border-b border-slate-100 p-3 sm:p-4">
              <FilterTabs
                label="Show"
                value={show}
                onChange={setShow}
                options={[
                  { id: 'all' as Show, label: 'All', count: all.length },
                  { id: 'open' as Show, label: 'Open', count: all.filter((f) => !isDone(f.status)).length },
                  { id: 'done' as Show, label: 'Resolved or closed', count: all.filter((f) => isDone(f.status)).length },
                ]}
              />
            </div>
            {shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">Nothing here right now.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {shown.map((f) => (
                  <li key={f.id}>
                    <Link to={links.item(f.id)} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <FeedbackStatusBadge status={f.status} />
                          {isUnseen(f) && <UpdatedPill />}
                          <span className="text-xs text-slate-500">{formatReference(f.reference)}</span>
                        </div>
                        <p className="break-words font-semibold text-rc-navy">{f.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <FeedbackTypeLabel type={f.feedbackType} />
                          <span>
                            Sent <DateText at={f.createdAt} />
                          </span>
                          {f.updatedAt !== f.createdAt && (
                            <span>
                              Updated <DateText at={f.updatedAt} />
                            </span>
                          )}
                          {f.sourcePage && <span className="hidden sm:inline">From {pageLabel(f.sourcePage)}</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}

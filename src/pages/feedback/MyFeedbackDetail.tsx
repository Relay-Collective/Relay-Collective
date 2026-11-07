import { MessageSquareText } from 'lucide-react'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Breadcrumbs, DateText, DetailList } from '../../components/admin/controls'
import { FeedbackStatusBadge, FeedbackTypeLabel } from '../../components/feedback/FeedbackBadges'
import { FeedbackScreenshot } from '../../components/feedback/FeedbackScreenshot'
import { FeedbackTimeline } from '../../components/feedback/FeedbackTimeline'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { myFeedbackPaths } from '../../feedback/paths'
import { formatReference, pageLabel, STATUS_MEANINGS } from '../../feedback/rules'
import { useApp } from '../../hooks/useApp'
import { useFeedback } from '../../hooks/useFeedback'
import { useLoadable } from '../../hooks/useLoadable'
import { dataService } from '../../services'

// One of the signed-in person's feedback items: what they sent, where it stands, and the team's public replies.
// Internal notes and who on the team is handling it are never sent to this page.
export function MyFeedbackDetail() {
  const { id = '' } = useParams()
  const { currentUser } = useApp()
  const { markSeen } = useFeedback()
  // null: not this person's feedback (or not there at all); undefined: still loading
  const thread = useLoadable(() => dataService.getMyProductFeedback(id).then((t) => t ?? null), id)
  const feedback = thread.data?.feedback

  // Opening it counts as having seen its latest update
  useEffect(() => {
    if (feedback) markSeen(feedback)
  }, [feedback, markSeen])

  if (!currentUser) return null
  const links = myFeedbackPaths(currentUser.role)
  const crumbs = [{ label: 'My Feedback', to: links.list }, { label: feedback ? formatReference(feedback.reference) : 'Feedback' }]

  if (!thread.data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={crumbs} />
        <section className={panel}>
          {thread.error ? (
            <SectionError message="We couldn't load this feedback. Please try again." />
          ) : thread.data === null ? (
            <EmptyState icon={<MessageSquareText className="h-6 w-6" />} title="Feedback not found" text="It may have been sent from another account." />
          ) : (
            <SkeletonRows rows={3} label="Loading feedback" />
          )}
        </section>
      </div>
    )
  }
  const { messages, history, attachment } = thread.data
  const f = thread.data.feedback

  return (
    <div className="space-y-4">
      <Breadcrumbs items={crumbs} />
      <PageHeader eyebrow={formatReference(f.reference)} title={<span className="break-words">{f.title}</span>} actions={<FeedbackStatusBadge status={f.status} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section aria-labelledby="sent-title" className={panel}>
            <div className={panelHead}>
              <h2 id="sent-title" className={panelTitle}>
                What you sent
              </h2>
            </div>
            <DetailList
              rows={[
                ['Type', <FeedbackTypeLabel type={f.feedbackType} />],
                ['Sent', <DateText at={f.createdAt} withTime />],
                ['Related to', pageLabel(f.sourcePage)],
                ...(f.relatedRelease ? ([['Update', `Version ${f.relatedRelease}`]] as [string, string][]) : []),
              ]}
            />
            <div className="border-t border-slate-100 px-5 py-4">
              <h3 className="text-sm font-medium text-slate-500">Description</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-rc-navy">{f.description}</p>
            </div>
          </section>

          {attachment && (
            <section aria-labelledby="screenshot-title" className={panel}>
              <div className={panelHead}>
                <h2 id="screenshot-title" className={panelTitle}>
                  Screenshot
                </h2>
              </div>
              <div className="p-5">
                <FeedbackScreenshot attachment={attachment} />
              </div>
            </section>
          )}

          <section aria-labelledby="responses-title" className={panel}>
            <div className={panelHead}>
              <h2 id="responses-title" className={panelTitle}>
                Responses
              </h2>
            </div>
            {messages.length === 0 ? (
              <EmptyState icon={<MessageSquareText className="h-6 w-6" />} title="No responses yet" text="Any replies from the Relay Collective team will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {messages.map((m) => (
                  <li key={m.id} className="px-5 py-4">
                    <p className="text-sm font-semibold text-rc-navy">Relay Collective team</p>
                    <p className="text-xs text-slate-500">
                      <DateText at={m.createdAt} withTime />
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-slate-800">{m.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="status-title" className={panel}>
            <div className={panelHead}>
              <h2 id="status-title" className={panelTitle}>
                Status
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <FeedbackStatusBadge status={f.status} />
                <p className="mt-2 text-sm text-slate-700">{STATUS_MEANINGS[f.status]}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Last updated <DateText at={f.updatedAt} withTime />
                </p>
              </div>
              <FeedbackTimeline history={history} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

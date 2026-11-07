import { MessageSquarePlus, MessagesSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { myFeedbackPaths } from '../../feedback/paths'
import { useApp } from '../../hooks/useApp'
import { useFeedback } from '../../hooks/useFeedback'
import { primaryButton, secondaryButton } from '../ui'
import { compactButton, panel, panelHead, panelTitle } from '../workspace/styles'

// The Help pages' way into Feedback & Suggestions
export function FeedbackHelpSection() {
  const { currentUser } = useApp()
  const { openFeedback } = useFeedback()
  if (!currentUser) return null
  return (
    <section aria-labelledby="feedback-help-title" className={panel}>
      <div className={panelHead}>
        <h2 id="feedback-help-title" className={panelTitle}>
          Feedback and suggestions
        </h2>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
        <p>Report a bug, suggest an improvement, or tell us what you think of a recent update. Your feedback goes straight to the Relay Collective team, and you can follow where it stands.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${primaryButton} ${compactButton}`} onClick={() => openFeedback()}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Send feedback
          </button>
          <Link to={myFeedbackPaths(currentUser.role).list} className={`${secondaryButton} ${compactButton}`}>
            <MessagesSquare className="h-4 w-4" aria-hidden /> My feedback
          </Link>
        </div>
      </div>
    </section>
  )
}

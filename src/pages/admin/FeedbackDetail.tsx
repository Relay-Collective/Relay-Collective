import { Lock, LoaderCircle, MessageSquareText, MessagesSquare, Send } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { Breadcrumbs, DateText, DetailList, Notice } from '../../components/admin/controls'
import { FeedbackPriorityBadge, FeedbackStatusBadge, FeedbackTypeLabel } from '../../components/feedback/FeedbackBadges'
import { FeedbackScreenshot } from '../../components/feedback/FeedbackScreenshot'
import { FeedbackTimeline } from '../../components/feedback/FeedbackTimeline'
import { input, label as labelClass, primaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, focusRing, panel, panelTitle } from '../../components/workspace/styles'
import { formatReference, MAX_MESSAGE, pageLabel, PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER, TRIAGE_CONFLICT, validateMessage, WORKSPACE_LABELS } from '../../feedback/rules'
import { useApp } from '../../hooks/useApp'
import { useLoadable } from '../../hooks/useLoadable'
import { ROLE_LABELS } from '../../logic/homeFor'
import { dataService } from '../../services'
import type { TriageChange } from '../../services/dataService'
import type { AdminFeedbackDetail, FeedbackMessage, FeedbackVisibility } from '../../types'

// One submission in full, for platform admins: what was sent and by whom, triage, replies to the submitter,
// internal notes, and every status change. Every change is checked again by the backend.
export function FeedbackDetail() {
  const { id = '' } = useParams()
  // null: no such feedback; undefined: still loading
  const detail = useLoadable(() => dataService.getProductFeedback(id).then((d) => d ?? null), id)
  const crumbs = [{ label: 'Feedback', to: adminPaths.feedback }, { label: detail.data ? formatReference(detail.data.reference) : 'Submission' }]

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={crumbs} />
        <section className={panel}>
          {detail.error ? (
            <SectionError message="We couldn't load this feedback. Please try again." />
          ) : detail.data === null ? (
            <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title="Feedback not found" text="It may have been removed, or the link is wrong." />
          ) : (
            <SkeletonRows rows={4} label="Loading feedback" />
          )}
        </section>
      </div>
    )
  }

  const f = detail.data
  const replies = f.messages.filter((m) => m.visibility === 'public')
  const notes = f.messages.filter((m) => m.visibility === 'internal')

  return (
    <div className="space-y-4">
      <Breadcrumbs items={crumbs} />
      <PageHeader
        eyebrow={formatReference(f.reference)}
        title={<span className="break-words">{f.title}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FeedbackStatusBadge status={f.status} />
            <FeedbackPriorityBadge priority={f.priority} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Panel title="Submission details" id="details">
            <DetailList
              rows={[
                ['Category', <FeedbackTypeLabel type={f.feedbackType} />],
                ['Source workspace', WORKSPACE_LABELS[f.sourceWorkspace]],
                ['Source page', f.sourcePage ? <span title={f.sourcePage}>{pageLabel(f.sourcePage)}</span> : undefined],
                ...(f.relatedRelease ? ([['Update', `Version ${f.relatedRelease}`]] as [string, ReactNode][]) : []),
                ['Submitted', <DateText at={f.createdAt} withTime />],
                ['Last updated', <DateText at={f.updatedAt} withTime />],
                ...(f.resolvedAt ? ([['Resolved', <DateText at={f.resolvedAt} withTime />]] as [string, ReactNode][]) : []),
              ]}
            />
            <div className="border-t border-slate-100 px-5 py-4">
              <h3 className="text-sm font-medium text-slate-500">Description</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-rc-navy">{f.description}</p>
            </div>
          </Panel>

          {f.attachment && (
            <Panel title="Attachment" id="attachment">
              <div className="p-5">
                <FeedbackScreenshot attachment={f.attachment} />
              </div>
            </Panel>
          )}

          <Panel
            title="Responses to submitter"
            id="responses"
            note={`Visible to ${f.submittedBy.name}. Signed as “Relay Collective team”.`}
          >
            <MessageList messages={replies} empty="No responses yet." />
            <Composer feedbackId={f.id} visibility="public" />
          </Panel>

          <Panel
            title="Internal notes"
            id="notes"
            icon={<Lock className="h-4 w-4 text-amber-800" aria-hidden />}
            note="Only Relay Collective admins can see these. Never shown to the submitter."
            tone="internal"
          >
            <MessageList messages={notes} empty="No internal notes yet." />
            <Composer feedbackId={f.id} visibility="internal" />
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Manage" id="manage">
            <Triage feedback={f} />
          </Panel>

          <Panel title="Submitter" id="submitter">
            <DetailList
              rows={[
                [
                  'Name',
                  <span className="flex flex-wrap items-center gap-2">
                    <Link to={adminPaths.user(f.submittedBy.id)} className={`rounded font-semibold text-rc-blue hover:underline ${focusRing}`}>
                      {f.submittedBy.name}
                    </Link>
                    {!f.submittedBy.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Account closed</span>}
                  </span>,
                ],
                ['Email', f.submittedBy.email],
                ['Role', ROLE_LABELS[f.submittedBy.role]],
                [
                  'Organization',
                  f.organization ? (
                    <Link to={adminPaths.organization(f.organization.id)} className={`rounded font-semibold text-rc-blue hover:underline ${focusRing}`}>
                      {f.organization.name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">None</span>
                  ),
                ],
              ]}
            />
          </Panel>

          <Panel title="History" id="history">
            <div className="p-5">
              <FeedbackTimeline history={f.history} showWho />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, id, note, icon, tone, children }: { title: string; id: string; note?: string; icon?: ReactNode; tone?: 'internal'; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`${panel} ${tone === 'internal' ? 'border-amber-200' : ''}`}>
      <div className={`flex flex-col gap-1 border-b px-5 py-4 ${tone === 'internal' ? 'rounded-t-xl border-amber-200 bg-sun-50' : 'border-slate-100'}`}>
        <h2 id={`${id}-title`} className={`${panelTitle} flex items-center gap-2`}>
          {icon}
          {title}
        </h2>
        {note && <p className="text-xs text-slate-600">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function MessageList({ messages, empty }: { messages: FeedbackMessage[]; empty: string }) {
  if (messages.length === 0) {
    return (
      <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500">
        <MessageSquareText className="h-4 w-4" aria-hidden /> {empty}
      </p>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {messages.map((m) => (
        <li key={m.id} className="px-5 py-4">
          <p className="text-sm font-semibold text-rc-navy">{m.authorName ?? 'Relay Collective admin'}</p>
          <p className="text-xs text-slate-500">
            <DateText at={m.createdAt} withTime />
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{m.message}</p>
        </li>
      ))}
    </ul>
  )
}

// Writes a reply or a note. A reply is worded as from the team: it reaches someone outside Relay Collective.
function Composer({ feedbackId, visibility }: { feedbackId: string; visibility: FeedbackVisibility }) {
  const { refresh } = useApp()
  const fieldId = useId()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const isReply = visibility === 'public'

  async function send(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const problem = validateMessage(text)
    setError(problem)
    if (problem) return
    setBusy(true)
    setSent(false)
    try {
      await dataService.addFeedbackMessage(feedbackId, text.trim(), visibility)
      setText('')
      setSent(true)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t save your message.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void send(e)} noValidate className="space-y-2 border-t border-slate-100 px-5 py-4">
      <label htmlFor={fieldId} className={labelClass}>
        {isReply ? 'Reply to submitter' : 'Add an internal note'}
      </label>
      <textarea
        id={fieldId}
        rows={3}
        className={`${input} min-h-24 resize-y py-3 text-sm`}
        value={text}
        maxLength={MAX_MESSAGE + 100}
        onChange={(e) => {
          setText(e.target.value)
          setSent(false)
        }}
        placeholder={isReply ? 'Thank you for reporting this. We’ve identified the issue and are reviewing a fix.' : 'Discussed with the development team. Similar requests received from two organizations.'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
      />
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500" role="status">
          {sent ? (isReply ? 'Reply sent. The submitter can see it now.' : 'Note saved.') : isReply ? 'Avoid internal or technical details the submitter doesn’t need.' : ''}
        </p>
        <button type="submit" className={`${primaryButton} ${compactButton}`} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : isReply ? <Send className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
          {busy ? 'Saving…' : isReply ? 'Send reply' : 'Save note'}
        </button>
      </div>
    </form>
  )
}

// Status, priority and assignment. Each saves as soon as it's chosen, against what this screen showed:
// if another admin changed it meanwhile, nothing is overwritten and the latest is loaded instead.
function Triage({ feedback }: { feedback: AdminFeedbackDetail }) {
  const { refresh } = useApp()
  const assignees = useLoadable(() => dataService.listFeedbackAssignees())
  const [saving, setSaving] = useState<TriageChange['field']>()
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string }>()

  async function save(change: TriageChange, done: string) {
    setSaving(change.field)
    setResult(undefined)
    try {
      await dataService.updateFeedbackTriage(feedback.id, change)
      setResult({ tone: 'success', text: done })
    } catch (err) {
      const text = err instanceof Error ? err.message : 'We couldn’t save that change.'
      setResult({ tone: 'error', text: text === TRIAGE_CONFLICT ? `${text} The latest details are shown now.` : text })
    } finally {
      setSaving(undefined)
      refresh() // after a conflict too, so the screen shows the other admin's decision
    }
  }

  const control = (field: TriageChange['field'], text: string, select: ReactNode) => (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-rc-navy">
        {text}
        {saving === field && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-500" aria-label="Saving" />}
      </span>
      {select}
    </label>
  )
  const selectClass = `${input} min-h-11 text-sm`
  // An assignee who is no longer an admin still shows, so the select never misstates the record
  const people = assignees.data ?? []
  const assigneeOptions = feedback.assignedTo && !people.some((p) => p.id === feedback.assignedTo!.id) ? [...people, feedback.assignedTo] : people

  return (
    <div className="space-y-4 p-5">
      {control(
        'status',
        'Status',
        <select
          className={selectClass}
          value={feedback.status}
          disabled={!!saving}
          onChange={(e) => {
            const value = e.target.value as AdminFeedbackDetail['status']
            void save({ field: 'status', expected: feedback.status, value }, `Status changed to ${STATUS_LABELS[value]}.`)
          }}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>,
      )}
      {control(
        'priority',
        'Priority',
        <select
          className={selectClass}
          value={feedback.priority ?? ''}
          disabled={!!saving}
          onChange={(e) => {
            const value = (e.target.value || undefined) as AdminFeedbackDetail['priority']
            void save({ field: 'priority', expected: feedback.priority, value }, value ? `Priority set to ${PRIORITY_LABELS[value]}.` : 'Priority cleared.')
          }}
        >
          <option value="">Not set</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>,
      )}
      {control(
        'assignedTo',
        'Assigned to',
        <select
          className={selectClass}
          value={feedback.assignedTo?.id ?? ''}
          disabled={!!saving || !assignees.data}
          onChange={(e) => {
            const value = e.target.value || undefined
            const name = assigneeOptions.find((p) => p.id === value)?.name
            void save({ field: 'assignedTo', expected: feedback.assignedTo?.id, value }, name ? `Assigned to ${name}.` : 'Unassigned.')
          }}
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>,
      )}
      {assignees.error && <p className="text-xs text-red-700">We couldn't load the list of admins.</p>}
      {result && (
        <Notice tone={result.tone} onDismiss={() => setResult(undefined)}>
          {result.text}
        </Notice>
      )}
    </div>
  )
}

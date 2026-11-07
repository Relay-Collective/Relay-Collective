import { MapPin, ShieldAlert } from 'lucide-react'
import type { Ref } from 'react'
import { RELEASES } from '../../changelog'
import { MAX_DESCRIPTION, MAX_TITLE, type FeedbackDraft, type FeedbackErrors } from '../../feedback/rules'
import type { PreparedScreenshot } from '../../feedback/screenshot'
import type { ProductFeedbackType } from '../../types'
import { input, label } from '../ui'
import { FeedbackScreenshotPicker } from './FeedbackScreenshotPicker'
import { FeedbackTypeSelector } from './FeedbackTypeSelector'

interface Props {
  draft: FeedbackDraft
  errors: FeedbackErrors
  onChange: (draft: FeedbackDraft) => void
  screenshot?: PreparedScreenshot
  onScreenshot: (screenshot: PreparedScreenshot | undefined) => void
  pageLabel?: string // where the person was when they opened the form
  disabled?: boolean
  typeRef?: Ref<HTMLInputElement>
  titleRef?: Ref<HTMLInputElement>
  descriptionRef?: Ref<HTMLTextAreaElement>
}

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  const over = length > max
  return (
    <span id={id} className={`text-xs tabular-nums ${over ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
      {length.toLocaleString()}/{max.toLocaleString()}
      <span className="sr-only"> characters</span>
    </span>
  )
}

const RELEASE_DATE = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

// The fields of the feedback form. FeedbackDialog owns the state, sending, and what happens after.
export function FeedbackForm({ draft, errors, onChange, screenshot, onScreenshot, pageLabel, disabled, typeRef, titleRef, descriptionRef }: Props) {
  const set = (changes: Partial<FeedbackDraft>) => onChange({ ...draft, ...changes })
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <FeedbackTypeSelector value={draft.feedbackType} onChange={(feedbackType: ProductFeedbackType) => set({ feedbackType })} error={errors.feedbackType} firstRef={typeRef} />

      {draft.feedbackType === 'release_feedback' && (
        <div>
          <label htmlFor="feedback-release" className={label}>
            Which update? <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <select id="feedback-release" className={input} value={draft.relatedRelease ?? ''} onChange={(e) => set({ relatedRelease: e.target.value || undefined })}>
            <option value="">Not a specific update</option>
            {RELEASES.map((r) => (
              <option key={r.version} value={r.version}>
                Version {r.version} · {RELEASE_DATE(r.date)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="feedback-title" className={label}>
            Title <span className="font-normal text-slate-500">(required)</span>
          </label>
          <Counter id="feedback-title-count" length={draft.title.length} max={MAX_TITLE} />
        </div>
        <input
          ref={titleRef}
          id="feedback-title"
          className={input}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Briefly describe your feedback"
          maxLength={MAX_TITLE + 50} // a paste can run over; the counter and message explain the limit
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={`feedback-title-count${errors.title ? ' feedback-title-error' : ''}`}
        />
        {errors.title && (
          <p id="feedback-title-error" className="mt-1.5 text-sm font-medium text-red-700">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="feedback-description" className={label}>
            Description <span className="font-normal text-slate-500">(required)</span>
          </label>
          <Counter id="feedback-description-count" length={draft.description.length} max={MAX_DESCRIPTION} />
        </div>
        <textarea
          ref={descriptionRef}
          id="feedback-description"
          rows={6}
          className={`${input} min-h-36 resize-y py-3 leading-relaxed`}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Tell us what happened, what you expected, or what could be improved."
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={`feedback-privacy feedback-description-count${errors.description ? ' feedback-description-error' : ''}`}
        />
        {errors.description && (
          <p id="feedback-description-error" className="mt-1.5 text-sm font-medium text-red-700">
            {errors.description}
          </p>
        )}
        <p id="feedback-privacy" className="mt-1.5 flex gap-1.5 text-xs text-slate-600">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
          Please do not include personal or confidential information about clients or other individuals.
        </p>
      </div>

      {pageLabel && (
        <p className="flex items-start gap-2 rounded-xl bg-rc-canvas px-3 py-2.5 text-sm text-slate-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rc-teal" aria-hidden />
          <span>
            <span className="font-semibold text-rc-navy">Related to:</span> {pageLabel}
          </span>
        </p>
      )}

      <FeedbackScreenshotPicker value={screenshot} onChange={onScreenshot} disabled={disabled} />
    </fieldset>
  )
}

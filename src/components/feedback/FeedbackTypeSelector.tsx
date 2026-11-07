import type { Ref } from 'react'
import { FEEDBACK_TYPES } from '../../feedback/rules'
import type { ProductFeedbackType } from '../../types'
import { TYPE_ICON } from './FeedbackBadges'

interface Props {
  value?: ProductFeedbackType
  onChange: (type: ProductFeedbackType) => void
  error?: string
  firstRef?: Ref<HTMLInputElement> // to put focus on the group
}

// The kinds of feedback, as large radio cards. Native radios, so arrow keys move between them.
export function FeedbackTypeSelector({ value, onChange, error, firstRef }: Props) {
  return (
    <fieldset aria-describedby={error ? 'feedback-type-error' : undefined}>
      <legend className="mb-2 text-sm font-semibold text-rc-navy">
        What kind of feedback is this? <span className="font-normal text-slate-500">(required)</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEEDBACK_TYPES.map((t, i) => {
          const Icon = TYPE_ICON[t.id]
          const checked = value === t.id
          return (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                checked ? 'border-rc-blue bg-brand-50' : error ? 'border-red-300 hover:border-red-400' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              } ${i === FEEDBACK_TYPES.length - 1 && FEEDBACK_TYPES.length % 2 ? 'sm:col-span-2' : ''}`}
            >
              <input
                ref={(checked || (!value && i === 0)) ? firstRef : undefined}
                type="radio"
                name="feedback-type"
                value={t.id}
                checked={checked}
                onChange={() => onChange(t.id)}
                className="sr-only"
              />
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-rc-blue text-white' : 'bg-rc-canvas text-rc-navy'}`} aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-rc-navy">{t.label}</span>
                <span className="block text-xs text-slate-600">{t.hint}</span>
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id="feedback-type-error" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

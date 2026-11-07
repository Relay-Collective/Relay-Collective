import type { TextareaHTMLAttributes } from 'react'
import { input, label as labelClass } from '../ui'
import { FieldMessage } from './FieldMessage'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  value: string
  maxLength?: number // shows a live count once the text gets close
}

export function TextAreaField({ id, label, hint, error, optional, value, maxLength, className = '', rows = 4, ...rest }: Props) {
  const messageId = `${id}-message`
  const nearLimit = maxLength !== undefined && value.length > maxLength * 0.8
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional && <span className="ml-1 font-normal text-slate-500">(optional)</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        className={`${input} min-h-28 resize-y py-3 leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        {...rest}
      />
      {nearLimit && (
        <p className={`mt-1 text-right text-xs ${value.length > maxLength ? 'font-semibold text-red-700' : 'text-slate-500'}`} aria-live="polite">
          {value.length} / {maxLength}
        </p>
      )}
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  )
}

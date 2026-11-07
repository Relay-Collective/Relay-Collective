import { ImagePlus, LoaderCircle, ShieldAlert, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatBytes, SCREENSHOT_TYPES } from '../../feedback/rules'
import { prepareScreenshot, type PreparedScreenshot } from '../../feedback/screenshot'
import { focusRing } from '../workspace/styles'

interface Props {
  value?: PreparedScreenshot
  onChange: (screenshot: PreparedScreenshot | undefined) => void
  disabled?: boolean
}

// One optional screenshot. Only a file the person picks: nothing is captured automatically.
export function FeedbackScreenshotPicker({ value, onChange, disabled }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const preview = useMemo(() => (value ? URL.createObjectURL(value.file) : undefined), [value])
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  async function choose(file: File | undefined) {
    if (!file) return
    setError(undefined)
    setChecking(true)
    try {
      onChange(await prepareScreenshot(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That image can’t be used.')
    } finally {
      setChecking(false)
      if (inputRef.current) inputRef.current.value = '' // choosing the same file again still fires
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-rc-navy" id={`${inputId}-label`}>
        Screenshot <span className="font-normal text-slate-500">(optional)</span>
      </p>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
          {preview && <img src={preview} alt="Preview of the screenshot you chose" className="h-14 w-20 shrink-0 rounded-lg border border-slate-100 bg-rc-canvas object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold text-rc-navy">{value.name}</p>
            <p className="text-slate-500">{formatBytes(value.file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            disabled={disabled}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-rc-navy disabled:opacity-50 ${focusRing}`}
            aria-label={`Remove screenshot ${value.name}`}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
            error ? 'border-red-300 bg-red-50/40' : 'border-slate-300 bg-rc-canvas hover:border-rc-blue hover:bg-brand-50'
          } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-rc-blue" aria-hidden>
            {checking ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </span>
          <span>
            <span className="block font-semibold text-rc-navy">{checking ? 'Checking image…' : 'Add a screenshot'}</span>
            <span className="block text-slate-500">PNG, JPEG or WebP, up to 5 MB</span>
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={SCREENSHOT_TYPES.join(',')}
            className="sr-only"
            disabled={disabled || checking}
            aria-labelledby={`${inputId}-label`}
            aria-describedby={`${inputId}-warning${error ? ` ${inputId}-error` : ''}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <p id={`${inputId}-warning`} className="mt-1.5 flex gap-1.5 text-xs text-slate-600">
        <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
        Please avoid including personal, medical, or confidential client information.
      </p>
    </div>
  )
}

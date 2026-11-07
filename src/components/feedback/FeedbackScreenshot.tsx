import { Download, ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes } from '../../feedback/rules'
import { dataService } from '../../services'
import type { FeedbackAttachment } from '../../types'
import { Skeleton } from '../workspace/states'
import { focusRing } from '../workspace/styles'

// A private screenshot, shown through a short-lived link that's only issued to its submitter or an admin.
// Rendered as an image (never opened as a page), and downloaded under its checked name.
export function FeedbackScreenshot({ attachment }: { attachment: FeedbackAttachment }) {
  const [state, setState] = useState<{ path: string; url?: string; error?: string }>({ path: '' })

  useEffect(() => {
    let active = true
    let url: string | undefined
    dataService.getFeedbackScreenshotUrl(attachment).then(
      (u) => {
        url = u
        if (active) setState({ path: attachment.storagePath, url: u })
      },
      (err: unknown) => active && setState({ path: attachment.storagePath, error: err instanceof Error ? err.message : 'The screenshot couldn’t be loaded.' }),
    )
    return () => {
      active = false
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url) // the demo backend's local copy
    }
  }, [attachment])

  const current = state.path === attachment.storagePath ? state : { path: '' }
  if (!attachment.uploadedAt) {
    return <p className="text-sm text-slate-500">A screenshot was chosen, but its upload didn’t finish.</p>
  }
  if (current.error) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-slate-600">
        <ImageOff className="h-4 w-4 shrink-0" aria-hidden /> {current.error}
      </p>
    )
  }
  return (
    <figure className="space-y-2">
      {current.url ? (
        <a href={current.url} target="_blank" rel="noopener noreferrer" className={`block overflow-hidden rounded-xl border border-slate-200 bg-rc-canvas ${focusRing}`}>
          <img src={current.url} alt={`Screenshot attached to this feedback: ${attachment.fileName}`} className="max-h-96 w-full object-contain" referrerPolicy="no-referrer" />
        </a>
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span className="min-w-0 truncate">
          {attachment.fileName} · {formatBytes(attachment.fileSize)}
        </span>
        {current.url && (
          <a href={current.url} download={attachment.fileName} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}>
            <Download className="h-4 w-4" aria-hidden /> Download
          </a>
        )}
      </figcaption>
    </figure>
  )
}

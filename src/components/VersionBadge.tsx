import { Check, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { CURRENT_VERSION, RELEASES, type Release } from '../changelog'
import { useFeedback } from '../hooks/useFeedback'
import { LogoMark } from './brand/LogoMark'

const SEEN_KEY = 'careride-seen-version'

// Kept in this browser only: losing it just means the "new" dot shows once more.
function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'

// A small version chip in the bottom-right corner. Opens the list of recent changes.
// Below desktop it shows only the icon and version, so it covers as little of the page as it can.
export function VersionBadge() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [unseen, setUnseen] = useState(() => readSeenVersion() !== CURRENT_VERSION)
  const [latest, ...earlier] = RELEASES

  function open() {
    dialog.current?.showModal()
    setUnseen(false)
    try {
      localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
    } catch {
      // Ignore: the dot may show again after a reload
    }
  }

  const close = () => dialog.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Version ${CURRENT_VERSION}. See what's new${unseen ? ' (new updates)' : ''}`}
        className={`no-print fixed bottom-[calc(1rem+var(--safe-bottom)+var(--app-bottom-bar,0px))] right-4 z-10 inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-1.5 text-sm font-semibold text-ink shadow-[0_1px_2px_rgb(17_24_32/0.06),0_8px_24px_-12px_rgb(17_24_32/0.25)] transition hover:-translate-y-0.5 hover:border-slate-300 ${focusRing}`}
      >
        <span className="relative">
          <Sparkles className="h-4 w-4 text-brand-500" aria-hidden />
          {unseen && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-coral-400 ring-2 ring-white" aria-hidden />}
        </span>
        <span className="hidden lg:inline">What's new</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">v{CURRENT_VERSION}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="whats-new-title"
        className="m-auto max-h-[min(44rem,calc(100dvh-2rem))] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rc-dialog rounded-[20px] border border-slate-200 bg-white p-0 text-ink shadow-[0_24px_48px_-12px_rgb(17_24_32/0.25)]"
        onClick={(e) => {
          if (e.target === dialog.current) close()
        }}
      >
        {/* The current release leads, on the brand's porcelain ground */}
        <header className="relative overflow-hidden border-b border-slate-200 bg-canvas px-6 pb-7 pt-6 sm:px-8">
          <span className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-500" aria-hidden />
          <span className="pointer-events-none absolute right-24 top-16 h-8 w-8 rounded-full bg-coral-400" aria-hidden />
          <div className="relative flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1.5 pr-3 text-xs font-semibold text-slate-700">
              <LogoMark className="h-5 w-5" />
              Version {latest.version} · {formatDate(latest.date)}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className={`-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 hover:text-ink ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <h2 id="whats-new-title" className="relative mt-6 max-w-[22rem] font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[34px]">
            {latest.title ?? `What's new in ${latest.version}`}
          </h2>
          {latest.summary && (
            <p className="relative mt-2 font-editorial text-[22px] italic leading-snug text-coral-700">{latest.summary}</p>
          )}
        </header>

        <div className="px-6 py-6 sm:px-8">
          <ul className="space-y-3.5">
            {latest.changes.map((change) => (
              <li key={change} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
                </span>
                {change}
              </li>
            ))}
          </ul>
          <ReleaseFeedback release={latest} onBeforeOpen={close} />

          {earlier.length > 0 && (
            <section aria-labelledby="whats-new-earlier" className="mt-8 border-t border-slate-200 pt-6">
              <h3 id="whats-new-earlier" className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                Earlier releases
              </h3>
              <div className="mt-4 space-y-6">
                {earlier.map((release) => (
                  <section key={release.version} aria-label={`Version ${release.version}`}>
                    <h4 className="flex flex-wrap items-baseline gap-x-2.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-ink">{release.version}</span>
                      <span className="text-sm text-slate-500">{formatDate(release.date)}</span>
                    </h4>
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700 marker:text-slate-400">
                      {release.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                    <ReleaseFeedback release={release} onBeforeOpen={close} />
                  </section>
                ))}
              </div>
            </section>
          )}
        </div>
      </dialog>
    </>
  )
}

// Signed-in people can tell us what they think of an update, tied to its version
function ReleaseFeedback({ release, onBeforeOpen }: { release: Release; onBeforeOpen: () => void }) {
  const { canSend, openFeedback } = useFeedback()
  if (!canSend) return null
  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen()
        openFeedback({ type: 'release_feedback', release: release.version })
      }}
      className={`-ml-2 mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 ${focusRing}`}
    >
      <MessageSquarePlus className="h-4 w-4" aria-hidden /> Give feedback on this update
      <span className="sr-only"> (version {release.version})</span>
    </button>
  )
}

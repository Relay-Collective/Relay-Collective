import { Check, LoaderCircle } from 'lucide-react'
import type { SaveState } from '../../hooks/useDriverEdits'
import { ghostButton, primaryButton } from '../ui'

// Fixed under the page once something changes: what's unsaved, and Save or Cancel. Says so when it saved, or why it didn't.
// Sits beside the sidebar and above the phone tab bar.
export function SaveBar({ dirty, state, onSave, onCancel }: { dirty: boolean; state: SaveState; onSave: () => void; onCancel: () => void }) {
  const visible = dirty || state.kind === 'saved' || state.kind === 'error'
  return (
    <div
      className={`native-bottom-chrome no-print fixed bottom-[var(--shell-bottom,0px)] left-[var(--shell-inset,0px)] right-0 z-20 border-t border-slate-200 bg-white ${visible ? '' : 'hidden'}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div aria-live="polite" className="text-sm">
          {state.kind === 'error' ? (
            <p role="alert" className="font-semibold text-red-700">
              {state.message}
            </p>
          ) : dirty ? (
            <p className="font-semibold text-rc-navy">You have unsaved changes.</p>
          ) : state.kind === 'saved' ? (
            <p className="flex items-center gap-2 font-semibold text-emerald-700">
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> Changes saved.
            </p>
          ) : null}
        </div>
        {dirty && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" className={ghostButton} onClick={onCancel} disabled={state.kind === 'saving'}>
              Cancel
            </button>
            <button type="button" className={primaryButton} onClick={onSave} disabled={state.kind === 'saving'}>
              {state.kind === 'saving' && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />}
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

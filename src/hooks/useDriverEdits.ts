import { useEffect, useState } from 'react'
import type { FieldErrors } from '../components/driverDraft'
import { dataService } from '../services'
import type { DriverSettings } from '../services/dataService'
import type { Driver } from '../types'
import { useApp } from './useApp'

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

// Edits to the settings a driver may change themselves. Only touched fields are sent, so a save never
// overwrites a field changed elsewhere in the meantime. The backend decides what may actually change
// (e.g. capacity is locked once approved) and refuses anything else.
export function useDriverEdits<K extends keyof DriverSettings>(driver: Driver | undefined, keys: K[], validate: (s: Pick<DriverSettings, K>) => FieldErrors) {
  const { refresh } = useApp()
  const [edits, setEdits] = useState<Partial<Pick<DriverSettings, K>>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  const saved = Object.fromEntries(keys.map((k) => [k, driver?.[k]])) as Pick<DriverSettings, K>
  const current = { ...saved, ...edits }
  const dirty = Object.keys(edits).length > 0
  const errors = validate(current)
  const hasErrors = Object.values(errors).some(Boolean)

  // Leaving the page (closing the tab, reloading) with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function change(patch: Partial<Pick<DriverSettings, K>>) {
    setEdits((e) => ({ ...e, ...patch }))
    if (state.kind !== 'saving') setState({ kind: 'idle' })
  }

  async function save() {
    if (!driver || !dirty) return
    if (hasErrors) {
      setShowErrors(true)
      return
    }
    setState({ kind: 'saving' })
    try {
      await dataService.updateDriver(driver.id, edits)
      setEdits({})
      setShowErrors(false)
      setState({ kind: 'saved' })
      refresh()
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : "We couldn't save your changes. Please try again." })
    }
  }

  function discard() {
    setEdits({})
    setShowErrors(false)
    setState({ kind: 'idle' })
  }

  return { current, change, dirty, errors: showErrors ? errors : ({} as FieldErrors), save, discard, state }
}

import { useEffect, useState } from 'react'
import { canSearch, normalizeSearch } from '../logic/membership'
import { dataService } from '../services'
import type { OrganizationDirectoryEntry } from '../types'

const DEBOUNCE_MS = 250

export type SearchState =
  | { status: 'idle' } // nothing to search for yet
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; results: OrganizationDirectoryEntry[] }
  | { status: 'error'; query: string; message: string }

// Searches the organization directory as someone types: waits for a pause, asks the backend for a few
// matches, and ignores answers that arrive after a newer search started.
export function useOrganizationSearch(query: string, retry = 0): SearchState {
  const q = normalizeSearch(query)
  const [state, setState] = useState<SearchState>({ status: 'idle' })

  useEffect(() => {
    if (!canSearch(q)) return
    let active = true
    const timer = window.setTimeout(() => {
      setState({ status: 'loading', query: q })
      dataService.searchOrganizations(q).then(
        (results) => active && setState({ status: 'done', query: q, results }),
        (err: unknown) => active && setState({ status: 'error', query: q, message: err instanceof Error ? err.message : 'Something went wrong.' }),
      )
    }, DEBOUNCE_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [q, retry])

  if (!canSearch(q)) return { status: 'idle' }
  // Typed something new and the pause hasn't passed yet: show it as loading, not the old results
  if (state.status === 'idle' || state.query !== q) return { status: 'loading', query: q }
  return state
}

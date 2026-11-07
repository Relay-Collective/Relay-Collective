import { useEffect, useRef, useState } from 'react'
import { useApp } from './useApp'

export interface Loadable<T> {
  data: T | undefined
  error: string | undefined // the last load failed; data (if any) is from the load before
}

const EMPTY = { data: undefined, error: undefined }

// Like useData, but the screen shows its own error instead of the app-wide banner,
// so a dashboard section can say what didn't load and offer "Try again" in place.
// Data loaded for another key (e.g. another account) is never shown.
export function useLoadable<T>(load: () => Promise<T>, key = ''): Loadable<T> {
  const { version } = useApp()
  const [state, setState] = useState<Loadable<T> & { key: string }>({ ...EMPTY, key })
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let active = true
    loadRef.current().then(
      (data) => active && setState({ data, error: undefined, key }),
      (err: unknown) => {
        if (!active) return
        const error = err instanceof Error ? err.message : 'Something went wrong.'
        setState((s) => ({ data: s.key === key ? s.data : undefined, error, key }))
      },
    )
    return () => {
      active = false
    }
  }, [version, key])

  return state.key === key ? state : EMPTY
}

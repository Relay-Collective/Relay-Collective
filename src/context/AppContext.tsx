import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dataService, isDemoBackend } from '../services'
import type { Session } from '../services/dataService'
import type { Identity, User } from '../types'
import { AppContext } from './appContext'
import { clearOnboardingDrafts } from '../onboarding/drafts'
import { DEMO_FRAME_USER as FRAME_USER, DEMO_REFRESH } from './demoFrame'

// The demo has no server, so frequent polling is what moves timed-out requests on and syncs tabs.
// The real backend pushes changes (live updates) and runs deadlines itself; polling is only a safety net.
const POLL_MS = isDemoBackend ? 4000 : 30_000
// Several changes often arrive together (e.g. one booking sends offers to many drivers): reload once.
const LIVE_UPDATE_DEBOUNCE_MS = 300

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User>()
  const [identity, setIdentity] = useState<Identity>()
  const [ready, setReady] = useState(false)
  const [sessionError, setSessionError] = useState<string>()
  const [sessionExpired, setSessionExpired] = useState(false)
  // Who was signed in last, so a session that disappears on its own can be told apart from signing out
  const signedInAs = useRef<string | undefined>(undefined)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [version, setVersion] = useState(0)
  // Failed loads, keyed by the screen part that failed, so one recovering doesn't hide another's error
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({})
  // Only the latest session check may update state, e.g. a sign-in beats a slower restore.
  const sessionRequest = useRef(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const setLoadError = useCallback((key: string, message: string | undefined) => {
    setLoadErrors((current) => {
      if (current[key] === message) return current
      const next = { ...current }
      if (message === undefined) delete next[key]
      else next[key] = message
      return next
    })
  }, [])
  const retrySession = useCallback(() => setSessionVersion((v) => v + 1), [])

  const applySession = useCallback((session: Session | undefined) => {
    const id = session?.identity.id
    // Someone was signed in and now nobody is, without signOut() clearing signedInAs first: the session ended
    if (!id && signedInAs.current) setSessionExpired(true)
    if (id) setSessionExpired(false)
    signedInAs.current = id
    setIdentity(session?.identity)
    setCurrentUser(session?.user)
    if (!session?.user && !isDemoBackend) setUsers([])
    setSessionError(undefined)
  }, [])

  // Ask the backend who is signed in. Only the latest check may update state, e.g. a sign-in beats a slower restore.
  const checkSession = useCallback(async () => {
    const request = ++sessionRequest.current
    try {
      const session = await dataService.restoreSession()
      if (request === sessionRequest.current) applySession(session)
      return session
    } catch (err) {
      if (request === sessionRequest.current) {
        setIdentity(undefined)
        setCurrentUser(undefined)
        setSessionError((err as Error).message)
      }
      throw err
    } finally {
      if (request === sessionRequest.current) setReady(true)
    }
  }, [applySession])

  // On start, and whenever the session changes elsewhere
  useEffect(() => {
    checkSession().catch(() => {}) // shown through sessionError
  }, [sessionVersion, checkSession])

  const reloadSession = useCallback(async () => {
    const session = await checkSession()
    refresh()
    return session
  }, [checkSession, refresh])

  useEffect(() => dataService.onSessionChange(retrySession), [retrySession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const request = ++sessionRequest.current
      let session: Session
      try {
        session = await dataService.signIn(email, password)
      } catch (err) {
        retrySession() // this attempt cancelled any session check in flight; run it again
        throw err
      }
      if (request === sessionRequest.current) {
        applySession(session)
        setReady(true)
      }
      refresh()
      return session
    },
    [refresh, retrySession, applySession],
  )

  const signOut = useCallback(async () => {
    ++sessionRequest.current
    signedInAs.current = undefined // on purpose, so not an expired session
    try {
      await dataService.signOut()
    } finally {
      // Clear this screen even if the backend call failed, so private data doesn't linger
      clearOnboardingDrafts()
      setSessionExpired(false)
      setIdentity(undefined)
      setCurrentUser(undefined)
      setSessionError(undefined)
      setUsers([])
      setLoadErrors({})
      setReady(true)
      refresh()
    }
  }, [refresh])

  useEffect(() => {
    // The sign-in page needs the sample accounts. On the real backend, asking for
    // every profile while signed out is refused, so wait until someone is signed in.
    if (!isDemoBackend && !currentUser) return
    let active = true
    dataService.listUsers().then(
      (list) => active && setUsers(list),
      () => active && setUsers([]), // e.g. signed out on the real backend
    )
    return () => {
      active = false
    }
  }, [version, currentUser])

  // Keep two open tabs (e.g. a house and a driver) in sync during the demo.
  // In a /demo frame, the deck says when instead.
  useEffect(() => {
    if (FRAME_USER) {
      const onMessage = (e: MessageEvent) => {
        if (e.source === window.parent && e.data === DEMO_REFRESH) refresh()
      }
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [refresh])

  // Live updates while signed in: reload when rides, requests or approvals change elsewhere.
  // Subscribed per person, so signing out (or in as someone else) drops the old subscription.
  const userId = currentUser?.id
  useEffect(() => {
    if (!userId) return
    let timer: number | undefined
    const unsubscribe = dataService.onDataChange(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, LIVE_UPDATE_DEBOUNCE_MS)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [userId, refresh])

  // A safety net for anything live updates missed, plus catching up when someone comes back to the tab.
  // In a /demo frame the deck decides when to refresh, so frames don't poll.
  useEffect(() => {
    if (!userId || FRAME_USER) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  const loadError = Object.values(loadErrors)[0]

  const value = useMemo(
    () => ({
      users,
      identity,
      currentUser,
      ready,
      sessionError,
      sessionExpired,
      signIn,
      signOut,
      retrySession,
      reloadSession,
      version,
      refresh,
      loadError,
      setLoadError,
    }),
    [users, identity, currentUser, ready, sessionError, sessionExpired, signIn, signOut, retrySession, reloadSession, version, refresh, loadError, setLoadError],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

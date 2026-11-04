import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { focusRing, focusRingNight } from '../workspace/styles'
import type { SidebarMode } from './SidebarNav'

export const DRAWER_ID = 'app-drawer'

export interface SidebarSlotProps {
  mode: SidebarMode
  onNavigate?: () => void
  onToggleCollapse?: () => void
}

interface Props {
  storageKey: string // where the collapsed choice is remembered
  sidebar: (props: SidebarSlotProps) => ReactNode
  header: (props: { onOpenMenu: () => void; menuOpen: boolean }) => ReactNode
  banner?: ReactNode // e.g. a "waiting for approval" strip under the header
  footer?: ReactNode
  bottomBar?: ReactNode // phones only: a tab bar fixed to the bottom of the screen
  maxWidth?: string
  children: ReactNode
}

// A remembered layout choice only. Storage can be blocked, so it falls back to open.
function readCollapsed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Not remembered next time; nothing else depends on it
  }
}

// The frame of a signed-in console. Desktop: a sidebar that can collapse to icons.
// Tablet: the icon rail. Phone: a drawer from the menu button.
// Console 2.0: from the tablet breakpoint the sidebar is the night frame, and the workspace is a porcelain sheet
// set into it, with one rounded corner where the two meet. Phones have no frame: the sheet is the whole screen.
export function SidebarShell({ storageKey, sidebar, header, banner, footer, bottomBar, maxWidth = 'max-w-6xl', children }: Props) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeCollapsed(storageKey, !c)
      return !c
    })
  }

  // Bars fixed to the bottom of a page (e.g. the booking form's send button) start after the sidebar
  const inset = collapsed ? 'md:[--shell-inset:4.5rem]' : 'md:[--shell-inset:4.5rem] lg:[--shell-inset:16rem]'

  // With a phone tab bar, bars fixed to the bottom of a page sit above it (--shell-bottom)
  const bottom = bottomBar ? 'max-md:[--shell-bottom:calc(4rem+var(--safe-bottom))] max-md:pb-[calc(4rem+var(--safe-bottom))]' : ''

  return (
    <div className={`workspace min-h-screen bg-canvas md:bg-night ${inset} ${bottom}`}>
      <a
        href="#app-main"
        className={`sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold text-rc-navy focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focusRing}`}
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className={`rc-night no-print fixed inset-y-0 left-0 z-30 hidden bg-night pt-[var(--safe-top)] transition-[width] duration-[220ms] ease-out-quart md:block md:w-[4.5rem] ${collapsed ? '' : 'lg:w-64'}`}
      >
        {sidebar({ mode: collapsed ? 'rail' : 'responsive', onToggleCollapse: toggleCollapsed })}
      </aside>

      <NavDrawer open={drawerOpen} onClose={closeDrawer}>
        {sidebar({ mode: 'full', onNavigate: closeDrawer })}
      </NavDrawer>

      <div className="flex min-h-screen flex-col transition-[padding] duration-[220ms] ease-out-quart md:pl-[var(--shell-inset)]">
        {/* The sheet: porcelain, with its top-left corner turned where it meets the frame. The header carries the
            same corner (with night behind it), so the turn stays put while the page scrolls under it. */}
        <div className="flex min-h-screen flex-1 flex-col bg-canvas md:rounded-tl-[28px]">
          {header({ onOpenMenu: () => setDrawerOpen(true), menuOpen: drawerOpen })}
          {banner}
          <main id="app-main" tabIndex={-1} className={`rc-page mx-auto w-full ${maxWidth} flex-1 px-4 pb-24 pt-6 focus:outline-none sm:px-6 lg:px-10 lg:pt-10`}>
            {children}
          </main>
          {footer && <div className={`mx-auto w-full ${maxWidth} px-4 pb-10 sm:px-6 lg:px-10`}>{footer}</div>}
        </div>
      </div>

      {bottomBar && (
        <div data-bottom-bar className="rc-night native-bottom-chrome no-print fixed inset-x-0 bottom-0 z-20 bg-night pb-[var(--safe-bottom)] md:hidden">
          {bottomBar}
        </div>
      )}
    </div>
  )
}

// Phones: the full sidebar in a modal drawer. A modal dialog keeps focus inside and closes on Escape.
function NavDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The drawer only exists below the tablet breakpoint; widening the window closes it
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const onChange = () => query.matches && onClose()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      id={DRAWER_ID}
      aria-label="Navigation"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // a tap on the backdrop
      className="rc-night no-print m-0 h-full max-h-none w-[min(20rem,85vw)] max-w-none rc-drawer bg-night p-0 pt-[var(--safe-top)] shadow-[8px_0_40px_-8px_rgb(0_0_0/0.45)] md:hidden"
    >
      <div className="relative h-full">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className={`absolute right-2 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-night-raised hover:text-white ${focusRingNight}`}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {open && children}
      </div>
    </dialog>
  )
}

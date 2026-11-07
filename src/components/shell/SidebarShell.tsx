import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { focusRing } from '../workspace/styles'
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
// Console 2.1: the landing page's world at work. A white sidebar with a hairline edge beside the porcelain sheet,
// and the landing's still hairline grid behind the top of every page, fading out before the work gets dense.
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
    <div className={`workspace min-h-screen bg-canvas ${inset} ${bottom}`}>
      <a
        href="#app-main"
        className={`sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold text-rc-navy focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focusRing}`}
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className={`no-print fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white pt-[var(--safe-top)] transition-[width] duration-[220ms] ease-out-quart md:block md:w-[4.5rem] ${collapsed ? '' : 'lg:w-64'}`}
      >
        {sidebar({ mode: collapsed ? 'rail' : 'responsive', onToggleCollapse: toggleCollapsed })}
      </aside>

      <NavDrawer open={drawerOpen} onClose={closeDrawer}>
        {sidebar({ mode: 'full', onNavigate: closeDrawer })}
      </NavDrawer>

      <div className="flex min-h-screen flex-col transition-[padding] duration-[220ms] ease-out-quart md:pl-[var(--shell-inset)]">
        {/* The sheet: porcelain, with the grid behind its top. The header is clear over the grid until the page scrolls.
            No stacking context here: bars fixed inside the page (a save bar) must still rise above the version chip.
            The grid paints first, and the banner and main are positioned after it, so they paint over it. */}
        <div className="relative flex min-h-screen flex-1 flex-col bg-canvas">
          <div className="rc-grid pointer-events-none absolute inset-x-0 top-0 h-[440px] max-sm:h-[300px]" aria-hidden />
          {header({ onOpenMenu: () => setDrawerOpen(true), menuOpen: drawerOpen })}
          {banner && <div className="relative">{banner}</div>}
          <main id="app-main" tabIndex={-1} className={`rc-page relative mx-auto w-full ${maxWidth} flex-1 px-4 pb-24 pt-6 focus:outline-none sm:px-6 lg:px-10 lg:pt-10`}>
            {children}
          </main>
          {footer && <div className={`relative mx-auto w-full ${maxWidth} px-4 pb-10 sm:px-6 lg:px-10`}>{footer}</div>}
        </div>
      </div>

      {bottomBar && (
        <div
          data-bottom-bar
          className="native-bottom-chrome no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white pb-[var(--safe-bottom)] shadow-[0_-10px_30px_-22px_rgb(17_24_32/0.35)] md:hidden"
        >
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
      className="no-print m-0 h-full max-h-none w-[min(20rem,85vw)] max-w-none rc-drawer border-r border-slate-200/80 bg-white p-0 pt-[var(--safe-top)] shadow-[12px_0_40px_-16px_rgb(17_24_32/0.3)] md:hidden"
    >
      <div className="relative h-full">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className={`absolute right-2 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 ease-out-quart hover:bg-slate-100 hover:text-ink ${focusRing}`}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {open && children}
      </div>
    </dialog>
  )
}

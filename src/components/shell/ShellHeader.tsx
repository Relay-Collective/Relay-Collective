import { ChevronRight, Menu } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { focusRing } from '../workspace/styles'
import { DRAWER_ID } from './SidebarShell'

interface Props {
  onOpenMenu: () => void
  menuOpen: boolean
  context: ReactNode // whose space this is, e.g. the organization's name
  title: string // the section you're in
  children?: ReactNode // actions on the right: a primary action, search, the account menu
}

// The bar above every console page. One line: whose space, then the section, so it never competes with the
// page's own h1. Phones show the section alone; the drawer carries the rest.
// As on the landing page, the bar is clear over the grid at the top of the page and turns white, with a hairline,
// once the page scrolls under it.
export function ShellHeader({ onOpenMenu, menuOpen, context, title, children }: Props) {
  const scrolled = useScrolled()
  return (
    <header
      data-scrolled={scrolled || undefined}
      className={`no-print sticky top-0 z-20 border-b pt-[var(--safe-top)] transition-[background-color,border-color] duration-200 ease-out-quart ${
        scrolled ? 'border-slate-200/80 bg-white' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls={DRAWER_ID}
          className={`-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-rc-navy transition-colors duration-150 hover:bg-slate-100 md:hidden ${focusRing}`}
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>

        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px]">
          <span className="hidden min-w-0 shrink truncate font-medium text-slate-500 sm:block">{context}</span>
          <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden />
          <span className="min-w-0 truncate font-heading font-semibold tracking-[-0.01em] text-rc-navy max-sm:text-base">{title}</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </header>
  )
}

// Whether the page has scrolled at all. Checked once on mount too, so a restored scroll position starts solid.
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const check = () => setScrolled(window.scrollY > 4)
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])
  return scrolled
}

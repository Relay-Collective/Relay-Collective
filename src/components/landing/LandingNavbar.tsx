import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LINKS, NAV } from './content'
import { useScrolledPast } from './hooks'
import { Wordmark } from './primitives'
import { ctaArrow, ctaGhost, ctaPrimary, focusRing } from './styles'

// Public website header. Jump links to each part of the page, and the two ways into the app.
// Clear at the top, so the hero's mesh runs under it; solid white once the page scrolls.
export function LandingNavbar({ active }: { active?: string }) {
  const [open, setOpen] = useState(false)
  const scrolled = useScrolledPast(24)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // While the drawer is open: Escape closes it, the page behind stays still, and focus moves inside
  useEffect(() => {
    if (!open) return
    const toggle = toggleRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key !== 'Tab' || !drawerRef.current) return
      // Keep Tab inside the drawer and its close button
      const items = [toggle, ...drawerRef.current.querySelectorAll<HTMLElement>('a, button')].filter(Boolean) as HTMLElement[]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLElement>('a')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      toggle?.focus()
    }
  }, [open])

  // The drawer only exists below the desktop breakpoint; widening the window closes it
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = () => query.matches && setOpen(false)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const close = () => setOpen(false)
  const compact = scrolled || open

  return (
    <header
      className={`rcl-fade sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300 ${
        compact ? 'border-hairline bg-white' : 'border-transparent bg-transparent'
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 lg:px-10 ${
          compact ? 'h-16' : 'h-[76px]'
        }`}
      >
        <Wordmark onClick={close} />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 lg:block" aria-label="Main">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const current = active === item.id
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={current ? 'location' : undefined}
                    className={`relative inline-flex min-h-11 items-center rounded-full px-4 font-dm text-[15px] font-medium transition-colors duration-200 ${focusRing} ${
                      current ? 'text-midnight' : 'text-midnight-soft hover:bg-midnight/[0.05] hover:text-midnight'
                    }`}
                  >
                    {item.label}
                    <span
                      className={`absolute bottom-1 left-4 right-4 h-[2px] origin-left rounded-full bg-electric transition-transform duration-300 ${current ? 'scale-x-100' : 'scale-x-0'}`}
                      aria-hidden
                    />
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to={LINKS.signIn}
            className={`inline-flex min-h-11 min-w-12 items-center justify-center rounded-full px-3 font-dm text-[15px] font-medium text-midnight transition-colors hover:bg-midnight/[0.05] sm:px-4 ${focusRing}`}
          >
            Log in
          </Link>
          {/* The shared button class sets inline-flex, so a wrapper does the hiding on phones */}
          <span className="hidden sm:block">
            <Link to={LINKS.register} className={`${ctaPrimary} min-h-11 px-5`}>
              Get Started <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
          </span>
          <button
            ref={toggleRef}
            type="button"
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-white text-midnight transition-colors hover:border-midnight/30 lg:hidden ${focusRing}`}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="site-menu"
          ref={drawerRef}
          className="fixed inset-x-0 bottom-0 top-16 z-40 flex animate-fade-up flex-col overflow-y-auto bg-white px-4 pb-[max(1.5rem,var(--safe-bottom))] pt-6 [animation-duration:280ms] sm:px-6 lg:hidden"
        >
          <nav aria-label="Main">
            <ul className="border-t border-hairline">
              {NAV.map((item) => (
                <li key={item.id} className="border-b border-hairline">
                  <a
                    href={`#${item.id}`}
                    onClick={close}
                    aria-current={active === item.id ? 'location' : undefined}
                    className={`flex min-h-[68px] items-center justify-between gap-4 rounded-lg px-1 font-grotesk text-[30px] font-medium tracking-[-0.035em] text-midnight ${focusRing}`}
                  >
                    {item.label}
                    <ArrowRight className="h-5 w-5 text-electric-ink" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto grid gap-3 pt-10">
            <Link to={LINKS.register} onClick={close} className={`${ctaPrimary} w-full`}>
              Get Started <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
            <Link to={LINKS.signIn} onClick={close} className={`${ctaGhost} w-full`}>
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

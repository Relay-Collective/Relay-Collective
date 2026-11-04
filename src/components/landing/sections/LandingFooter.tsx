import { LINKS, MISSION, PARTNER, TAGLINE } from '../content'
import { SmartLink, Wordmark } from '../primitives'
import { container, focusRing } from '../styles'

const COLUMNS: { title: string; id?: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Log in', href: LINKS.signIn },
      { label: 'Create an account', href: LINKS.register },
      { label: 'Register your organization', href: LINKS.registerOrg },
      { label: 'Volunteer as a driver', href: LINKS.registerDriver },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Modules', href: '#solutions' },
      { label: 'Workspaces', href: '#showcase' },
      { label: 'A ride, start to finish', href: '#ride' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Impact', href: '#impact' },
    ],
  },
  {
    title: 'Resources',
    id: 'resources',
    links: [
      { label: 'CareRide tour', href: LINKS.transportTour },
      { label: 'GitHub', href: LINKS.github },
      { label: 'Source code', href: LINKS.repo },
      { label: 'MIT License', href: LINKS.license },
    ],
  },
]

const link = `inline-flex min-h-11 items-center rounded font-dm text-[15px] text-midnight-soft underline-offset-4 transition-colors duration-200 hover:text-midnight hover:underline ${focusRing}`

// 08: who we are, every way in, and the fine print, kept factual
export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-porcelain text-midnight">
      <div className={`${container} grid gap-14 pb-16 pt-20 sm:pt-24 lg:grid-cols-12 lg:gap-8`}>
        <div className="lg:col-span-4">
          <Wordmark />
          <p className="mt-8 font-grotesk text-2xl font-medium tracking-[-0.03em] text-balance text-midnight">{TAGLINE}</p>
          <p className="mt-4 max-w-sm font-dm text-[15px] leading-relaxed text-midnight-soft">{MISSION}</p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:col-start-6">
          {COLUMNS.map((col) => (
            <nav key={col.title} id={col.id} aria-label={`Footer: ${col.title}`} className={col.id ? 'scroll-mt-24' : undefined}>
              <p className="font-grotesk text-[15px] font-semibold tracking-[-0.01em] text-midnight">{col.title}</p>
              <ul className="mt-3 space-y-0.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <SmartLink href={l.href} className={link}>
                      {l.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className={container}>
        <div className="flex flex-col gap-4 border-t border-hairline py-8 font-dm text-sm leading-relaxed text-hush lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <p className="shrink-0">© {new Date().getFullYear()} Relay Collective</p>
          <p className="max-w-xl lg:text-right">
            Born at FaithTech HACKVAN 2026 and developed in partnership with {PARTNER.name} – {PARTNER.program}. Relay Collective is an
            independent platform. It is not an emergency service: in an emergency, call 911.
          </p>
        </div>
      </div>

      {/* The name, once more, as architecture */}
      <p
        className="pointer-events-none -mb-[0.22em] select-none whitespace-nowrap text-center font-grotesk text-[12.6vw] font-semibold leading-none tracking-[-0.06em] text-midnight/[0.05]"
        aria-hidden
      >
        Relay Collective
      </p>
    </footer>
  )
}

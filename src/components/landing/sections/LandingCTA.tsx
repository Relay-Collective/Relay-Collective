import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LINKS } from '../content'
import { Accent, ExternalIcon, Reveal, SmartLink } from '../primitives'
import { container, ctaArrow, ctaGhostOnBlue, ctaOnBlue, display } from '../styles'

const MORE: { label: string; href: string; external?: boolean }[] = [
  { label: 'Register your organization', href: LINKS.registerOrg },
  { label: 'Become a volunteer', href: LINKS.registerVolunteer },
  { label: 'Build with us on GitHub', href: LINKS.repo, external: true },
]

// 07: the close. Electric blue, the one loud surface on the page.
// Midnight text on electric is 5.5:1; the white accent word is display size, where 3:1 is enough (3.2:1).
export function LandingCTA() {
  return (
    <section aria-labelledby="cta-heading" className="relative overflow-hidden bg-electric text-midnight">
      {/* The hero's ground, turned around: porcelain and cantaloupe discs on the blue */}
      <span className="pointer-events-none absolute -bottom-48 -right-40 h-[560px] w-[560px] rounded-full bg-porcelain/15 sm:h-[720px] sm:w-[720px]" aria-hidden />
      <span className="pointer-events-none absolute bottom-24 right-[12%] hidden h-24 w-24 rounded-full bg-cantaloupe lg:block" aria-hidden />

      <div className={`${container} relative py-24 sm:py-28 lg:py-40`}>
        <Reveal className="max-w-4xl">
          <h2 id="cta-heading" className={`${display} text-[clamp(42px,6.6vw,96px)] leading-[0.98]`}>
            Let’s build stronger communities, <Accent className="text-white">together.</Accent>
          </h2>
          <p className="mt-8 max-w-xl font-dm text-lg leading-relaxed text-midnight sm:text-xl">
            Bring your organization onto shared infrastructure, give your time as a volunteer, and help shape what comes next.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to={LINKS.register} className={ctaOnBlue}>
              Get Started <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
            <Link to={LINKS.transportTour} className={ctaGhostOnBlue}>
              Tour the first module <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
          </div>
          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-2 border-t border-midnight/25 pt-6">
            {MORE.map((m) => (
              <li key={m.label}>
                <SmartLink
                  href={m.href}
                  className="group inline-flex min-h-11 items-center gap-1.5 rounded font-dm text-[15px] font-semibold text-midnight underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-midnight"
                >
                  {m.label}
                  {m.external ? <ExternalIcon /> : <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />}
                </SmartLink>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

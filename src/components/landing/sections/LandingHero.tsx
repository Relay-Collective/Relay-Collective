import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { HeroCTAButtons } from '../HeroCTAButtons'
import { HeroMesh } from '../HeroMesh'
import { HeroProductEcosystem } from '../HeroProductEcosystem'
import { LINKS, PARTNER } from '../content'
import { Accent } from '../primitives'
import { container, display, focusRing } from '../styles'

const enter = (ms: number) => ({ '--enter-delay': `${ms}ms` }) as CSSProperties

// 01: the first five seconds. What it is, who it's for, the two ways forward, and the platform beside it.
// Phones and tablets read copy → platform → pilot; from xl the platform sits beside the copy and the pilot line,
// and the whole hero fits in the first screen.
export function LandingHero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative isolate bg-porcelain">
      <HeroMesh />
      <div
        className={`${container} grid grid-cols-[minmax(0,1fr)] gap-x-14 pb-20 pt-8 [grid-template-areas:'copy'_'visual'_'proof'] sm:pt-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)] xl:grid-rows-[1fr_auto_1fr] xl:min-h-[calc(100svh-77px)] xl:content-center xl:py-7 xl:[grid-template-areas:'._visual'_'copy_visual'_'proof_visual']`}
      >
        {/* The copy column is a size container, so the headline can size itself to its longer line */}
        <div className="[container-type:inline-size] [grid-area:copy]">
          {/* Always two lines: "Technology that" / "brings us together.". The longer line is about 7.6em wide,
              so the size is whatever fills the column, up to 88px. Neither line may wrap. */}
          <h1 id="hero-heading" className={`${display} text-[min(88px,calc(100cqw/7.7))] leading-[0.98]`}>
            <span className="rcl-enter block whitespace-nowrap" style={enter(80)}>
              Technology that
            </span>
            <span className="block whitespace-nowrap">
              <span className="rcl-enter inline-block" style={enter(200)}>
                brings us
              </span>{' '}
              <Accent className="text-cantaloupe-display">
                <span className="rcl-flourish inline-block pr-[0.06em]" style={enter(360)}>
                  together.
                </span>
              </Accent>
            </span>
          </h1>

          <p className="rcl-enter mt-6 max-w-[36ch] font-dm text-[18px] leading-[1.55] text-midnight-soft sm:mt-7 sm:text-[20px]" style={enter(520)}>
            Shared, open-source infrastructure for nonprofits. One foundation for your team, your volunteers, and the services you run, so no organization has to build it alone.
          </p>

          <div className="rcl-enter mt-8 sm:mt-10" style={enter(620)}>
            <HeroCTAButtons />
          </div>

          <p className="rcl-enter mt-6 font-dm text-[15px] text-midnight-soft" style={enter(700)}>
            Want to make a difference?{' '}
            <Link to={LINKS.registerVolunteer} className={`rounded font-semibold text-midnight underline decoration-electric decoration-2 underline-offset-[5px] hover:decoration-midnight ${focusRing}`}>
              Join as a volunteer
            </Link>
          </p>
        </div>

        {/* From xl the hero fills one screen below the 77px header. The picture is about 1.16 times as tall as it is wide,
            plus a 32px caption, so its width is capped by the viewport height and the whole picture always fits.
            440px is the floor that keeps its smallest text readable. */}
        <div className="mt-14 w-full max-w-[680px] [grid-area:visual] md:mx-auto md:mt-16 xl:mx-0 xl:mt-0 xl:w-[min(100%,max(440px,calc((100svh-165px)/1.16)))] xl:max-w-none xl:self-center xl:justify-self-end">
          <HeroProductEcosystem />
        </div>

        <p
          className="rcl-enter mt-12 flex max-w-[44ch] items-start gap-3 font-dm text-[14px] leading-relaxed text-hush [grid-area:proof] md:mx-auto md:w-full md:max-w-[680px] xl:mx-0 xl:mt-10 xl:max-w-[44ch] xl:self-start"
          style={enter(760)}
        >
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-electric" aria-hidden />
          <span>
            In pilot with {PARTNER.name} — {PARTNER.program}, {PARTNER.place}.
          </span>
        </p>
      </div>
    </section>
  )
}

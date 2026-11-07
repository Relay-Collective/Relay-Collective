import { STEPS } from '../content'
import { Accent, Reveal } from '../primitives'
import { container, h2Small } from '../styles'

// 05: three steps on one blue route: join the foundation, turn on a module, grow with everyone else on it. It draws once the steps come into view.
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-16 bg-porcelain py-24 sm:py-28 lg:py-36">
      <div className={container}>
        <Reveal className="max-w-3xl">
          <h2 id="how-heading" className={h2Small}>
            Start with one module. <Accent>Grow together.</Accent>
          </h2>
        </Reveal>

        <Reveal className="relative mt-16 lg:mt-24">
          {/* The route: across on wide screens, down the left edge on phones and tablets */}
          <span className="absolute bottom-4 left-[6px] top-4 w-[2px] bg-midnight/10 lg:hidden" aria-hidden>
            <span className="rcl-line absolute inset-0 bg-electric" />
          </span>
          <span className="absolute left-0 right-0 top-[6px] hidden h-[2px] bg-midnight/10 lg:block" aria-hidden>
            <span className="rcl-line absolute inset-0 bg-electric" />
          </span>

          <ol className="grid gap-14 lg:grid-cols-3 lg:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative pl-10 lg:pl-0 lg:pt-14">
                <span
                  className={`absolute left-0 top-1 h-[14px] w-[14px] rounded-full border-[3px] border-porcelain lg:top-0 ${i === STEPS.length - 1 ? 'bg-cantaloupe' : 'bg-electric'}`}
                  aria-hidden
                />
                <p className="font-grotesk text-[72px] font-medium leading-none tracking-[-0.04em] text-midnight tabular-nums sm:text-[96px]" aria-hidden>
                  {s.n}
                </p>
                <h3 className="mt-6 font-grotesk text-2xl font-semibold tracking-[-0.03em] text-midnight sm:text-[28px]">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-3 max-w-sm font-dm text-[17px] leading-relaxed text-midnight-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}

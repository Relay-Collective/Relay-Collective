import { IMPACT_POINTS, TRUST } from '../content'
import { Accent, Reveal } from '../primitives'
import { container, display } from '../styles'

// 06: why it matters. Words instead of numbers: we only publish figures we can stand behind,
// so the proof here is what is true today.
export function ImpactSection() {
  return (
    <section id="impact" aria-labelledby="impact-heading" className="relative scroll-mt-16 overflow-hidden border-t border-hairline bg-white py-24 sm:py-28 lg:py-40">
      <div className={container}>
        <Reveal>
          <h2 id="impact-heading" className={`${display} text-[clamp(42px,7vw,104px)] leading-[0.98]`}>
            <span className="block text-hush">Technology is powerful.</span>
            <span className="block">
              Connection changes <Accent>everything.</Accent>
            </span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-12 xl:col-span-4">
            <p className="max-w-2xl font-grotesk text-[24px] font-medium leading-snug tracking-[-0.02em] text-midnight sm:text-[28px]">
              When nonprofits share what sits underneath, each one spends less time rebuilding tools and more time with the people it serves.
            </p>
          </Reveal>
          <ul className="grid gap-10 sm:grid-cols-3 sm:gap-6 lg:col-span-12 xl:col-span-7 xl:col-start-6">
            {IMPACT_POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 100} className="border-t-2 border-midnight pt-6">
                <h3 className="font-grotesk text-[19px] font-semibold tracking-[-0.02em] text-midnight">{p.title}</h3>
                <p className="mt-3 font-dm text-[16px] leading-relaxed text-midnight-soft">{p.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* What's true today, where a template would put invented numbers */}
        <Reveal className="mt-20 rounded-[20px] bg-porcelain lg:mt-28">
          <dl className="grid gap-x-6 gap-y-8 p-7 sm:grid-cols-2 sm:p-10 lg:grid-cols-4">
            {TRUST.map((t, i) => (
              <div key={t.label} className={`lg:border-l lg:border-hairline lg:pl-8 ${i === 0 ? 'lg:border-l-0 lg:pl-0' : ''}`}>
                <dt className="font-dm text-[14px] font-medium text-hush">{t.label}</dt>
                <dd className="mt-2 font-grotesk text-[18px] font-medium leading-snug tracking-[-0.02em] text-midnight">{t.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

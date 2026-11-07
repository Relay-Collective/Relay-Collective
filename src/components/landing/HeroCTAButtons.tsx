import { ArrowDown, ArrowRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LINKS } from './content'
import { ctaSegArrow, ctaSegArrowDown, ctaSegment, ctaSegments, ctaSegPuck } from './styles'

// The hero's two ways forward, held in one capsule. A midnight puck rests on Get started and springs across to
// whichever side is hovered or focused, then returns. Explore stays on the page and scrolls to the platform.
// One row at every width: full width on phones, where Explore drops "the platform".
export function HeroCTAButtons({ className = '' }: { className?: string }) {
  const start = useRef<HTMLAnchorElement>(null)
  const explore = useRef<HTMLAnchorElement>(null)
  const [active, setActive] = useState(0)
  const [puck, setPuck] = useState({ left: 0, width: 0 })

  // Measure the active side, and again whenever a side changes size (fonts landing, the phone layout)
  useLayoutEffect(() => {
    const sides = [start.current, explore.current]
    const place = () => {
      const el = sides[active]
      if (el) setPuck({ left: el.offsetLeft, width: el.offsetWidth })
    }
    place()
    const observer = new ResizeObserver(place)
    sides.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [active])

  const side = (i: number) => ({
    className: ctaSegment,
    'data-on': active === i || undefined,
    onPointerEnter: () => setActive(i),
    onFocus: () => setActive(i),
  })

  return (
    <div
      className={`${ctaSegments} ${className}`}
      onPointerLeave={() => setActive(0)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setActive(0)
      }}
    >
      <span aria-hidden className={ctaSegPuck} style={{ left: puck.left, width: puck.width }} />
      <Link ref={start} to={LINKS.register} {...side(0)}>
        Get started
        <ArrowRight className={ctaSegArrow} strokeWidth={2.25} aria-hidden />
      </Link>
      <a ref={explore} href="#platform" {...side(1)}>
        <span className="sm:hidden">Explore</span>
        <span className="hidden sm:inline">Explore the platform</span>
        <ArrowDown className={ctaSegArrowDown} strokeWidth={2.25} aria-hidden />
      </a>
    </div>
  )
}

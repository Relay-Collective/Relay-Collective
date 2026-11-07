// Shared class names for the public website. The signed-in app uses ../ui.ts instead.

// One frame for every section, header and footer, so left edges line up down the page
export const container = 'mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10'

export const sectionY = 'py-24 sm:py-28 lg:py-36'

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-electric-ink focus-visible:ring-offset-2 focus-visible:ring-offset-porcelain'
const focusRingOnBlue =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-midnight focus-visible:ring-offset-2 focus-visible:ring-offset-electric'

const cta =
  'group inline-flex min-h-12 select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-6 font-dm text-[15px] font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-out active:scale-[0.98]'

// On porcelain: a midnight pill that warms to electric ink, and a midnight outline
export const ctaPrimary = `${cta} ${focusRing} bg-midnight text-white hover:bg-electric-ink`
export const ctaGhost = `${cta} ${focusRing} border border-midnight/80 bg-white/60 text-midnight hover:border-midnight hover:bg-white`

// On electric blue (the closing call to action)
export const ctaOnBlue = `${cta} ${focusRingOnBlue} bg-midnight text-white hover:bg-white hover:text-midnight`
export const ctaGhostOnBlue = `${cta} ${focusRingOnBlue} border border-midnight text-midnight hover:bg-white/20`

// The segmented capsule for a page's main decision (the hero): both actions in one white capsule, with a midnight
// puck behind whichever side is active. The component positions the puck; these set its look and its spring.
// Full width on phones with Get started a little wider; content width from sm.
// Focus draws an outline, not a ring, so it clears the puck.
const spring = 'duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none'
export const ctaSegments =
  'rcl-cta-capsule relative grid w-full grid-cols-[1.25fr_1fr] rounded-full border border-hairline bg-white p-1.5 sm:inline-grid sm:w-auto sm:grid-cols-[auto_auto]'
export const ctaSegPuck = `absolute inset-y-1.5 rounded-full bg-midnight transition-[left,width] ${spring}`
export const ctaSegment =
  'group relative z-[1] inline-flex h-[52px] select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-3 font-dm text-[16px] font-semibold tracking-[-0.01em] text-midnight transition-[color,scale] duration-300 ease-out active:scale-[0.97] data-[on]:text-white focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-electric-ink motion-reduce:transition-colors sm:px-6'
export const ctaSegArrow = `h-4 w-4 transition-transform ${spring} group-hover:translate-x-[3px]`
export const ctaSegArrowDown = `h-4 w-4 transition-transform ${spring} group-hover:translate-y-[3px]`

// Arrow that slips forward when its link is hovered
export const ctaArrow = 'h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1'
export const ctaArrowDown = 'h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-y-0.5'

// A plain text link with an arrow: for secondary destinations inside a section
export const textLink = `group inline-flex min-h-11 items-center gap-2 rounded-md font-dm text-[15px] font-semibold text-midnight underline-offset-[5px] decoration-electric decoration-2 hover:underline ${focusRing}`

// Section titles: Space Grotesk, tight, with an Instrument Serif accent set in <Accent>
export const display = 'font-grotesk font-semibold tracking-[-0.04em] text-balance text-midnight'
export const h2 = `${display} text-[clamp(40px,6vw,76px)] leading-[0.98]`
export const h2Small = `${display} text-[clamp(36px,4.6vw,60px)] leading-[1]`

export const lede = 'font-dm text-[18px] leading-[1.6] text-midnight-soft sm:text-[19px]'

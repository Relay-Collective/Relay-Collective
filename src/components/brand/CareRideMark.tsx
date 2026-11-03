import type { SVGProps } from 'react'

// The CareRide module mark: one trip, drawn the way every ride card draws it. An open ring for the pickup,
// a road that steps up across the map, and a filled stop for the drop-off. The road stops just short of the pickup,
// the handoff left open as in the Relay Collective mark. Same 48-unit grid and round strokes as LogoMark.
// brand: midnight pickup, electric road, cantaloupe drop-off (the logo's three colours).
// Without a tone it draws in currentColor, so navigation can colour it like any other icon.
interface Props extends SVGProps<SVGSVGElement> {
  tone?: 'brand'
}

export function CareRideMark({ tone, className = 'h-6 w-6', ...rest }: Props) {
  const [pickup, road, dropOff] = tone === 'brand' ? ['#111820', '#0297DE', '#FC734D'] : ['currentColor', 'currentColor', 'currentColor']
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden focusable="false" {...rest}>
      <circle cx="9" cy="33" r="4.5" fill="none" stroke={pickup} strokeWidth="4" />
      <path d="M20 33h1a6 6 0 0 0 6-6v-6a6 6 0 0 1 6-6" fill="none" stroke={road} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38.5" cy="15" r="5.5" fill={dropOff} />
    </svg>
  )
}

// The mark in its own colours, as a plain icon component (for the module registry)
export function CareRideBrandMark(props: Omit<Props, 'tone'>) {
  return <CareRideMark tone="brand" {...props} />
}

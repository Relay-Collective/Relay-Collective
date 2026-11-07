// The Relay Collective mark (1.6): two hooks that close one loop between them, the handoff points left open,
// and the person they come together around at its centre. Same geometry as public/brand/*.svg.
// brand: electric + midnight with a cantaloupe centre. ink / white: one colour, for monochrome use.
export type MarkTone = 'brand' | 'ink' | 'white'

const TONES: Record<MarkTone, [string, string, string]> = {
  brand: ['#0297DE', '#111820', '#FC734D'],
  ink: ['#111820', '#111820', '#111820'],
  white: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
}

export function LogoMark({ className = 'h-8 w-8', tone = 'brand' }: { className?: string; tone?: MarkTone }) {
  const [a, b, dot] = TONES[tone]
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden focusable="false">
      <path d="M9 31V19a10 10 0 0 1 10-10h9" fill="none" stroke={a} strokeWidth="8" strokeLinecap="round" />
      <path d="M39 17v12a10 10 0 0 1-10 10h-9" fill="none" stroke={b} strokeWidth="8" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4.5" fill={dot} />
    </svg>
  )
}

// The name, set in Space Grotesk. Pair with LogoMark; the symbol is roughly 1.5x the text's size.
export const wordmark = 'whitespace-nowrap font-display font-semibold tracking-[-0.035em] text-ink'

// Shared class names for the signed-in consoles (organization, volunteer, admin). Builds on ../ui.ts.

export const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'
// The same ring on the night frame: a lighter electric, with the gap in night rather than white
export const focusRingNight = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night'

// A section of a page: a hairline and a soft resting fall
export const panel = 'rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)]'

// The heading row inside a panel
// The heading block takes the room, so a short link beside it stays on its line instead of wrapping below
export const panelHead = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4 sm:px-6 [&>:first-child]:min-w-0 [&>:first-child]:flex-[1_1_10rem]'
export const panelTitle = 'font-heading text-lg font-bold tracking-[-0.02em] text-ink'

// A section heading on the sheet itself (outside a panel), e.g. "Your modules"
export const sectionTitle = 'font-heading text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink'

// A link in a panel's heading row, e.g. "View all"
export const panelLink = `group/link inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rc-blue transition-colors duration-150 ease-out-quart hover:bg-brand-50 [&>svg]:transition-transform [&>svg]:duration-150 hover:[&>svg]:translate-x-0.5 ${focusRing}`

// Compact buttons for headers and toolbars. Still 44px tall: the minimum touch target.
export const compactButton = 'min-h-11 px-4 text-sm'

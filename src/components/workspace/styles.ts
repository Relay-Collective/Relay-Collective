// Shared class names for the signed-in consoles (organization, volunteer, admin). Builds on ../ui.ts.

export const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'

// A section of a page: an edge, no shadow
export const panel = 'rounded-xl border border-slate-200 bg-white'

// The heading row inside a panel
// The heading block takes the room, so a short link beside it stays on its line instead of wrapping below
export const panelHead = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4 [&>:first-child]:min-w-0 [&>:first-child]:flex-[1_1_10rem]'
export const panelTitle = 'font-heading text-[17px] font-semibold tracking-[-0.01em] text-ink'

// A link in a panel's heading row, e.g. "View all"
export const panelLink = `inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`

// Compact buttons for headers and toolbars. Still 44px tall: the minimum touch target.
export const compactButton = 'min-h-11 px-4 text-sm'

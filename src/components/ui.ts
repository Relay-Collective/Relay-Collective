import type { UserRole } from '../types'

// Shared Tailwind class names (Relay Collective console 2.1). Big targets, clear focus, readable text throughout.
// Radii: rounded-2xl (16px) for cards and panels, rounded-xl (12px) for inputs and tiles, rounded-full for buttons
// and chips. Cards rest on a hairline and a soft offset fall (--shadow-rest); things that float get --shadow-lift.
// Midnight ink is the primary action; electric blue (brand-600) marks what is selected or active.
export const card = 'rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-rest)]'

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'

export const button = `inline-flex min-h-12 select-none items-center whitespace-nowrap justify-center gap-2 rounded-full px-5 text-base font-semibold transition duration-150 ease-out-quart ${focusRing} active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50`
// The primary pill has a light top edge and a short fall, so it reads as the one thing to press
export const primaryButton = `${button} bg-ink text-white shadow-[var(--shadow-press)] hover:bg-brand-700 active:bg-brand-800`
export const secondaryButton = `${button} border border-slate-200 bg-white text-ink shadow-[0_1px_2px_rgb(17_24_32/0.05)] hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100`
export const ghostButton = `${button} text-slate-700 hover:bg-slate-100 hover:text-ink`
export const dangerButton = `${button} bg-red-600 text-white shadow-[var(--shadow-press)] hover:bg-red-700 active:bg-red-800`
export const dangerOutlineButton = `${button} border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50`

export const input =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-ink shadow-[inset_0_1px_2px_rgb(17_24_32/0.04)] placeholder:text-slate-500 transition hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-[3px] focus:ring-brand-100 aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-100'
export const label = 'mb-1.5 block text-sm font-semibold text-ink'
export const hint = 'mt-1.5 text-sm text-slate-500'
export const pageTitle = 'mb-6 font-display text-3xl font-bold tracking-[-0.035em] text-balance text-ink sm:text-[34px] sm:leading-[1.1]'

// Each role and section picks one tone so screens feel distinct. Solid fills only: gradients belong to the logo.
export type Tone = 'brand' | 'ink' | 'coral' | 'teal' | 'amber'

export const tones: Record<Tone, { tile: string; solid: string; text: string; border: string }> = {
  brand: {
    tile: 'bg-brand-50 text-brand-700',
    solid: 'bg-brand-600 text-white',
    text: 'text-brand-700',
    border: 'hover:border-brand-300',
  },
  ink: {
    tile: 'bg-slate-100 text-ink',
    solid: 'bg-ink text-white',
    text: 'text-ink',
    border: 'hover:border-slate-400',
  },
  coral: {
    tile: 'bg-coral-50 text-coral-700',
    solid: 'bg-coral-400 text-ink',
    text: 'text-coral-700',
    border: 'hover:border-coral-300',
  },
  teal: {
    tile: 'bg-teal-50 text-teal-700',
    solid: 'bg-teal-700 text-white',
    text: 'text-teal-700',
    border: 'hover:border-teal-300',
  },
  amber: {
    tile: 'bg-sun-100 text-amber-900',
    solid: 'bg-sun-400 text-ink',
    text: 'text-amber-800',
    border: 'hover:border-amber-300',
  },
}

// Partners are the main users, so they get the brand blue.
export const ROLE_TONE: Record<UserRole, Tone> = {
  PLATFORM_ADMIN: 'ink',
  ORG_ADMIN: 'amber',
  PARTNER: 'brand',
  DRIVER: 'coral',
}

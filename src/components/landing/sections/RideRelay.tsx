import { ArrowRight, CalendarClock, Check, CircleCheck, MapPin, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { CareRideMark } from '../../../modules/careride/brand'
import { LINKS } from '../content'
import { DEMO_OFFER, DEMO_ORG } from '../demo'
import { Accent, Reveal, SmartLink } from '../primitives'
import { StatusPill } from '../ProductBits'
import { container, display } from '../styles'

// 04: one ride, relayed. What the platform does today, shown as the hand-offs between the people in it: staff book,
// a driver says yes, both sides watch it move, and it lands in history. The one midnight band on the page, so the
// four small product pieces (white, drawn from the app) read as moments on one night drive. The route that joins
// them draws once as the stops come into view, and the relay point (the logo's centre) waits at the end.

const RIDE_STEPS = ['Booked', 'Confirmed', 'Picked up', 'Arrived'] // the app's RideProgress stops

interface Stop {
  who: string
  title: string
  text: string
  picture: ReactNode
}

const STOPS: Stop[] = [
  {
    who: 'Partner staff',
    title: 'Book in about a minute',
    text: 'Pick a saved place and a time. The person riding needs no account, phone or money, and a first name only if they want one.',
    picture: <BookingPiece />,
  },
  {
    who: 'Volunteer driver',
    title: 'A verified driver says yes',
    text: 'The request goes to drivers whose vehicle, cities and hours fit. The first to accept takes it, and the others are told.',
    picture: <OfferPiece />,
  },
  {
    who: 'Staff and driver',
    title: 'Everyone sees it move',
    text: 'Each step the driver taps shows up for staff by itself, so no one has to call to ask. A ride nobody takes is raised right away.',
    picture: <ProgressPiece />,
  },
  {
    who: 'Everyone',
    title: 'Dropped off, and counted',
    text: 'The finished ride moves to history, and it counts on the overview for the organization and for the driver.',
    picture: <DonePiece />,
  },
]

export function RideRelay() {
  return (
    <section
      id="ride"
      aria-labelledby="ride-heading"
      className="relative scroll-mt-16 overflow-hidden bg-midnight py-24 text-white sm:py-28 lg:py-36"
    >
      {/* The logo's centre, half off the edge: cantaloupe on midnight, as on the foundation card */}
      <span
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cantaloupe sm:-right-32 sm:-top-32 sm:h-96 sm:w-96"
        aria-hidden
      />
      <div className={`${container} relative`}>
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 id="ride-heading" className={`${display} text-[clamp(40px,6vw,76px)] leading-[0.98] text-white lg:col-span-8`}>
            One ride, <Accent className="text-cantaloupe">relayed.</Accent>
          </h2>
          <div className="lg:col-span-4 lg:pb-2">
            <p className="max-w-[36ch] font-dm text-[18px] leading-[1.6] text-white/75 sm:text-[19px]">
              Getting there is often the first barrier between a person and help that already exists. CareRide, the first module, passes each ride
              from hand to hand.
            </p>
            <p className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/20 py-1 pl-1 pr-3.5 font-dm text-[13px] font-medium text-white/85">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white" aria-hidden>
                <CareRideMark tone="brand" className="h-[18px] w-[18px]" />
              </span>
              CareRide · Working today
            </p>
          </div>
        </Reveal>

        <Reveal className="relative mt-16 lg:mt-20">
          {/* The route: across the top on wide screens, down the left on phones and tablets */}
          <span className="absolute bottom-6 left-[7px] top-2 w-[2px] bg-white/15 lg:hidden" aria-hidden>
            <span className="rcl-line absolute inset-0 bg-electric" />
          </span>
          <span className="absolute left-0 right-[7px] top-[7px] hidden h-[2px] bg-white/15 lg:block" aria-hidden>
            <span className="rcl-line absolute inset-0 bg-electric" />
          </span>

          <ol className="grid gap-14 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-6 lg:gap-y-0">
            {STOPS.map((s, i) => {
              const last = i === STOPS.length - 1
              return (
                <li key={s.title} className="relative flex flex-col pl-10 lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:pl-0 lg:pt-12">
                  {/* Each stop on the route: an open ring for the pickup, filled once a driver has it, the relay point at the end */}
                  <span
                    className={`absolute left-0 top-0 h-4 w-4 rounded-full ${
                      last
                        ? 'bg-cantaloupe shadow-[0_0_0_4px_var(--color-midnight)]'
                        : i === 0
                        ? 'border-[3px] border-electric bg-midnight'
                        : 'bg-electric shadow-[0_0_0_4px_var(--color-midnight)]'
                    }`}
                    aria-hidden
                  />
                  <h3 className="font-grotesk text-[24px] font-semibold leading-tight tracking-[-0.03em] text-white">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 font-dm text-[14px] font-semibold text-brand-300">{s.who}</p>
                  <p className="mt-3 font-dm text-[16px] leading-relaxed text-white/70">{s.text}</p>
                  <div className="mt-6" aria-hidden>
                    {s.picture}
                  </div>
                </li>
              )
            })}
          </ol>
        </Reveal>

        <Reveal className="mt-16 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-dm text-[14px] text-white/60">Illustrative pictures of the real screens. The places and people shown are not real.</p>
          <SmartLink
            href={LINKS.transportTour}
            className="group inline-flex min-h-11 items-center gap-2 rounded-md font-dm text-[15px] font-semibold text-white decoration-electric decoration-2 underline-offset-[5px] hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
          >
            Take the CareRide tour <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </SmartLink>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- The four pieces, drawn from the app ---------- */

function Piece({ children }: { children: ReactNode }) {
  return (
    <div className="select-none rounded-2xl bg-white p-4 text-midnight shadow-[0_1px_2px_rgb(0_0_0/0.2),0_18px_40px_-18px_rgb(0_0_0/0.6)]">
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="font-dm">
      <p className="text-[11px] font-semibold text-hush">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function BookingPiece() {
  return (
    <Piece>
      <p className="font-grotesk text-[15px] font-semibold tracking-[-0.02em]">Request a ride</p>
      <div className="mt-3 space-y-3">
        <Field label="Where to">
          <span className="flex items-center gap-2 rounded-xl border-2 border-electric bg-brand-50 px-3 py-2 text-[13px] font-semibold">
            <MapPin className="h-3.5 w-3.5 text-electric-ink" /> {DEMO_OFFER.to}
          </span>
        </Field>
        <Field label="When">
          <span className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-[13px]">
            <CalendarClock className="h-3.5 w-3.5 text-hush" /> {DEMO_OFFER.when}
          </span>
        </Field>
        <Field label="Passenger 1 name (optional)">
          <span className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-[13px]">
            <UserRound className="h-3.5 w-3.5 text-hush" /> Jamie
          </span>
        </Field>
      </div>
      <span className="mt-4 flex justify-center rounded-full bg-midnight py-2 font-dm text-[13px] font-semibold text-white">Request ride</span>
    </Piece>
  )
}

function OfferPiece() {
  return (
    <Piece>
      <div className="flex items-center gap-2 font-dm text-[11px]">
        <span className="rounded-md bg-electric-wash px-1.5 py-0.5 font-semibold text-electric-ink">CareRide</span>
        <span className="text-hush">Scheduled</span>
      </div>
      <p className="mt-3 flex items-center gap-2 font-dm text-[12px] text-midnight-soft">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-hush" /> <span className="truncate">{DEMO_ORG}</span>
      </p>
      <p className="mt-1.5 flex items-center gap-2 font-grotesk text-[15px] font-semibold">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-electric" /> {DEMO_OFFER.to}
      </p>
      <p className="mt-1.5 flex items-center gap-2 font-dm text-[12px] font-semibold">
        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-hush" /> {DEMO_OFFER.when}
      </p>
      <p className="mt-3 font-dm text-[11px] text-hush">Please answer by {DEMO_OFFER.answerBy}. You can always decline.</p>
      <div className="mt-3 flex gap-2 font-dm text-[13px] font-semibold">
        <span className="flex-1 rounded-full bg-midnight py-2 text-center text-white">Accept</span>
        <span className="flex-1 rounded-full border border-slate-300 py-2 text-center">Decline</span>
      </div>
    </Piece>
  )
}

// The next-pickup panel's four stops, with the client in the car
function ProgressPiece() {
  const at = 2
  return (
    <Piece>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-dm">
          <p className="truncate font-grotesk text-[15px] font-semibold tracking-[-0.02em]">{DEMO_OFFER.to}</p>
          <p className="text-[12px] text-hush">Jamie · Grey hatchback</p>
        </div>
        <StatusPill status="Picked up" size="text-[11px]" />
      </div>
      <ol className="mt-5 flex">
        {RIDE_STEPS.map((step, i) => {
          const reached = i <= at
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center gap-1.5">
              {i > 0 && <span className={`absolute right-1/2 top-2 h-0.5 w-full -translate-y-1/2 ${reached ? 'bg-electric' : 'bg-slate-200'}`} />}
              <span
                className={`relative flex h-4 w-4 items-center justify-center rounded-full ${
                  reached ? 'bg-electric text-white' : 'border-2 border-slate-300 bg-white'
                } ${i === at ? 'ring-4 ring-electric/20' : ''}`}
              >
                {reached && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
              </span>
              <span className={`whitespace-nowrap font-dm text-[11px] font-semibold ${reached ? 'text-midnight' : 'text-hush'}`}>{step}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 rounded-xl bg-porcelain px-3 py-2 font-dm text-[12px] text-midnight-soft">
        <span className="font-semibold text-midnight">2:41 PM</span> · Client is in the car
      </p>
    </Piece>
  )
}

// A finished ride card: the route turns green on arrival
function DonePiece() {
  return (
    <Piece>
      <div className="flex items-center justify-between gap-2">
        <p className="font-dm text-[13px] font-semibold tabular-nums">2:30 PM</p>
        <StatusPill status="Completed" size="text-[11px]" />
      </div>
      <div className="mt-3 flex items-stretch gap-3">
        <span className="flex flex-col items-center py-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-600" />
          <span className="w-0.5 flex-1 bg-emerald-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
        </span>
        <div className="min-w-0 space-y-2 font-dm text-[12px]">
          <p className="truncate text-midnight-soft">{DEMO_ORG}</p>
          <p className="truncate font-semibold text-midnight">{DEMO_OFFER.to}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 font-dm">
        <CircleCheck className="h-4 w-4 shrink-0 text-emerald-700" />
        <p className="text-[12px] text-emerald-900">
          <span className="font-semibold">Passenger dropped off</span> at 2:52 PM
        </p>
      </div>
    </Piece>
  )
}

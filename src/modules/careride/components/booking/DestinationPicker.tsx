import { ArrowLeft, Check, MapPin, Navigation, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AddressPicker } from '../../../../components/form/AddressPicker'
import { FieldMessage } from '../../../../components/form/FieldMessage'
import { RequiredMark } from '../../../../components/form/RequiredMark'
import { input } from '../../../../components/ui'
import type { AddressSuggestion } from '../../../../services/addressSearch'
import type { Destination } from '../../../../types'
import { CUSTOM } from '../../logic/bookingForm'
import { filterDestinations } from '../../logic/popularDestinations'

export interface Stop {
  name: string
  detail?: string
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'
const textButton = `inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 ${focusRing}`

// ---- The route: a pickup ring joined to a drop-off dot, as on every ride card

function Marker({ kind }: { kind: 'pickup' | 'dropoff' | 'empty' }) {
  const look = {
    pickup: 'border-[3px] border-ink bg-white',
    dropoff: 'bg-coral-400 ring-4 ring-coral-100',
    empty: 'border-2 border-slate-300 bg-white',
  }[kind]
  return <span className={`relative z-10 block h-3.5 w-3.5 rounded-full ${look}`} aria-hidden />
}

function RouteStop({ marker, label, last, children }: { marker: 'pickup' | 'dropoff' | 'empty'; label: string; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
      <span className="relative flex justify-center pt-[0.3rem]">
        <Marker kind={marker} />
        {/* The road to the next stop */}
        {!last && <span className="absolute bottom-[-0.3rem] top-6 w-0.5 rounded-full bg-slate-300" aria-hidden />}
      </span>
      <div className={`min-w-0 ${last ? '' : 'pb-5'}`}>
        <span className="block text-sm font-medium text-slate-500">{label}</span>
        {children}
      </div>
    </li>
  )
}

function StopText({ stop, note }: { stop: Stop; note?: string }) {
  return (
    <>
      <span className="block break-words font-semibold leading-snug text-ink">{stop.name}</span>
      {stop.detail && stop.detail !== stop.name && <span className="block break-words text-sm text-slate-600">{stop.detail}</span>}
      {note && <span className="mt-0.5 block text-sm font-medium text-slate-700">{note}</span>}
    </>
  )
}

// A return trip (or editing one): both ends are fixed, so there's nothing to choose
export function FixedRoute({ from, to }: { from: Stop; to: Stop }) {
  return (
    <ol aria-label="Route">
      <RouteStop marker="pickup" label="Pickup">
        <StopText stop={from} />
      </RouteStop>
      <RouteStop marker="dropoff" label="Drop-off" last>
        <StopText stop={to} />
      </RouteStop>
    </ol>
  )
}

// ---- One saved place in the list. A real radio, so arrow keys, Space and screen readers work as usual.

interface RowProps {
  id: string
  title: string
  detail?: string
  note?: string
  meta?: string
  icon: ReactNode
  checked: boolean
  invalid?: boolean
  onSelect: (commit: boolean) => void
}

function OptionRow({ id, title, detail, note, meta, icon, checked, invalid, onSelect }: RowProps) {
  // Arrow keys and Space choose a place and keep the list open, like any radio group. A click, a tap,
  // or Enter also closes the list, since that's someone saying "this one".
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault() // not a form submit
      onSelect(true)
    }
  }
  return (
    <li>
      <label
        className={`group flex min-h-14 cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 transition duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-brand-500 ${
          checked ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-slate-50'
        }`}
        onPointerUp={(e) => {
          if (e.button === 0) onSelect(true)
        }}
      >
        <input
          type="radio"
          name="destination"
          value={id}
          checked={checked}
          onChange={() => onSelect(false)}
          onKeyDown={onKeyDown}
          aria-invalid={invalid ? true : undefined}
          className="sr-only"
        />
        <span className={`shrink-0 ${checked ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-500'}`} aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold leading-snug text-ink">{title}</span>
          {detail && (
            <span className="block truncate text-sm text-slate-600" title={detail}>
              {detail}
            </span>
          )}
          {note && <span className="block text-xs font-medium text-slate-700">{note}</span>}
        </span>
        {meta && <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">{meta}</span>}
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
            checked ? 'bg-brand-600 text-white' : 'border-2 border-slate-300 bg-white'
          }`}
          aria-hidden
        >
          {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </label>
    </li>
  )
}

function GroupLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-500 first:pt-1">
      {children}
    </p>
  )
}

// ---- The picker

interface Props {
  from: Stop
  destinations?: Destination[] // undefined while loading
  sorted: Destination[] // most used first
  frequent: { destination: Destination; rides: number }[]
  destinationId: string
  customAddress: string
  customName: string
  customPicked: boolean
  waitFor: (name: string, address?: string) => string | undefined
  chosenWait?: string
  destinationError?: string
  customAddressError?: string
  hint?: string
  onChoose: (destinationId: string) => void
  onCustom: (query: string) => void
  onCustomQuery: (customAddress: string) => void
  onCustomSelect: (place: AddressSuggestion) => void
}

// Where the client is going: search first, the places this house uses most one tap away, every saved place
// in a short list, and any other address through the address search. Once a place is chosen the list folds
// into one line with a Change button, so the rest of the form stays close.
export function DestinationPicker(props: Props) {
  const { from, destinations, sorted, frequent, destinationId, customAddress, customName, customPicked, waitFor, chosenWait } = props
  const { destinationError, customAddressError, hint, onChoose, onCustom, onCustomQuery, onCustomSelect } = props

  const saved = destinations?.find((d) => d.id === destinationId)
  const isCustom = destinationId === CUSTOM
  const chosen: Stop | undefined = saved
    ? { name: saved.name, detail: saved.address }
    : isCustom && customPicked
      ? { name: customName || customAddress, detail: customName ? customAddress : undefined }
      : undefined

  const [picking, setPicking] = useState(false)
  const [browseSaved, setBrowseSaved] = useState(false) // looking at saved places while "somewhere else" is chosen
  const [query, setQuery] = useState('')
  // Where focus goes once the next render puts that part on screen
  const focusNext = useRef<'search' | 'address' | 'change' | undefined>(undefined)
  const setFocusNext = (target: 'search' | 'address' | 'change') => (focusNext.current = target)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const changeRef = useRef<HTMLButtonElement>(null)

  const open = !chosen || picking || !!destinationError || !!customAddressError
  const showAddress = isCustom && (!browseSaved || !!customAddressError)

  // Move focus once the part it belongs to is on screen
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = undefined
    if (target === 'search') searchRef.current?.focus()
    if (target === 'address') document.getElementById('custom-address')?.focus()
    if (target === 'change') changeRef.current?.focus()
  })

  function select(id: string, commit: boolean) {
    if (id === CUSTOM) {
      onCustom(query.trim())
      setBrowseSaved(false)
      setFocusNext('address')
      return
    }
    onChoose(id)
    // Arrow keys and Space keep the list open while someone looks; a click, tap or Enter closes it
    setPicking(!commit)
    if (commit) {
      setQuery('')
      setFocusNext('change')
    }
  }

  function startChange() {
    setPicking(true)
    setBrowseSaved(isCustom)
    setQuery('')
    setFocusNext('search')
  }

  const q = query.trim()
  const matches = q ? filterDestinations(sorted, q) : sorted
  const frequentIds = new Set(frequent.map((f) => f.destination.id))
  const showFrequent = !q && frequent.length > 0
  const rest = showFrequent ? matches.filter((d) => !frequentIds.has(d.id)) : matches

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      // Into the list: the chosen place if it's there, otherwise the first one
      e.preventDefault()
      const radios = [...(listRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])]
      ;(radios.find((r) => r.checked) ?? radios[0])?.focus()
    } else if (e.key === 'Enter') {
      // Enter takes the best match, or searches every address when no saved place matches
      e.preventDefault()
      const best = matches[0]
      if (q && best) select(best.id, true)
      else if (q) select(CUSTOM, true)
    } else if (e.key === 'Escape') {
      if (query) {
        e.preventDefault()
        setQuery('')
      } else if (chosen && picking) {
        e.preventDefault()
        setPicking(false)
        setFocusNext('change')
      }
    }
  }

  const describedBy = ['destination-results', destinationError ? 'destination-message' : '', hint ? 'destination-hint' : ''].filter(Boolean).join(' ')
  const loading = destinations === undefined

  return (
    <ol aria-label="Route">
      <RouteStop marker="pickup" label="Pickup">
        <StopText stop={from} />
      </RouteStop>

      <RouteStop marker={chosen ? 'dropoff' : 'empty'} label="Drop-off" last>
        {!open && chosen ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1" aria-live="polite">
              <StopText stop={chosen} note={chosenWait} />
            </div>
            <button ref={changeRef} type="button" className={`${textButton} -mr-3 -mt-2.5 shrink-0`} onClick={startChange} aria-label="Change destination">
              Change
            </button>
          </div>
        ) : showAddress ? (
          <div className="mt-1 animate-fade-up space-y-2">
            <AddressPicker
              id="custom-address"
              label="Search any address"
              required
              placeholder="e.g. 1081 Burrard St or St. Paul's Hospital"
              hint="Pick the address from the list, so the driver can find it."
              selectedHint={chosenWait}
              value={customAddress}
              selected={customPicked}
              error={customAddressError}
              onQueryChange={onCustomQuery}
              onSelect={(place) => {
                onCustomSelect(place)
                setPicking(false)
                setFocusNext('change')
              }}
            />
            <button type="button" className={`${textButton} -ml-3`} onClick={() => (setBrowseSaved(true), setFocusNext('search'))}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Choose a saved place instead
            </button>
          </div>
        ) : (
          <div className="mt-1.5">
            <label htmlFor="destination-search" className="sr-only">
              Where would you like to go?
              <RequiredMark />
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                ref={searchRef}
                id="destination-search"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={`${input} pl-11 ${query ? 'pr-12' : ''} [&::-webkit-search-cancel-button]:hidden`}
                placeholder="Where would you like to go?"
                aria-controls="destination-options"
                aria-describedby={describedBy}
                aria-invalid={destinationError ? true : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
              />
              {query && (
                <button
                  type="button"
                  className={`absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink ${focusRing}`}
                  aria-label="Clear search"
                  onClick={() => (setQuery(''), searchRef.current?.focus())}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <FieldMessage id="destination-message" error={destinationError} />
            <p id="destination-results" className="sr-only" aria-live="polite">
              {loading ? 'Loading saved places' : q ? `${matches.length} saved ${matches.length === 1 ? 'place matches' : 'places match'}. Press the down arrow to choose.` : ''}
            </p>

            <fieldset className="mt-2 min-w-0" aria-describedby={describedBy.replace('destination-results', '').trim() || undefined}>
              <legend className="sr-only">Destination</legend>
              <ul ref={listRef} id="destination-options" className="-mx-1 space-y-0.5" aria-busy={loading || undefined}>
                {loading &&
                  [0, 1, 2].map((i) => (
                    <li key={i} className="flex min-h-14 items-center gap-3 px-3" aria-hidden>
                      <span className="h-5 w-5 rounded-full bg-slate-100" />
                      <span className="flex-1 space-y-1.5">
                        <span className="block h-3.5 w-2/5 rounded bg-slate-100" />
                        <span className="block h-3 w-3/5 rounded bg-slate-100" />
                      </span>
                    </li>
                  ))}

                {showFrequent && (
                  <li>
                    <GroupLabel id="frequent-label">Frequent from {from.name}</GroupLabel>
                    <ul aria-labelledby="frequent-label" className="space-y-0.5">
                      {frequent.map(({ destination: d, rides }) => (
                        <OptionRow
                          key={d.id}
                          id={d.id}
                          title={d.name}
                          detail={d.address}
                          note={waitFor(d.name, d.address)}
                          meta={`${rides} ${rides === 1 ? 'ride' : 'rides'}`}
                          icon={<MapPin className="h-5 w-5" />}
                          checked={destinationId === d.id}
                          invalid={!!destinationError}
                          onSelect={(commit) => select(d.id, commit)}
                        />
                      ))}
                    </ul>
                  </li>
                )}

                {!loading && rest.length > 0 && (
                  <li>
                    {(showFrequent || q) && <GroupLabel id="saved-label">{q ? 'Saved places' : 'All saved places'} · {rest.length}</GroupLabel>}
                    {/* A long list scrolls in place instead of pushing the form down */}
                    <ul
                      aria-labelledby={showFrequent || q ? 'saved-label' : undefined}
                      aria-label={showFrequent || q ? undefined : 'Saved places'}
                      className="max-h-[16.75rem] space-y-0.5 overflow-y-auto overscroll-contain rounded-xl sm:max-h-[19.5rem]"
                    >
                      {rest.map((d) => (
                        <OptionRow
                          key={d.id}
                          id={d.id}
                          title={d.name}
                          detail={d.address}
                          note={waitFor(d.name, d.address)}
                          icon={<MapPin className="h-5 w-5" />}
                          checked={destinationId === d.id}
                          invalid={!!destinationError}
                          onSelect={(commit) => select(d.id, commit)}
                        />
                      ))}
                    </ul>
                  </li>
                )}

                {!loading && q && matches.length === 0 && (
                  <li className="break-words px-3 py-2 text-sm text-slate-600">No saved place matches “{q}”.</li>
                )}
                {!loading && !q && sorted.length === 0 && (
                  <li className="px-3 py-2 text-sm text-slate-600">No saved places yet. Search for the address below.</li>
                )}

                {!loading && (
                  <li className="mt-1 border-t border-slate-100 pt-1">
                    <ul>
                      <OptionRow
                        id={CUSTOM}
                        title="Somewhere else"
                        detail={q.length >= 3 ? `Search all addresses for “${q}”` : 'Search any street address or place'}
                        icon={<Navigation className="h-5 w-5" />}
                        checked={isCustom}
                        invalid={!!destinationError}
                        onSelect={(commit) => select(CUSTOM, commit)}
                      />
                    </ul>
                  </li>
                )}
              </ul>
            </fieldset>

            {chosen && picking && !destinationError && (
              <button type="button" className={`${textButton} -ml-3 mt-1 max-w-full break-words text-left`} onClick={() => (setPicking(false), setQuery(''), setFocusNext('change'))}>
                <span className="min-w-0">Keep {chosen.name}</span>
              </button>
            )}
          </div>
        )}
        {open && !showAddress && <FieldMessage id="destination-hint" hint={hint} />}
      </RouteStop>
    </ol>
  )
}

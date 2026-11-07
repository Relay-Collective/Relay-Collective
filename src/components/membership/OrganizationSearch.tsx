import { Building2, Loader2, MapPin, RefreshCw, Search, SearchX, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useOrganizationSearch } from '../../hooks/useOrganizationSearch'
import { initials } from '../../logic/initials'
import { MIN_SEARCH_LENGTH, highlightParts } from '../../logic/membership'
import type { OrganizationDirectoryEntry } from '../../types'
import { focusRing } from '../auth/styles'
import { input, label as labelClass } from '../ui'

interface Props {
  onSelect: (org: OrganizationDirectoryEntry) => void
  error?: string
}

// A searchable directory of the organizations that chose to be found: type a few letters, pick one.
// Follows the ARIA combobox pattern: arrow keys move through results, Enter picks, Escape closes.
export function OrganizationSearch({ onSelect, error }: Props) {
  const id = useId()
  const listId = `${id}-results`
  const statusId = `${id}-status`
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [retry, setRetry] = useState(0)
  const search = useOrganizationSearch(query, retry)
  const results = search.status === 'done' ? search.results : []
  const showList = open && search.status !== 'idle'

  function choose(org: OrganizationDirectoryEntry) {
    setOpen(false)
    setActive(-1)
    onSelect(org)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault() // never submits the surrounding form
      const pick = results[active] ?? (results.length === 1 ? results[0] : undefined)
      if (pick && showList) choose(pick)
    } else if (e.key === 'Escape') {
      if (showList) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      } else if (query) {
        setQuery('')
      }
    }
  }

  // What screen readers hear as results change
  const announcement =
    search.status === 'loading'
      ? 'Searching…'
      : search.status === 'error'
      ? search.message
      : search.status === 'done'
      ? results.length
        ? `${results.length} ${results.length === 1 ? 'organization' : 'organizations'} found. Use the arrow keys to choose.`
        : 'No organizations found.'
      : ''

  return (
    <div>
      <label htmlFor={`${id}-input`} className={labelClass}>
        Organization name
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 && results[active] ? `${id}-option-${active}` : undefined}
          aria-describedby={`${statusId} ${id}-hint`}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Start typing your organization’s name"
          className={`${input} min-h-14 pl-12 pr-12 text-[17px]`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
          {search.status === 'loading' ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-rc-blue" aria-hidden />
          ) : (
            query && (
              <button
                type="button"
                aria-label="Clear search"
                className={`flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-rc-navy ${focusRing}`}
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            )
          )}
        </span>
        <div
          className={`absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-rc-line bg-white shadow-[0_18px_40px_-12px_rgba(16,27,82,0.25)] ${
            showList ? '' : 'hidden'
          }`}
        >
          {/* Mouse down on a result would blur the input (closing the list) before the click lands */}
          <ul
            id={listId}
            role="listbox"
            aria-label="Organizations"
            className="max-h-80 overflow-y-auto py-1.5"
            onMouseDown={(e) => e.preventDefault()}
          >
            {results.map((org, i) => (
              <li
                key={org.id}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => choose(org)}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rc-navy font-heading text-sm font-bold text-white"
                  aria-hidden
                >
                  {initials(org.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-rc-navy">
                    {highlightParts(org.name, query).map((part, j) =>
                      part.match ? (
                        <mark key={j} className="rounded-sm bg-rc-mint text-rc-teal-ink">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={j}>{part.text}</span>
                      ),
                    )}
                  </span>
                  {org.city && (
                    <span className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" aria-hidden /> {org.city}
                    </span>
                  )}
                  {org.description && <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{org.description}</span>}
                </span>
                <span className="mt-2 hidden shrink-0 text-sm font-semibold text-rc-blue sm:inline">Request to join</span>
              </li>
            ))}
          </ul>
          {search.status === 'loading' && !results.length && (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500" aria-hidden>
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          )}
          {search.status === 'done' && !results.length && (
            <div className="px-4 py-5 text-sm text-slate-600" aria-hidden>
              <p className="flex items-center gap-2 font-semibold text-rc-navy">
                <SearchX className="h-4 w-4 text-slate-400" /> No organizations match “{search.query}”
              </p>
              <p className="mt-1">Check the spelling, or try part of the name. Some organizations only accept invitations.</p>
            </div>
          )}
          {search.status === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
              <p className="text-red-700" aria-hidden>
                {search.message}
              </p>
              <button
                type="button"
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-3 font-semibold text-rc-navy hover:bg-slate-50 ${focusRing}`}
                onClick={() => setRetry((n) => n + 1)}
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </button>
            </div>
          )}
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
        Type at least {MIN_SEARCH_LENGTH} letters. Only organizations that have chosen to be found are listed.
      </p>
      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

// The organization someone picked, before they send their request
export function SelectedOrganization({ org, onChange }: { org: OrganizationDirectoryEntry; onChange?: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-rc-blue bg-white p-5 shadow-[0_0_0_1px_var(--color-rc-blue)]">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rc-navy font-heading font-bold text-white" aria-hidden>
        {initials(org.name) || <Building2 className="h-6 w-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg font-bold text-rc-navy">{org.name}</p>
        {org.city && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {org.city}
          </p>
        )}
        {org.description && <p className="mt-2 text-sm text-slate-600">{org.description}</p>}
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
        >
          Change
        </button>
      )}
    </div>
  )
}

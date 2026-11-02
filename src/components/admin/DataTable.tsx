import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { page, sortBy, type SortDirection } from '../../logic/adminSummary'
import { focusRing } from '../workspace/styles'
import { Pagination } from './controls'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | undefined // makes the column sortable
  className?: string // e.g. 'hidden lg:table-cell' to drop a column on narrower screens
  align?: 'right'
}

interface Props<T> {
  caption: string // read by screen readers before the table
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  card: (row: T) => ReactNode // phones: each row as a stacked card, so nothing scrolls sideways
  initialSort?: { id: string; direction: SortDirection }
  highlight?: (row: T) => boolean // tints rows that need attention
  pageSize?: number
  noun: [one: string, many: string] // "organization", "organizations"
  resetKey?: string // when filters change, go back to the first page
}

// A management table from the tablet breakpoint up, and a list of cards below it.
// Sorting is by column header over every row, then the rows are split into pages.
export function DataTable<T>({ caption, columns, rows, rowKey, card, initialSort, highlight, pageSize = 20, noun, resetKey = '' }: Props<T>) {
  const [sort, setSort] = useState(initialSort)
  const [pageIndex, setPageIndex] = useState(0)
  const [lastKey, setLastKey] = useState(resetKey)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setPageIndex(0)
  }
  const sortColumn = columns.find((c) => c.id === sort?.id)
  const ordered = sortColumn?.sortValue && sort ? sortBy(rows, sortColumn.sortValue, sort.direction) : rows
  const shown = page(ordered, pageIndex, pageSize)
  const sorted = shown.items

  const toggle = (id: string) =>
    setSort((s) => (s?.id === id ? { id, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { id, direction: 'asc' }))

  return (
    <>
      {/* relative: the screen-reader labels inside are absolutely placed and must stay inside the scroll area */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            <tr>
              {columns.map((c) => {
                const active = sort?.id === c.id
                const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
                    className={`px-4 py-2.5 font-semibold first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`-mx-1.5 inline-flex min-h-11 items-center gap-1 rounded px-1.5 uppercase tracking-wider hover:text-rc-navy ${focusRing} ${active ? 'text-rc-navy' : ''}`}
                      >
                        {c.header}
                        <Icon className={`h-3.5 w-3.5 ${active ? '' : 'opacity-50'}`} aria-hidden />
                      </button>
                    ) : c.header ? (
                      c.header
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={rowKey(row)} className={`transition-colors duration-150 ease-out-quart ${highlight?.(row) ? 'bg-amber-50/50' : 'hover:bg-slate-50/80'}`}>
                {columns.map((c) => (
                  <td key={c.id} className={`px-4 py-3.5 align-middle first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 md:hidden">
        {sorted.map((row) => (
          <li key={rowKey(row)} className={highlight?.(row) ? 'bg-amber-50/50' : ''}>
            {card(row)}
          </li>
        ))}
      </ul>
      <Pagination index={shown.index} pages={shown.pages} total={rows.length} size={pageSize} onPage={setPageIndex} noun={noun} />
    </>
  )
}

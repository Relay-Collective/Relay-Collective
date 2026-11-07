import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { adminTitle } from '../../admin/navigation'
import { adminPaths } from '../../admin/paths'
import { AccountMenu } from '../AccountMenu'
import { input } from '../ui'
import { ShellHeader } from '../shell/ShellHeader'
import { focusRing } from '../workspace/styles'

// Where you are, a search across organizations and people, and who's signed in
export function AdminHeader({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const onSearchPage = pathname === adminPaths.search
  const [query, setQuery] = useState(onSearchPage ? (params.get('q') ?? '') : '')

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`${adminPaths.search}?q=${encodeURIComponent(q)}`)
  }

  return (
    <ShellHeader onOpenMenu={onOpenMenu} menuOpen={menuOpen} context="Platform administration" title={adminTitle(pathname)}>
      <form role="search" onSubmit={submit} className="relative hidden w-72 lg:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search organizations and people"
          aria-label="Search organizations and people"
          className={`${input} min-h-10 bg-slate-50 pl-10 text-sm hover:bg-white focus:bg-white`}
        />
      </form>
      <Link
        to={adminPaths.search}
        aria-label="Search"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-rc-navy hover:bg-slate-100 lg:hidden ${focusRing}`}
      >
        <Search className="h-5 w-5" aria-hidden />
      </Link>
      <AccountMenu />
    </ShellHeader>
  )
}

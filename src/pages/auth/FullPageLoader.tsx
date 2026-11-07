import { LogoMark } from '../../components/brand/LogoMark'

// While the session check runs: just the mark, so nothing flashes before we know who is signed in.
export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white" role="status" aria-label={label}>
      <LogoMark className="h-16 w-16 animate-pulse" />
    </div>
  )
}

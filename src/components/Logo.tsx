import { Link } from 'react-router-dom'
import { LogoMark, wordmark } from './brand/LogoMark'

interface Props {
  to?: string
  size?: 'sm' | 'md'
}

// The Relay Collective logo: the loop mark with the Space Grotesk wordmark
export function Logo({ to = '/', size = 'md' }: Props) {
  const mark = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const text = size === 'sm' ? 'text-[19px]' : 'text-2xl'
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      aria-label="Relay Collective home"
    >
      <LogoMark className={mark} />
      <span className={`${wordmark} ${text}`}>Relay Collective</span>
    </Link>
  )
}

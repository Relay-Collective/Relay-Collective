import { MailCheck, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormAlert } from '../../components/auth/FormAlert'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { primaryButton, secondaryButton } from '../../components/ui'
import { isNative } from '../../native/platform'
import { dataService } from '../../services'

const RESEND_COOLDOWN_S = 60

// After sign-up with email confirmation on. Worded the same whether or not the address already had an
// account, so this screen can't be used to find out who uses Relay Collective.
export function CheckEmail({ email }: { email: string }) {
  const [wait, setWait] = useState(RESEND_COOLDOWN_S)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>()

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  async function resend() {
    setSending(true)
    setMessage(undefined)
    try {
      await dataService.resendVerification(email)
      setMessage({ tone: 'success', text: 'If a confirmation is waiting for this address, we sent a new link.' })
      setWait(RESEND_COOLDOWN_S)
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <StatusScreen
      icon={<MailCheck className="h-7 w-7" />}
      title="Check your email"
      actions={
        <>
          <button type="button" className={`${secondaryButton} w-full`} onClick={resend} disabled={sending || wait > 0}>
            <RotateCw className={`h-5 w-5 ${sending ? 'animate-spin' : ''}`} aria-hidden />
            {wait > 0 ? `Send the link again in ${wait}s` : sending ? 'Sending…' : 'Send the link again'}
          </button>
          <Link to="/signin" className={`${primaryButton} w-full`}>
            Go to sign in
          </Link>
        </>
      }
    >
      <p>
        We sent a confirmation link to <strong className="break-all text-rc-navy">{email}</strong>. Open it to confirm it's you, and we'll
        take you to the next step.
      </p>
      {isNative && <p>The link opens the Relay Collective website. After confirming, come back here and sign in.</p>}
      <p className="text-sm text-slate-500">Can't find it? Check your spam folder. The link works once and expires after a while.</p>
      {message && (
        <FormAlert tone={message.tone} className="text-left">
          {message.text}
        </FormAlert>
      )}
    </StatusScreen>
  )
}

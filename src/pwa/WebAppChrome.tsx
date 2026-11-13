import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { isNative } from '../native/platform'

// A new screen starts at its title. Browser Back keeps native scroll restoration, and
// in-page links (settings sections, booking review) keep their own scroll behavior.
export function WebAppChrome() {
  const { pathname, hash } = useLocation()
  const navigation = useNavigationType()
  useEffect(() => {
    if (navigation !== 'POP' && !hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, navigation])

  // Give a small screen back to the form while its software keyboard is showing.
  useEffect(() => {
    if (isNative || !window.visualViewport || !window.matchMedia('(pointer: coarse)').matches) return
    const viewport = window.visualViewport
    const root = document.documentElement
    const update = () => {
      const field = document.activeElement
      const typing = field instanceof HTMLElement && field.matches(
        'textarea, [contenteditable="true"], input:not([type=radio],[type=checkbox],[type=button],[type=submit],[type=file])',
      )
      root.classList.toggle('web-keyboard-open', typing && viewport.scale === 1 && window.innerHeight - viewport.height > 150)
    }
    viewport.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      viewport.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      root.classList.remove('web-keyboard-open')
    }
  }, [])

  return null
}

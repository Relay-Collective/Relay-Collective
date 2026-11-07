// Unfinished onboarding survives a refresh or a closed tab, per signed-in identity, on this device only.
// Drafts hold form answers about an organization, a vehicle, or volunteering interests. Never passwords, tokens, or documents:
// callers pass only those answers. Signing out clears every draft, so a shared computer doesn't keep them.

const PREFIX = 'rc-onboarding:'
// The one-step registration form from before identity-first onboarding
const LEGACY_KEYS = ['careride-register-draft-v5']

// careride: a general volunteer's CareRide driver application, from the volunteer workspace
export type DraftKind = 'organization' | 'provider' | 'volunteer' | 'careride'

function key(kind: DraftKind, identityId: string): string {
  return `${PREFIX}${kind}:${identityId}`
}

export function loadDraft<T extends object>(kind: DraftKind, identityId: string, fallback: T): { value: T; step?: string } {
  try {
    const raw = localStorage.getItem(key(kind, identityId))
    if (raw) {
      const saved = JSON.parse(raw) as { value?: Partial<T>; step?: string }
      return { value: { ...fallback, ...saved.value }, step: saved.step }
    }
  } catch {
    // Missing, blocked, or broken: start fresh
  }
  return { value: fallback }
}

// Whether an unfinished draft is saved for this identity on this device
export function hasDraft(kind: DraftKind, identityId: string): boolean {
  try {
    return localStorage.getItem(key(kind, identityId)) !== null
  } catch {
    return false
  }
}

export function saveDraft<T extends object>(kind: DraftKind, identityId: string, value: T, step: string): void {
  try {
    localStorage.setItem(key(kind, identityId), JSON.stringify({ value, step }))
  } catch {
    // Storage blocked: the draft just won't survive a refresh
  }
}

export function clearDraft(kind: DraftKind, identityId: string): void {
  try {
    localStorage.removeItem(key(kind, identityId))
  } catch {
    // Nothing to clear
  }
}

export function clearOnboardingDrafts(): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
      (k): k is string => !!k && (k.startsWith(PREFIX) || LEGACY_KEYS.includes(k)),
    )
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // Storage blocked: there were no drafts to keep
  }
}

import { createContext } from 'react'
import type { Loadable } from '../hooks/useLoadable'
import type { ProductFeedback, ProductFeedbackType } from '../types'

// What a "Send feedback" button can ask for, e.g. feedback about one update from What's New
export interface FeedbackOpenOptions {
  type?: ProductFeedbackType
  release?: string
}

// Feedback & Suggestions, available on every signed-in page: one dialog for the whole app, and the
// signed-in person's own feedback (for "Updated" markers in navigation and on My feedback).
export interface FeedbackState {
  openFeedback: (options?: FeedbackOpenOptions) => void
  canSend: boolean // signed in with a role
  mine: Loadable<ProductFeedback[]>
  unseenCount: number
  isUnseen: (feedback: ProductFeedback) => boolean
  markSeen: (feedback: ProductFeedback) => void
}

export const FeedbackContext = createContext<FeedbackState | undefined>(undefined)

import { useContext } from 'react'
import { FeedbackContext, type FeedbackState } from '../context/feedbackContext'

export function useFeedback(): FeedbackState {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return ctx
}

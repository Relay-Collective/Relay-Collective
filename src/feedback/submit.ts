import type { DataService, NewProductFeedback } from '../services/dataService'
import type { FeedbackAttachment, ProductFeedback } from '../types'
import type { PreparedScreenshot } from './screenshot'

export interface SendOutcome {
  feedback: ProductFeedback
  attachment?: FeedbackAttachment
  attachmentError?: string // the feedback is saved; only the screenshot needs another try
}

// Sends the form, then its screenshot. A failed upload never loses the feedback: it's reported
// separately so the person can try the screenshot again (retryScreenshot) or leave it.
export async function sendFeedback(
  service: Pick<DataService, 'submitProductFeedback' | 'attachFeedbackScreenshot'>,
  input: NewProductFeedback,
  clientRequestId: string,
  screenshot?: PreparedScreenshot,
): Promise<SendOutcome> {
  const feedback = await service.submitProductFeedback(input, clientRequestId)
  if (!screenshot) return { feedback }
  return { feedback, ...(await retryScreenshot(service, feedback.id, screenshot)) }
}

export async function retryScreenshot(
  service: Pick<DataService, 'attachFeedbackScreenshot'>,
  feedbackId: string,
  screenshot: PreparedScreenshot,
): Promise<Pick<SendOutcome, 'attachment' | 'attachmentError'>> {
  try {
    return { attachment: await service.attachFeedbackScreenshot(feedbackId, screenshot.file, screenshot.name) }
  } catch (err) {
    return { attachmentError: err instanceof Error ? err.message : 'The screenshot didn’t upload.' }
  }
}

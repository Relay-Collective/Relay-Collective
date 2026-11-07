import {
  checkScreenshot,
  cleanFileName,
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_UNREADABLE,
  SCREENSHOT_WRONG_TYPE,
  sniffImageType,
  type ScreenshotType,
} from './rules'

export interface PreparedScreenshot {
  file: Blob
  type: ScreenshotType
  name: string
}

// Checks a chosen screenshot is really a small PNG, JPEG or WebP image, then redraws it so hidden details
// in the file (camera, location, editing software) aren't kept. Throws with a message to show.
export async function prepareScreenshot(file: File): Promise<PreparedScreenshot> {
  const declared = checkScreenshot(file)
  if (declared) throw new Error(declared)
  const type = sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!type) throw new Error(SCREENSHOT_UNREADABLE)
  if (type !== file.type) throw new Error(SCREENSHOT_WRONG_TYPE)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(SCREENSHOT_UNREADABLE)
  }
  const name = cleanFileName(file.name, type)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    const redrawn = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
    // A browser that can't write this format (or a redraw that grew too big) keeps the checked original
    if (redrawn && redrawn.type === type && redrawn.size <= MAX_SCREENSHOT_BYTES) return { file: redrawn, type, name }
  } finally {
    bitmap.close()
  }
  return { file, type, name }
}

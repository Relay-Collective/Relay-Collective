import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { DataService, NewProductFeedback } from '../src/services/dataService'
import type { ProductFeedback } from '../src/types'

function memoryStorage() {
  const mem = new Map<string, string>()
  return {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value)
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })

const { mockService, resetDemoData } = (await import('../src/services/mockService')) as { mockService: DataService; resetDemoData: () => void }
const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD } = await import('../src/services/seed')
const rules = await import('../src/feedback/rules')
const { sendFeedback, retryScreenshot } = await import('../src/feedback/submit')
const { hasUnseenUpdate } = await import('../src/feedback/seen')
const { myFeedbackPaths } = await import('../src/feedback/paths')

const PARTNER = 'belkin@careride.demo'
const OTHER_PARTNER = 'richmond@careride.demo'
const DRIVER = 'frank@careride.demo'

const asPartner = () => mockService.signIn(PARTNER, DEMO_PASSWORD)
const asAdmin = () => mockService.signIn(ADMIN_EMAIL, ADMIN_PASSWORD)

const bug: NewProductFeedback = {
  feedbackType: 'bug',
  title: 'Ride list does not refresh',
  description: 'After booking, the ride only shows once I reload.',
  sourcePage: '/workspace/transportation',
  sourceWorkspace: 'organization',
}

const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' })

async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (err: Error) => pattern.test(err.message))
}

describe('feedback rules', () => {
  test('the related page keeps only an app route, without queries, fragments or anything identifying', () => {
    assert.equal(rules.sanitizeRoute('/workspace/transportation/rides/ride-1a2b3c?edit=1#top'), '/workspace/transportation/rides/:id')
    assert.equal(rules.sanitizeRoute('/admin/approvals/drivers/0b5f8c1e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'), '/admin/approvals/drivers/:id')
    assert.equal(rules.sanitizeRoute('/invite/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'), '/invite/:id')
    assert.equal(rules.sanitizeRoute('/volunteer/profile/verification'), '/volunteer/profile/verification')
    assert.equal(rules.sanitizeRoute('https://example.org/workspace'), undefined)
    assert.equal(rules.sanitizeRoute('//example.org/workspace'), undefined)
    assert.equal(rules.sanitizeRoute('/workspace/%E0%A4%A'), '/workspace/:id')
  })

  test('the related page reads as a place in the app', () => {
    assert.equal(rules.pageLabel('/workspace'), 'Organization workspace · Overview')
    assert.equal(rules.pageLabel('/workspace/transportation/rides/:id'), 'Organization workspace · CareRide')
    assert.equal(rules.pageLabel('/volunteer/availability'), 'Volunteer workspace · Availability')
    assert.equal(rules.pageLabel('/admin/feedback'), 'Admin console · Feedback')
  })

  test('drivers on the transportation pages are sending feedback about driving', () => {
    assert.equal(rules.workspaceFor('DRIVER', '/volunteer/transportation/rides'), 'driver')
    assert.equal(rules.workspaceFor('DRIVER', '/volunteer'), 'volunteer')
    assert.equal(rules.workspaceFor('PARTNER', '/workspace'), 'organization')
    assert.equal(rules.workspaceFor('PLATFORM_ADMIN', '/admin'), 'admin')
  })

  test('the form needs a type, a title and a description, within their limits', () => {
    assert.deepEqual(rules.validateFeedback({ title: ' ', description: '' }), {
      feedbackType: rules.TYPE_REQUIRED,
      title: rules.TITLE_REQUIRED,
      description: rules.DESCRIPTION_REQUIRED,
    })
    assert.deepEqual(rules.validateFeedback({ feedbackType: 'bug', title: 'x'.repeat(151), description: 'x'.repeat(5001) }), {
      title: rules.TITLE_TOO_LONG,
      description: rules.DESCRIPTION_TOO_LONG,
    })
    assert.deepEqual(rules.validateFeedback({ feedbackType: 'general', title: 'Hello', description: 'World' }), {})
    assert.equal(rules.isDraftEmpty({ title: ' ', description: '' }, false), true)
    assert.equal(rules.isDraftEmpty({ title: '', description: '' }, true), false)
  })

  test('screenshots must really be small PNG, JPEG or WebP images', () => {
    assert.equal(rules.sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
    assert.equal(rules.sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
    assert.equal(rules.sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp')
    assert.equal(rules.sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), undefined)
    assert.equal(rules.checkScreenshot({ type: 'image/svg+xml', size: 10 }), rules.SCREENSHOT_WRONG_TYPE)
    assert.equal(rules.checkScreenshot({ type: 'image/png', size: rules.MAX_SCREENSHOT_BYTES + 1 }), rules.SCREENSHOT_TOO_BIG)
    assert.equal(rules.checkScreenshot({ type: 'image/webp', size: 1000 }), undefined)
    assert.equal(rules.cleanFileName('C:\\Users\\me\\Desktop\\bug\u0007.png', 'image/png'), 'bug.png')
    assert.equal(rules.cleanFileName('', 'image/jpeg'), 'screenshot.jpg')
  })

  test('an item shows as updated until it is opened after its latest change', () => {
    const f = { id: 'f1', createdAt: '2026-10-28T10:00:00.000Z', updatedAt: '2026-10-28T12:00:00.000Z' }
    assert.equal(hasUnseenUpdate({ ...f, updatedAt: f.createdAt }, {}), false)
    assert.equal(hasUnseenUpdate(f, {}), true)
    assert.equal(hasUnseenUpdate(f, { f1: '2026-10-28T12:00:00.000Z' }), false)
  })

  test('each role has its own My Feedback page', () => {
    assert.equal(myFeedbackPaths('PARTNER').list, '/workspace/feedback')
    assert.equal(myFeedbackPaths('DRIVER').item('a b'), '/volunteer/feedback/a%20b')
    assert.equal(myFeedbackPaths('PLATFORM_ADMIN').list, '/admin/feedback')
  })
})

describe('sending feedback', () => {
  const sent: ProductFeedback = { id: 'f1', reference: 1001, feedbackType: 'bug', title: 't', description: 'd', sourceWorkspace: 'organization', status: 'new', createdAt: '', updatedAt: '' }
  const screenshot = { file: png(), type: 'image/png' as const, name: 'bug.png' }

  test('a screenshot that fails to upload keeps the feedback, and can be tried again', async () => {
    let attempts = 0
    const service = {
      submitProductFeedback: () => Promise.resolve(sent),
      attachFeedbackScreenshot: () => {
        attempts++
        return attempts === 1
          ? Promise.reject(new Error('Network down'))
          : Promise.resolve({ id: 'a1', storagePath: 'f1/a.png', fileName: 'bug.png', mimeType: 'image/png', fileSize: 12, uploadedAt: 'now' })
      },
    }
    const first = await sendFeedback(service, bug, 'req-1', screenshot)
    assert.equal(first.feedback, sent)
    assert.equal(first.attachmentError, 'Network down')
    const second = await retryScreenshot(service, first.feedback.id, screenshot)
    assert.equal(second.attachment?.id, 'a1')
    assert.equal(second.attachmentError, undefined)
  })

  test('a failed submission is reported, and nothing is uploaded', async () => {
    let uploads = 0
    const service = {
      submitProductFeedback: () => Promise.reject(new Error('Offline')),
      attachFeedbackScreenshot: () => {
        uploads++
        return Promise.reject(new Error('should not run'))
      },
    }
    await rejects(sendFeedback(service, bug, 'req-2', screenshot), /Offline/)
    assert.equal(uploads, 0)
  })
})

describe('the feedback lifecycle (demo backend)', () => {
  beforeEach(async () => {
    resetDemoData()
    await mockService.signOut()
  })

  test('signed-out visitors cannot send feedback', async () => {
    await rejects(mockService.submitProductFeedback(bug, 'r'), /sign in/)
  })

  test('staff feedback goes from sent to resolved, and the submitter only ever sees public replies', async () => {
    // 1–2. Organization staff send feedback; it is saved under them and their organization
    await asPartner()
    const mine = await mockService.submitProductFeedback({ ...bug, sourcePage: '/workspace/transportation/rides/ride-1a2b?x=1', sourceWorkspace: 'admin' }, 'req-1')
    assert.equal(mine.status, 'new')
    assert.equal(mine.sourceWorkspace, 'organization') // decided by role, not by the browser
    assert.equal(mine.sourcePage, '/workspace/transportation/rides/:id')
    assert.ok(!('priority' in mine) && !('assignedTo' in mine))
    const again = await mockService.submitProductFeedback(bug, 'req-1')
    assert.equal(again.id, mine.id) // a retried send doesn't post twice
    assert.deepEqual((await mockService.listMyProductFeedback()).map((f) => f.id), [mine.id])
    await rejects(mockService.listProductFeedback({ limit: 20, offset: 0 }), /Only Relay Collective admins/)
    await rejects(mockService.updateFeedbackTriage(mine.id, { field: 'status', expected: 'new', value: 'resolved' }), /Only Relay Collective admins/)
    await rejects(mockService.addFeedbackMessage(mine.id, 'Hi', 'internal'), /Only Relay Collective admins/)

    // 3–5. An admin sees it in the inbox and marks it Under review; the change is recorded
    await asAdmin()
    const inbox = await mockService.listProductFeedback({ limit: 20, offset: 0 })
    assert.equal(inbox.total, 1)
    assert.equal(inbox.rows[0]!.organization?.name, 'Belkin House')
    assert.equal(inbox.rows[0]!.submittedBy.name, 'Belkin House')
    assert.equal((await mockService.listProductFeedback({ search: `FB-${mine.reference}`, limit: 20, offset: 0 })).total, 1)
    assert.equal((await mockService.listProductFeedback({ status: 'resolved', limit: 20, offset: 0 })).total, 0)
    assert.equal((await mockService.listProductFeedback({ priority: 'none', limit: 20, offset: 0 })).total, 1)
    await mockService.updateFeedbackTriage(mine.id, { field: 'status', expected: 'new', value: 'under_review' })
    await mockService.updateFeedbackTriage(mine.id, { field: 'priority', expected: undefined, value: 'high' })
    let detail = (await mockService.getProductFeedback(mine.id))!
    assert.deepEqual(detail.history.map((h) => [h.previousStatus, h.newStatus, h.changedByName]), [
      [undefined, 'new', 'Belkin House'],
      ['new', 'under_review', 'Relay Collective Admin'],
    ])
    assert.equal((await mockService.getFeedbackSummary()).underReview, 1)

    // 6. The submitter sees the new status, but not the priority
    await asPartner()
    let thread = (await mockService.getMyProductFeedback(mine.id))!
    assert.equal(thread.feedback.status, 'under_review')
    assert.ok(!('priority' in thread.feedback))

    // 7–10. An internal note stays with admins; a public reply reaches the submitter
    await asAdmin()
    await mockService.addFeedbackMessage(mine.id, 'Similar requests from two organizations.', 'internal')
    await mockService.addFeedbackMessage(mine.id, 'Thanks, we have found the issue.', 'public')
    await asPartner()
    thread = (await mockService.getMyProductFeedback(mine.id))!
    assert.deepEqual(thread.messages.map((m) => [m.visibility, m.message, m.authorName]), [['public', 'Thanks, we have found the issue.', undefined]])

    // 11–12. Resolved, and the submitter sees it
    await asAdmin()
    await mockService.updateFeedbackTriage(mine.id, { field: 'status', expected: 'under_review', value: 'resolved' })
    detail = (await mockService.getProductFeedback(mine.id))!
    assert.ok(detail.resolvedAt)
    await asPartner()
    thread = (await mockService.getMyProductFeedback(mine.id))!
    assert.equal(thread.feedback.status, 'resolved')
    assert.ok(thread.feedback.resolvedAt)
    assert.equal(thread.history.length, 3)
  })

  test('drivers send feedback from the volunteer workspace the same way', async () => {
    await mockService.signIn(DRIVER, DEMO_PASSWORD)
    const f = await mockService.submitProductFeedback(
      { ...bug, sourcePage: '/volunteer/transportation', sourceWorkspace: 'driver', feedbackType: 'release_feedback', relatedRelease: '1.4.0' },
      'req-driver',
    )
    assert.equal(f.sourceWorkspace, 'driver')
    assert.equal(f.relatedRelease, '1.4.0')
    await asAdmin()
    const { rows } = await mockService.listProductFeedback({ workspace: 'driver', release: '1.4.0', limit: 20, offset: 0 })
    assert.deepEqual(rows.map((r) => [r.id, r.organization]), [[f.id, undefined]])
  })

  test('people never see someone else’s feedback or screenshot', async () => {
    await asPartner()
    const f = await mockService.submitProductFeedback(bug, 'req-private')
    const attachment = await mockService.attachFeedbackScreenshot(f.id, png(), 'bug.png')
    assert.ok(attachment.uploadedAt)
    assert.match(attachment.storagePath, new RegExp(`^${f.id}/[0-9a-f-]{36}\\.png$`))
    await rejects(mockService.attachFeedbackScreenshot(f.id, png(), 'again.png'), /already has a screenshot/)
    assert.ok((await mockService.getFeedbackScreenshotUrl(attachment)).startsWith('blob:'))

    await mockService.signIn(OTHER_PARTNER, DEMO_PASSWORD)
    assert.deepEqual(await mockService.listMyProductFeedback(), [])
    assert.equal(await mockService.getMyProductFeedback(f.id), undefined)
    await rejects(mockService.getFeedbackScreenshotUrl(attachment), /isn’t available/)
    await rejects(mockService.attachFeedbackScreenshot(f.id, png(), 'mine.png'), /your own feedback/)

    await asAdmin()
    assert.ok((await mockService.getFeedbackScreenshotUrl(attachment)).startsWith('blob:'))
    assert.equal((await mockService.listProductFeedback({ limit: 20, offset: 0 })).rows[0]!.hasAttachment, true)
  })

  test('a stale admin screen cannot overwrite a newer decision, and only admins can be assigned', async () => {
    await asPartner()
    const f = await mockService.submitProductFeedback(bug, 'req-conflict')
    await asAdmin()
    await mockService.updateFeedbackTriage(f.id, { field: 'status', expected: 'new', value: 'planned' })
    await rejects(mockService.updateFeedbackTriage(f.id, { field: 'status', expected: 'new', value: 'closed' }), /Another admin changed/)
    const [admin] = await mockService.listFeedbackAssignees()
    await rejects(mockService.updateFeedbackTriage(f.id, { field: 'assignedTo', expected: undefined, value: 'u-belkin' }), /only be assigned/)
    await mockService.updateFeedbackTriage(f.id, { field: 'assignedTo', expected: undefined, value: admin!.id })
    assert.equal((await mockService.getProductFeedback(f.id))!.assignedTo?.id, admin!.id)
    assert.equal((await mockService.getProductFeedback(f.id))!.status, 'planned')
  })
})

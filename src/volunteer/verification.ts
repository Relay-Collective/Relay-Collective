import { needsProfessionalProof } from '../components/driverDraft'
import type { Driver } from '../types'
import { VERIFICATION_LABELS } from './participation'

const DAY = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

export interface Requirement {
  label: string
  detail: string
  state: 'done' | 'waiting' | 'missing'
  document?: boolean // about an uploaded file
}

// What a driver's verification is made of, from what's on file. Approval is only ever set by the Relay Collective team.
export function verificationRequirements(driver: Driver): Requirement[] {
  const proof = needsProfessionalProof(driver)
  return [
    { label: 'Account and contact details', detail: 'Your name, email, and mobile number.', state: 'done' },
    {
      label: 'Vehicle and service area',
      detail: driver.vehicle.trim() && driver.serviceCities.length ? `${driver.vehicle} · ${driver.serviceCities.join(', ')}` : 'Add your vehicle and the cities you drive in.',
      state: driver.vehicle.trim() && driver.serviceCities.length ? 'done' : 'missing',
    },
    {
      label: proof ? 'Licence and professional permit' : 'Driver’s licence',
      document: true,
      detail:
        driver.licenceFile || driver.proofFile
          ? [driver.licenceFile && 'Licence on file', proof && driver.proofFile && 'Permit on file'].filter(Boolean).join(' · ')
          : 'Uploading documents isn’t available in the app yet. The team checks these with you directly.',
      state: driver.licenceFile && (!proof || driver.proofFile) ? 'done' : 'waiting',
    },
    {
      label: 'Review by the Relay Collective team',
      detail:
        driver.status === 'PENDING'
          ? 'A person on the team is checking your details.'
          : `${VERIFICATION_LABELS[driver.status]}${driver.reviewedAt ? ` on ${DAY.format(new Date(driver.reviewedAt))}` : ''}.`,
      state: driver.status === 'APPROVED' ? 'done' : driver.status === 'PENDING' ? 'waiting' : 'missing',
    },
  ]
}

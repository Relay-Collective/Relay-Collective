import { useContext } from 'react'
import { VolunteerContext, type VolunteerState } from '../context/volunteerContext'

export function useVolunteer(): VolunteerState {
  const ctx = useContext(VolunteerContext)
  if (!ctx) throw new Error('useVolunteer must be used inside <VolunteerProvider>')
  return ctx
}

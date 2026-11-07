import { useContext } from 'react'
import { AdminContext, type AdminState } from '../context/adminContext'

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>')
  return ctx
}

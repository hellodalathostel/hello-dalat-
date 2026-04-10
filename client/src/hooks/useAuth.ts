import { useContext } from 'react'
import { AuthContext } from '../contexts/authContext'

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}

export function useAuth() {
  return useAuthContext()
}

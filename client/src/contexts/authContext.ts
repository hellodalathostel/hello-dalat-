import { createContext } from 'react'
import type { User } from 'firebase/auth'

export interface AuthContextValue {
  currentUser: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

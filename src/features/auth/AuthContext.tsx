import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createBackend, initBackend, asMock } from '@/lib/backend'
import type { AuthUser, Backend } from '@/lib/backend'
import { DEMO_MODERATOR_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD } from '@/lib/backend/demo-data'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  backend: Backend | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: Parameters<NonNullable<Backend>['signUp']>[0]) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (patch: Parameters<NonNullable<Backend>['updateProfile']>[0]) => Promise<void>
  demoHint: { moderator: string; participant: string; password: string } | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | undefined
    createBackend().then((b) => {
      initBackend(b)
      setBackend(b)
      unsub = b.subscribeToAuth(setUser)
      b.restoreSession().then((u) => {
        setUser(u)
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
    return () => unsub?.()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!backend) throw new Error('not ready')
    const u = await backend.signIn(email, password)
    setUser(u)
  }

  const signUp = async (input: Parameters<NonNullable<Backend>['signUp']>[0]) => {
    if (!backend) throw new Error('not ready')
    const u = await backend.signUp(input)
    setUser(u)
  }

  const signOut = async () => {
    if (!backend) return
    await backend.signOut()
    setUser(null)
  }

  const updateProfile = async (patch: Parameters<NonNullable<Backend>['updateProfile']>[0]) => {
    if (!backend) throw new Error('not ready')
    const u = await backend.updateProfile(patch)
    setUser(u)
  }

  const mock = backend ? asMock(backend) : null
  const demoHint = mock
    ? { moderator: DEMO_MODERATOR_EMAIL, participant: DEMO_PARTICIPANT_EMAIL, password: DEMO_PASSWORD }
    : null

  return (
    <AuthContext.Provider value={{ user, loading, backend, signIn, signUp, signOut, updateProfile, demoHint }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

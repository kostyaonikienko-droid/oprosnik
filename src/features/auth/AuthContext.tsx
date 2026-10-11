import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppError } from '@/lib/errors'
import { createBackend, initBackend, asMock } from '@/lib/backend'
import type { AuthUser, Backend } from '@/lib/backend'
import { DEMO_MODERATOR_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD } from '@/lib/backend/demo-data'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  backend: Backend | null
  backendError: string | null
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
  const [backendError, setBackendError] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    createBackend().then((b) => {
      initBackend(b)
      setBackend(b)
      setBackendError(null)
      unsub = b.subscribeToAuth(setUser)
      b.restoreSession().then((u) => {
        setUser(u)
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch((err) => {
      setBackendError(err instanceof AppError ? err.message : String(err))
      setLoading(false)
    })
    return () => unsub?.()
  }, [])

  const requireBackend = (): Backend => {
    if (!backend) throw new AppError('not-configured', backendError ?? 'Хранилище не инициализировано')
    return backend
  }

  const signIn = async (email: string, password: string) => {
    const b = requireBackend()
    const u = await b.signIn(email, password)
    setUser(u)
  }

  const signUp = async (input: Parameters<NonNullable<Backend>['signUp']>[0]) => {
    const b = requireBackend()
    const u = await b.signUp(input)
    setUser(u)
  }

  const signOut = async () => {
    if (!backend) return
    await backend.signOut()
    setUser(null)
  }

  const updateProfile = async (patch: Parameters<NonNullable<Backend>['updateProfile']>[0]) => {
    const b = requireBackend()
    const u = await b.updateProfile(patch)
    setUser(u)
  }

  const mock = backend ? asMock(backend) : null
  const demoHint = mock
    ? { moderator: DEMO_MODERATOR_EMAIL, participant: DEMO_PARTICIPANT_EMAIL, password: DEMO_PASSWORD }
    : null

  return (
    <AuthContext.Provider value={{ user, loading, backend, backendError, signIn, signUp, signOut, updateProfile, demoHint }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

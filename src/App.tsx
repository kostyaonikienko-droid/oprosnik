import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth, AuthProvider } from '@/features/auth/AuthContext'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { MySurveysPage } from '@/features/participant/MySurveysPage'
import { SurveyPage } from '@/features/participant/SurveyPage'
import { ConstructorPage } from '@/features/publish/ConstructorPage'
import { ModeratorPage } from '@/features/moderator/ModeratorPage'
import { Layout } from '@/ui/layout'
import { Loading } from '@/ui/status'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'moderator' }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/me" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <Loading />

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/me" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/me" replace /> : <RegisterPage />} />
        <Route path="/me" element={<ProtectedRoute><MySurveysPage /></ProtectedRoute>} />
        <Route path="/survey/:id" element={<ProtectedRoute><SurveyPage /></ProtectedRoute>} />
        <Route path="/publish" element={<ProtectedRoute role="moderator"><ConstructorPage /></ProtectedRoute>} />
        <Route path="/moderator" element={<ProtectedRoute role="moderator"><ModeratorPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to={user ? '/me' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

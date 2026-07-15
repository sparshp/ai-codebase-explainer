import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthBootstrap }  from './components/AuthBootstrap'
import { LoginPage }      from './pages/LoginPage'
import { RegisterPage }   from './pages/RegisterPage'
import { DashboardPage }  from './pages/DashboardPage'
import { ChatPage }       from './pages/ChatPage'
import { useAuthStore }   from './store/auth.store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Routes>
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/register"         element={<RegisterPage />} />
          <Route path="/app"              element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/app/chat/:repoId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="*"                 element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  )
}
import { useEffect } from 'react'
import { useAuthStore } from '../store/auth.store'
import axios from 'axios'
import { apiUrl } from '../api/base'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const {
    accessToken, refreshToken,
    setAuth, setUser, clearAuth,
    isBootstrapping, setBootstrapping,
  } = useAuthStore()

  useEffect(() => {
    async function bootstrap() {
      // No refresh token — nothing to restore
      if (!refreshToken) {
        setBootstrapping(false)
        return
      }

      // Already have a valid access token in memory — skip refresh
      if (accessToken) {
        // Still validate by fetching /auth/me
        try {
          const res = await axios.get(apiUrl('/auth/me'), {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          setUser(res.data)
        } catch {
          // Access token expired — try refresh
          await silentRefresh(refreshToken, setAuth, setUser, clearAuth)
        } finally {
          setBootstrapping(false)
        }
        return
      }

      // No access token but have refresh token — restore session
      await silentRefresh(refreshToken, setAuth, setUser, clearAuth)
      setBootstrapping(false)
    }

    bootstrap()
  }, [])  // runs once on mount

  // Show nothing while restoring session — prevents flash of login page
  if (isBootstrapping) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background-tertiary)',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
          Loading...
        </div>
      </div>
    )
  }

  return <>{children}</>
}

async function silentRefresh(
  refreshToken: string,
  setAuth:      (a: string, r: string) => void,
  setUser:      (u: any) => void,
  clearAuth:    () => void
) {
  try {
    const res = await axios.post(apiUrl('/auth/refresh'), { refreshToken })
    const { accessToken: newAccess, refreshToken: newRefresh } = res.data
    setAuth(newAccess, newRefresh)

    // Fetch user profile with new token
    const me = await axios.get(apiUrl('/auth/me'), {
      headers: { Authorization: `Bearer ${newAccess}` },
    })
    setUser(me.data)
  } catch {
    // Refresh token expired — clear everything, user must log in again
    clearAuth()
  }
}
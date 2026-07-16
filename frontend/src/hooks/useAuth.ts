import { useCallback } from 'react'
import { useAuthStore } from '../store/auth.store'
import { authApi } from '../api/auth.api'

export function useAuth() {
  const { setAuth, setUser, clearAuth, isAuthenticated, user } = useAuthStore()

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setAuth(res.accessToken, res.refreshToken)
    setUser(res.user)
  }, [setAuth, setUser])

  const register = useCallback(async (email: string, password: string) => {
    const res = await authApi.register(email, password)
    setAuth(res.accessToken, res.refreshToken)
    setUser(res.user)
  }, [setAuth, setUser])

  const logout = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  return { login, register, logout, isAuthenticated, user }
}

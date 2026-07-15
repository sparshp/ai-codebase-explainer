import { useCallback } from 'react'
import { useAuthStore } from '../store/auth.store'
import { authApi } from '../api/auth.api'

export function useAuth() {
  const { setAuth, setUser, clearAuth, isAuthenticated, user } = useAuthStore()

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password)
    setAuth(tokens.accessToken, tokens.refreshToken)
    const me = await authApi.me()
    setUser(me)
  }, [setAuth, setUser])

  const register = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.register(email, password)
    setAuth(tokens.accessToken, tokens.refreshToken)
    const me = await authApi.me()
    setUser(me)
  }, [setAuth, setUser])

  const logout = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  return { login, register, logout, isAuthenticated, user }
}
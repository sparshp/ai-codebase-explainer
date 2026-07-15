import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id:    string
  email: string
}

interface AuthState {
  accessToken:     string | null
  refreshToken:    string | null
  user:            User | null
  isAuthenticated: boolean
  isBootstrapping: boolean   // true while we're silently refreshing on load
  setAuth:         (access: string, refresh: string) => void
  setUser:         (user: User) => void
  clearAuth:       () => void
  setBootstrapping:(v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,
      isBootstrapping: true,   // start as true — resolved in AuthBootstrap
      setAuth: (access, refresh) => set({
        accessToken:     access,
        refreshToken:    refresh,
        isAuthenticated: true,
        isBootstrapping: false,
      }),
      setUser:          (user)  => set({ user }),
      clearAuth:        ()      => set({
        accessToken: null, refreshToken: null,
        user: null, isAuthenticated: false,
        isBootstrapping: false,
      }),
      setBootstrapping: (v)     => set({ isBootstrapping: v }),
    }),
    {
      name:        'auth-storage',
      // Persist everything — both tokens + user
      partialize:  (s) => ({
        accessToken:     s.accessToken,
        refreshToken:    s.refreshToken,
        user:            s.user,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
)
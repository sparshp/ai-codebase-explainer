import axios from 'axios'
import { useAuthStore } from '../store/auth.store'
import { apiUrl } from './base'

export const apiClient = axios.create({
  baseURL: apiUrl(''),
  withCredentials: true,
})

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
apiClient.interceptors.response.use(
  res => res,
  async (err) => {
    if (err?.response?.status === 401) {
      const { refreshToken, setAuth, clearAuth } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const res = await axios.post(apiUrl('/auth/refresh'), { refreshToken })
          setAuth(res.data.accessToken, res.data.refreshToken)
          err.config.headers.Authorization = `Bearer ${res.data.accessToken}`
          return axios(err.config)
        } catch {
          clearAuth()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

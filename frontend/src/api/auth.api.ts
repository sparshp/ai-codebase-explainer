import { apiClient } from './client'

export const authApi = {
  register: (email: string, password: string) =>
    apiClient.post('/auth/register', { email, password }).then(r => r.data),

  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then(r => r.data),

  me: () =>
    apiClient.get('/auth/me').then(r => r.data),

  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }).then(r => r.data),
}
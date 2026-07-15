import { apiClient } from './client'

export interface HealthStatus {
  status:   'ok' | 'degraded'
  services: {
    postgres: 'ok' | 'down'
    redis:    'ok' | 'down'
    chroma:   'ok' | 'down'
  }
  uptime: number
}

export const healthApi = {
  check: () =>
    apiClient.get<HealthStatus>('/health').then(r => r.data),
}

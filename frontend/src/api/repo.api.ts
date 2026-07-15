import { apiClient } from './client'

export const repoApi = {
  ingest: (url: string, branch = 'main') =>
    apiClient.post('/repos', { url, branch }).then(r => r.data),

  status: (jobId: string) =>
    apiClient.get(`/repos/status/${jobId}`).then(r => r.data),

  list: () =>
    apiClient.get('/repos').then(r => r.data),

  get: (repoId: string) =>
    apiClient.get(`/repos/${repoId}`).then(r => r.data),

  delete: (repoId: string) =>
    apiClient.delete(`/repos/${repoId}`).then(r => r.data),

  history: (repoId: string, limit = 50, offset = 0) =>
    apiClient.get(`/repos/${repoId}/history`, { params: { limit, offset } }).then(r => r.data),

  stats: () =>
    apiClient.get('/repos/stats').then(r => r.data),

  reindex: (repoId: string) =>
    apiClient.post(`/repos/${repoId}/reindex`).then(r => r.data),
}
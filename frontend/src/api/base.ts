/** API base URL. Dev uses Vite proxy prefix `/api`; production uses full backend URL. */
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE = raw?.replace(/\/$/, '') || '/api'

/** Build a request URL for a backend path like `/auth/login`. */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (API_BASE === '/api') return `/api${p}`
  return `${API_BASE}${p}`
}

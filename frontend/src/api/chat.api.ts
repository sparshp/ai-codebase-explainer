import { useAuthStore } from '../store/auth.store'
import { apiUrl } from './base'
import type { QueryIntent } from '../constants/queryIntents'

export interface SSEHandlers {
  onToken:     (token: string) => void
  onCitations: (citations: Record<string, any>, meta: { conversationId: string; latencyMs: number }) => void
  onStep?:     (step: number, searchQuery: string) => void
  onDone:      () => void
  onError:     (msg: string) => void
}

export function streamQuery(
  question:       string,
  repoId:         string,
  conversationId: string | undefined,
  handlers:       SSEHandlers,
  intent?:        QueryIntent,
  endpoint = apiUrl('/chat/query/stream')
): () => void {
  const controller = new AbortController()
  const token      = useAuthStore.getState().accessToken

  fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body:   JSON.stringify({ question, repoId, conversationId, intent }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.body) { handlers.onError('No response body'); return }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let   buf     = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') { handlers.onDone(); return }

        try {
          const event = JSON.parse(raw)
          if (event.type === 'token')     handlers.onToken(event.token)
          if (event.type === 'citations') handlers.onCitations(event.citations, {
            conversationId: event.conversationId,
            latencyMs:      event.latencyMs,
          })
          if (event.type === 'step' && handlers.onStep)
            handlers.onStep(event.step, event.searchQuery)
          if (event.type === 'error')     handlers.onError(event.message)
        } catch {}
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') handlers.onError(err.message)
  })

  return () => controller.abort()
}

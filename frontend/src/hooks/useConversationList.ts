import { useState, useEffect, useCallback } from 'react'
import { repoApi } from '../api/repo.api'

export interface ConversationSummary {
  conversationId:  string
  firstQuestion:   string
  questionCount:   number
  lastAskedAt:     string
}

export function useConversationList(repoId: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading,       setLoading]       = useState(false)

  const load = useCallback(async () => {
    if (!repoId) return
    setLoading(true)
    try {
      const history = await repoApi.history(repoId, 200, 0)

      // Group by conversationId
      const grouped = new Map<string, any[]>()
      for (const item of history) {
        const key = item.conversation_id
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(item)
      }

      const summaries: ConversationSummary[] = []
      for (const [convId, items] of grouped) {
        summaries.push({
          conversationId: convId,
          firstQuestion:  items[0].question,
          questionCount:  items.length,
          lastAskedAt:    items[items.length - 1].created_at,
        })
      }

      // Most recent first
      summaries.sort((a, b) =>
        new Date(b.lastAskedAt).getTime() - new Date(a.lastAskedAt).getTime()
      )
      setConversations(summaries)
    } finally {
      setLoading(false)
    }
  }, [repoId])

  useEffect(() => { load() }, [load])

  return { conversations, loading, reload: load }
}
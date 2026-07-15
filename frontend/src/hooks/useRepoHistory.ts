import { useState, useEffect } from 'react'
import { repoApi } from '../api/repo.api'

export interface HistoryItem {
  id:                  string
  conversation_id:     string
  question:            string
  answer:              string
  citations:           Record<string, any>
  latency_ms:          number
  hallucination_count: number
  created_at:          string
}

export function useRepoHistory(repoId: string | null) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!repoId) return
    setLoading(true)
    repoApi.history(repoId)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [repoId])

  return { history, loading }
}

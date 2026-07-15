import { useState, useEffect, useCallback } from 'react'
import { repoApi } from '../api/repo.api'

export interface RepoSummary {
  id:                 string
  url:                string
  name:               string
  branch:             string
  status:             string
  created_at:         string
  updated_at:         string
  conversation_count: number
  file_count:         number
  chunk_count:        number
}

export function useRepoList() {
  const [repos,   setRepos]   = useState<RepoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [repoList, userStats] = await Promise.all([
        repoApi.list(),
        repoApi.stats(),
      ])
      setRepos(repoList)
      setStats(userStats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const deleteRepo = async (repoId: string) => {
    await repoApi.delete(repoId)
    setRepos(prev => prev.filter(r => r.id !== repoId))
  }

  return { repos, stats, loading, reload: load, deleteRepo }
}
import { useState, useCallback, useRef } from 'react'
import { repoApi } from '../api/repo.api'
import { validateGitHubRepoUrl } from '../utils/githubUrl'

type Status = 'idle' | 'ingesting' | 'ready' | 'failed'

export function useIngestRepo() {
  const [status,   setStatus]   = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [repoId,   setRepoId]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ingest = useCallback(async (url: string, branch = 'main') => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    const urlError = validateGitHubRepoUrl(url)
    if (urlError) {
      setStatus('failed')
      setError(urlError)
      return
    }

    setStatus('ingesting')
    setProgress(0)
    setError(null)
    setIsExisting(false)

    try {
      const res = await repoApi.ingest(url.trim(), branch.trim() || 'main')
      setRepoId(res.repoId)

      if (res.isExisting) {
        setIsExisting(true)
        setProgress(100)
        setStatus('ready')
        return
      }

      pollRef.current = setInterval(async () => {
        try {
          const st = await repoApi.status(res.jobId)
          setProgress(st.progress)
          if (st.status === 'completed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setStatus('ready')
          } else if (st.status === 'failed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setStatus('failed')
            setError(st.error || 'Ingestion failed')
          }
        } catch {}
      }, 3000)

    } catch (err: any) {
      setStatus('failed')
      setError(err?.response?.data?.error || err.message)
    }
  }, [])

  return { status, progress, repoId, error, isExisting, ingest }
}

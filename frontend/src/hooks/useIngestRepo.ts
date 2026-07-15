import { useState, useCallback, useRef } from 'react'
import { repoApi } from '../api/repo.api'

type Status = 'idle' | 'ingesting' | 'ready' | 'failed'

export function useIngestRepo() {
  const [status,   setStatus]   = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [repoId,   setRepoId]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ingest = useCallback(async (url: string, branch = 'main') => {
    setStatus('ingesting')
    setProgress(0)
    setError(null)
    setIsExisting(false)

    try {
      const res = await repoApi.ingest(url, branch)
      setRepoId(res.repoId)

      // Existing repo — already ready, no polling needed
      if (res.isExisting) {
        setIsExisting(true)
        setProgress(100)
        setStatus('ready')
        return
      }

      // New repo — poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const st = await repoApi.status(res.jobId)
          setProgress(st.progress)
          if (st.status === 'completed') {
            clearInterval(pollRef.current!)
            setStatus('ready')
          } else if (st.status === 'failed') {
            clearInterval(pollRef.current!)
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

import { useState } from 'react'
import { useIngestRepo } from '../../hooks/useIngestRepo'

interface Props { onReady: (repoId: string) => void }

export function RepoInput({ onReady }: Props) {
  const [url, setUrl]       = useState('')
  const [branch, setBranch] = useState('main')
  const { status, progress, repoId, error, isExisting, ingest } = useIngestRepo()

  if (status === 'ready' && repoId) onReady(repoId)

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h2 className="text-lg font-medium mb-1 text-gray-800">Index a GitHub Repository</h2>
      <p className="text-sm text-gray-400 mb-4">
        Paste any public GitHub repo URL to start asking questions about it
      </p>

      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && url && ingest(url, branch)}
          disabled={status === 'ingesting'}
        />
        <input
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          placeholder="branch"
          value={branch}
          onChange={e => setBranch(e.target.value)}
          disabled={status === 'ingesting'}
        />
        <button
          onClick={() => url && ingest(url, branch)}
          disabled={status === 'ingesting' || !url}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'ingesting' ? 'Indexing...' : 'Index'}
        </button>
      </div>

      {status === 'ingesting' && !isExisting && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Indexing repository...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isExisting && (
        <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
          <span>↩</span>
          <span>Already indexed — loading your previous session...</span>
        </div>
      )}

      {status === 'ready' && !isExisting && (
        <p className="text-sm text-green-600">✓ Repository indexed and ready</p>
      )}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  )
}

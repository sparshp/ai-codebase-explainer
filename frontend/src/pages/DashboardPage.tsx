import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoList, type RepoSummary } from '../hooks/useRepoList'
import { useRepoHistory } from '../hooks/useRepoHistory'
import { useAuth } from '../hooks/useAuth'
import { useIngestRepo } from '../hooks/useIngestRepo'
import { SystemHealthBar } from '../components/SystemHealthBar'
import { repoApi } from '../api/repo.api'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-2xl font-semibold text-gray-900">{value ?? '—'}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function RepoCard({
  repo,
  onOpen,
  onDelete,
  onHistory,
  onReindex,
}: {
  repo:      RepoSummary
  onOpen:    () => void
  onDelete:  () => void
  onHistory: () => void
  onReindex: () => void
}) {
  const [reindexing, setReindexing] = useState(false)
  const statusColor = {
    ready:      'bg-green-100 text-green-700',
    processing: 'bg-yellow-100 text-yellow-700',
    queued:     'bg-gray-100 text-gray-600',
    failed:     'bg-red-100 text-red-600',
  }[repo.status] || 'bg-gray-100 text-gray-600'

  const handleReindex = async () => {
    if (!confirm('Re-index this repository? This may take a few minutes.')) return
    setReindexing(true)
    try {
      await onReindex()
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">{repo.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {repo.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono truncate mb-2">{repo.url}</p>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>{repo.file_count} files</span>
            <span>{repo.chunk_count} chunks</span>
            <span>{repo.conversation_count} questions asked</span>
            <span>branch: {repo.branch}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={onOpen}
          disabled={repo.status !== 'ready' && repo.status !== 'failed'}
          className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Open Chat
        </button>
        <button
          onClick={onHistory}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
        >
          History ({repo.conversation_count})
        </button>
        <button
          onClick={handleReindex}
          disabled={reindexing || repo.status === 'processing' || repo.status === 'queued'}
          className="px-3 py-1.5 border border-amber-200 text-amber-700 text-xs rounded-lg hover:bg-amber-50 disabled:opacity-40"
          title="Re-run ingestion / debug failed index"
        >
          {reindexing ? '…' : 'Re-index'}
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function HistoryDrawer({
  repoId,
  repoName,
  onClose,
  onReopen,
}: {
  repoId:   string
  repoName: string
  onClose:  () => void
  onReopen: (conversationId: string) => void
}) {
  const { history, loading } = useRepoHistory(repoId)

  // Group by conversationId
  const grouped = history.reduce((acc, item) => {
    if (!acc[item.conversation_id]) acc[item.conversation_id] = []
    acc[item.conversation_id].push(item)
    return acc
  }, {} as Record<string, typeof history>)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Question history</h2>
            <p className="text-xs text-gray-400 mt-0.5">{repoName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            No questions asked yet
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {Object.entries(grouped).map(([convId, items]) => (
              <div key={convId} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Conversation header */}
                <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(items[items.length - 1].created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => onReopen(convId)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Continue →
                  </button>
                </div>

                {/* Questions in this conversation */}
                {items.map(item => (
                  <div key={item.id} className="px-4 py-3 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      Q: {item.question}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.answer.slice(0, 150)}...
                    </p>
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{(item.latency_ms / 1000).toFixed(1)}s</span>
                      <span>{Object.keys(item.citations || {}).length} citations</span>
                      {item.hallucination_count > 0 && (
                        <span className="text-orange-500">
                          {item.hallucination_count} unverified
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { repos, stats, loading, reload, deleteRepo } = useRepoList()
  const { logout, user }  = useAuth()
  const navigate          = useNavigate()
  const [historyRepo, setHistoryRepo] = useState<RepoSummary | null>(null)

  const handleDelete = async (repoId: string) => {
    if (!confirm('Delete this repo and all its data?')) return
    await deleteRepo(repoId)
  }

  const handleReopen = (repoId: string, conversationId: string) => {
    setHistoryRepo(null)
    navigate(`/app/chat/${repoId}?conversationId=${conversationId}`)
  }

  const handleReindex = async (repoId: string) => {
    await repoApi.reindex(repoId)
    reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-900">AI Codebase Explainer</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <SystemHealthBar />

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Repos indexed"    value={stats.total_repos} />
            <StatCard label="Questions asked"  value={stats.total_questions} />
            <StatCard label="Conversations"    value={stats.total_conversations} />
            <StatCard label="Avg response"
              value={stats.avg_latency_ms ? `${(stats.avg_latency_ms/1000).toFixed(1)}s` : '—'} />
          </div>
        )}

        {/* Add repo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-medium text-gray-800 mb-3">Index a new repository</h2>
          <AddRepoInline onAdded={(repoId) => navigate(`/app/chat/${repoId}`)} onReload={reload} />
        </div>

        {/* Repo list */}
        <h2 className="font-medium text-gray-700 mb-3">
          Your repositories ({repos.length})
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : repos.length === 0 ? (
          <p className="text-sm text-gray-400">No repositories indexed yet. Add one above.</p>
        ) : (
          <div className="grid gap-3">
            {repos.map(repo => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onOpen={() => navigate(`/app/chat/${repo.id}`)}
                onDelete={() => handleDelete(repo.id)}
                onHistory={() => setHistoryRepo(repo)}
                onReindex={() => handleReindex(repo.id)}
              />
            ))}
          </div>
        )}
      </main>

      {historyRepo && (
        <HistoryDrawer
          repoId={historyRepo.id}
          repoName={historyRepo.name}
          onClose={() => setHistoryRepo(null)}
          onReopen={(convId) => handleReopen(historyRepo.id, convId)}
        />
      )}
    </div>
  )
}

// Inline add-repo form used inside dashboard
function AddRepoInline({
  onAdded,
  onReload,
}: {
  onAdded:  (repoId: string) => void
  onReload: () => void
}) {
  const [url, setUrl]       = useState('')
  const [branch, setBranch] = useState('main')
  const { status, progress, repoId, error, isExisting, ingest } = useIngestRepo()

  if (status === 'ready' && repoId) {
    onReload()
    onAdded(repoId)
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && url && ingest(url, branch)}
          disabled={status === 'ingesting'}
        />
        <input
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
          {status === 'ingesting' ? `${progress}%` : 'Index'}
        </button>
      </div>

      {isExisting && (
        <p className="text-sm text-indigo-600 mt-2">
          ↩ Already indexed — opening your previous session
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {status === 'ingesting' && !isExisting && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-indigo-600 h-1 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
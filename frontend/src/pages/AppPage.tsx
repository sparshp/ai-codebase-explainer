import { useState } from 'react'
import { RepoInput }  from '../components/RepoInput/RepoInput'
import { ChatWindow } from '../components/ChatWindow/ChatWindow'
import { QueryInput } from '../components/ChatWindow/QueryInput'
import { CodeViewer } from '../components/CodeViewer/CodeViewer'
import { useStreamQuery } from '../hooks/useStreamQuery'
import { useAuth } from '../hooks/useAuth'

export function AppPage() {
  const [repoId, setRepoId]     = useState<string | null>(null)
  const [showIngest, setShowIngest] = useState(true)
  const { logout, user }        = useAuth()
  const { messages, isStreaming, error, askQuestion, clearMessages } =
    useStreamQuery(repoId || '')

  const handleRepoReady = (id: string) => {
    setRepoId(id)
    setShowIngest(false)
    clearMessages()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">AI Codebase Explainer</span>
          {repoId && !showIngest && (
            <span className="text-xs text-gray-400 font-mono">{repoId.slice(0, 8)}...</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {repoId && (
            <button onClick={() => setShowIngest(s => !s)}
              className="text-sm text-indigo-600 hover:underline">
              {showIngest ? 'Back to chat' : 'Change repo'}
            </button>
          )}
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col px-4 py-6 gap-4">
        {showIngest && (
          <RepoInput onReady={handleRepoReady} />
        )}

        {repoId && !showIngest && (
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[600px]">
            <ChatWindow messages={messages} isStreaming={isStreaming} error={error} />
            <QueryInput
              onSubmit={askQuestion}
              disabled={isStreaming || !repoId}
              placeholder="Ask anything about this codebase..."
            />
          </div>
        )}
      </main>

      {/* Code viewer modal */}
      <CodeViewer />
    </div>
  )
}
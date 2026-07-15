import { useEffect } from 'react'
import { useUIStore } from '../../store/ui.store'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

export function CodeViewer() {
  const { activeCitation, setActiveCitation } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveCitation(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveCitation])

  if (!activeCitation) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setActiveCitation(null)}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <p className="text-sm font-mono font-medium text-gray-800">
              {activeCitation.filePath}
              <span className="text-gray-400">:{activeCitation.line}</span>
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block
              ${activeCitation.verified
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
              }`}>
              {activeCitation.verified ? 'verified' : 'unverified'}
            </span>
          </div>
          <button onClick={() => setActiveCitation(null)}
            className="text-gray-400 hover:text-gray-600 text-xl font-light">
            ×
          </button>
        </div>
        <div className="overflow-auto flex-1">
          {activeCitation.chunkText ? (
            <SyntaxHighlighter
              language="typescript"
              style={atomOneDark}
              customStyle={{ margin: 0, borderRadius: 0, fontSize: '12px' }}
              showLineNumbers
              startingLineNumber={activeCitation.line}
            >
              {activeCitation.chunkText.split('\n').slice(2).join('\n')}
            </SyntaxHighlighter>
          ) : (
            <p className="p-4 text-sm text-gray-500">No source code available for this citation.</p>
          )}
        </div>
      </div>
    </div>
  )
}
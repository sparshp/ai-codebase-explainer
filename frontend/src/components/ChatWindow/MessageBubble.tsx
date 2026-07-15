import type { Message } from '../../hooks/useStreamQuery'
import { AnswerRenderer, CitBadge } from './AnswerRenderer'

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const isHistory = message.isHistory

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className={`max-w-lg px-3.5 py-2 text-sm rounded-2xl rounded-tr-sm
          ${isHistory
            ? 'bg-indigo-400 text-white opacity-75'
            : 'bg-indigo-600 text-white'
          }`}>
          {message.content}
        </div>
      </div>
    )
  }

  const citations = message.citations || {}
  const hasCitations = Object.keys(citations).length > 0

  return (
    <div className="flex justify-start mb-3">
      <div className={`max-w-3xl w-full px-4 py-3.5 text-sm rounded-2xl rounded-tl-sm border
        ${isHistory
          ? 'bg-gray-50 border-gray-100 text-gray-600'
          : 'bg-white border-gray-200 text-gray-800 shadow-sm'
        }`}>

        {message.isStreaming && !message.content && (
          <span className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        )}

        <AnswerRenderer text={message.content} citations={citations} />

        {message.isStreaming && message.content && (
          <span className="inline-block w-0.5 h-3.5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
        )}

        {hasCitations && !message.isStreaming && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">
              Source files
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(citations)
                .filter(([_, c], idx, arr) =>
                  arr.findIndex(([, x]) => x.filePath === c.filePath) === idx
                )
                .slice(0, 8)
                .map(([key, c]) => (
                  <CitationBadge key={key} citationKey={key} citation={c} />
                ))}
            </div>
          </div>
        )}

        {(message.latencyMs || hasCitations) && !message.isStreaming && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs text-gray-400">
            {message.latencyMs && (
              <span>{(message.latencyMs / 1000).toFixed(1)}s</span>
            )}
            {hasCitations && (
              <span>
                {Object.values(citations).filter(c => c.verified).length} verified ·{' '}
                {Object.keys(citations).length} citations
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Keep legacy export name for any imports
function CitationBadge(props: { citationKey: string; citation: any }) {
  return <CitBadge citKey={props.citationKey} citation={props.citation} />
}

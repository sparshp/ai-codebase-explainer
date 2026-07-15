import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../../hooks/useStreamQuery'

interface Props {
  messages:    Message[]
  isStreaming: boolean
  error:       string | null
}

export function ChatWindow({ messages, isStreaming, error }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Index a repository and ask a question to get started
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
      {error && (
        <div className="text-sm text-red-500 px-4 py-2 bg-red-50 rounded-lg">
          Error: {error}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
import { useState, useCallback, useRef } from 'react'
import { streamQuery } from '../api/chat.api'
import { repoApi }     from '../api/repo.api'
import type { QueryIntent } from '../constants/queryIntents'

export interface Message {
  id:              string
  role:            'user' | 'assistant'
  content:         string
  citations?:      Record<string, any>
  conversationId?: string
  latencyMs?:      number
  isStreaming?:    boolean
  isHistory?:      boolean   // true = loaded from DB, not streamed live
}

export function useStreamQuery(repoId: string) {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const cancelRef   = useRef<(() => void) | null>(null)
  const convIdRef   = useRef<string | undefined>(undefined)

  // Load history for a specific conversationId
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!repoId) return
    try {
      const history = await repoApi.history(repoId, 100, 0)
      // Filter to just this conversation
      const convItems = history.filter(
        (h: any) => h.conversation_id === conversationId
      ).reverse() // show oldest first
      if (!convItems.length) return

      const historyMessages: Message[] = convItems.flatMap((item: any) => [
        {
          id:              `hist-q-${item.id}`,
          role:            'user' as const,
          content:         item.question,
          isHistory:       true,
          conversationId:  item.conversation_id,
        },
        {
          id:              `hist-a-${item.id}`,
          role:            'assistant' as const,
          content:         item.answer,
          citations:       item.citations || {},
          latencyMs:       item.latency_ms,
          isHistory:       true,
          conversationId:  item.conversation_id,
        },
      ])

      convIdRef.current = conversationId
      setMessages(historyMessages)
    } catch {}
  }, [repoId])

  const setConversationId = useCallback((id: string) => {
    convIdRef.current = id
    loadConversation(id)
  }, [loadConversation])

  const askQuestion = useCallback((question: string, intent?: QueryIntent) => {
    if (!repoId || isStreaming) return
    setError(null)

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: question,
    }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id:          assistantId,
      role:        'assistant',
      content:     '',
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    cancelRef.current?.()

    cancelRef.current = streamQuery(
      question,
      repoId,
      convIdRef.current,
      {
        onToken: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          ))
        },
        onCitations: (citations, { conversationId, latencyMs }) => {
          convIdRef.current = conversationId
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, citations, conversationId, latencyMs, isStreaming: false }
              : m
          ))
        },
        onDone: () => {
          setIsStreaming(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          ))
        },
        onError: (msg) => { setError(msg); setIsStreaming(false) },
      },
      intent
    )
  }, [repoId, isStreaming])

  const clearMessages = useCallback(() => {
    cancelRef.current?.()
    setMessages([])
    convIdRef.current = undefined
  }, [])

  return {
    messages, isStreaming, error,
    askQuestion, clearMessages,
    setConversationId, loadConversation,
    currentConversationId: convIdRef,
  }
}
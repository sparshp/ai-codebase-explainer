import axios from 'axios'
import { config } from '@config/index'
import { logger } from '@utils/logger'
import { QueryIntent } from '@modules/chat/query.analyser'
import { LOOKUP_PROMPT } from './prompts/system.lookup'
import { ARCHITECTURE_PROMPT } from './prompts/system.architecture'
import { DEBUG_PROMPT } from './prompts/system.debug'
import { FLOW_PROMPT } from './prompts/system.flow'
import { maxTokensForIntent } from './token-limits'

export { QueryIntent }

export function getSystemPrompt(intent: QueryIntent): string {
  switch (intent) {
    case 'LOOKUP':       return LOOKUP_PROMPT
    case 'DEBUG':        return DEBUG_PROMPT
    case 'FLOW':         return FLOW_PROMPT
    case 'ARCHITECTURE': return ARCHITECTURE_PROMPT
  }
}

// ── Non-streaming: used for query expansion + pipeline tasks ─────
export async function generateAnswer(
  question: string,
  context:  string,
  intent:   QueryIntent
): Promise<string> {
  const systemPrompt = getSystemPrompt(intent)
  const userMessage  = `CONTEXT:\n${context}\n\nQUESTION: ${question}`

  logger.debug({ intent, contextLength: context.length }, 'Calling Ollama LLM')

  const res = await axios.post(`${config.ollamaUrl}/api/chat`, {
    model:  config.ollamaLlmModel,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    options: { temperature: 0.1, num_predict: maxTokensForIntent(intent) },
    keep_alive: '30m',
  })

  return res.data.message?.content || ''
}

// ── Streaming: yields tokens one by one for SSE ──────────────────
export async function* generateStream(
  question: string,
  context:  string,
  intent:   QueryIntent,
  history:  Array<{ role: string; content: string }> = []
): AsyncGenerator<string> {
  const systemPrompt = getSystemPrompt(intent)
  const userMessage  = `CONTEXT:\n${context}\n\nQUESTION: ${question}`

  const messages = [
    { role: 'system',    content: systemPrompt },
    ...history.slice(-4),                          // last 2 turns max
    { role: 'user',      content: userMessage  },
  ]

  logger.debug({ intent }, 'Starting Ollama stream')

  const res = await axios.post(
    `${config.ollamaUrl}/api/chat`,
    {
      model:    config.ollamaLlmModel,
      stream:   true,
      messages,
      options:  { temperature: 0.1, num_predict: maxTokensForIntent(intent) },
      keep_alive: '30m',
    },
    { responseType: 'stream' }
  )

  let buffer = ''

  for await (const chunk of res.data) {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        const token  = parsed.message?.content
        if (token) yield token
        if (parsed.done) return
      } catch {
        // incomplete JSON chunk — wait for more
      }
    }
  }
}
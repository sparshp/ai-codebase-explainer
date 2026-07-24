import Groq from 'groq-sdk'
import { config } from '@config/index'
import { logger } from '@utils/logger'
import { QueryIntent, getSystemPrompt } from './ollama.llm'
import { maxTokensForIntent } from './token-limits'
import {
  buildDelimitedUserMessage,
  sanitizeHistoryContent,
  validateLlmOutput,
} from './prompt-guard'

const groq = new Groq({ apiKey: config.groqApiKey })

export async function generateAnswerGroq(
  question: string,
  context:  string,
  intent:   QueryIntent
): Promise<string> {
  const systemPrompt = getSystemPrompt(intent)
  const userMessage  = buildDelimitedUserMessage(question, context)

  logger.debug({ intent }, 'Calling Groq LLM')

  const res = await groq.chat.completions.create({
    model:       config.groqLlmModel,
    max_tokens:  maxTokensForIntent(intent),
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
  })

  return validateLlmOutput(res.choices[0]?.message?.content || '')
}

export async function* generateStreamGroq(
  question: string,
  context:  string,
  intent:   QueryIntent,
  history:  Array<{ role: string; content: string }> = []
): AsyncGenerator<string> {
  const systemPrompt = getSystemPrompt(intent)
  const userMessage  = buildDelimitedUserMessage(question, context)

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-4).map(h => ({
      role:    h.role as 'user' | 'assistant',
      content: sanitizeHistoryContent(h.content),
    })),
    { role: 'user' as const, content: userMessage },
  ]

  logger.debug({ intent }, 'Starting Groq stream')

  const stream = await groq.chat.completions.create({
    model:       config.groqLlmModel,
    max_tokens:  maxTokensForIntent(intent),
    temperature: 0.1,
    stream:      true,
    messages,
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) yield token
  }
}

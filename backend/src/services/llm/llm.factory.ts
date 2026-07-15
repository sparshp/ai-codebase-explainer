import { config } from '@config/index'
import {
  QueryIntent, getSystemPrompt,
  generateAnswer, generateStream,
} from './ollama.llm'
import { generateAnswerGroq, generateStreamGroq } from './groq.llm'

export { QueryIntent, getSystemPrompt }

export async function generateAnswerLLM(
  question: string,
  context:  string,
  intent:   QueryIntent
): Promise<string> {
  if (config.llmProvider === 'groq') {
    return generateAnswerGroq(question, context, intent)
  }
  return generateAnswer(question, context, intent)
}

export async function* generateStreamLLM(
  question: string,
  context:  string,
  intent:   QueryIntent,
  history:  Array<{ role: string; content: string }> = []
): AsyncGenerator<string> {
  if (config.llmProvider === 'groq') {
    yield* generateStreamGroq(question, context, intent, history)
    return
  }
  yield* generateStream(question, context, intent, history)
}
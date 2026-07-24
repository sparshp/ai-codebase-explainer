import { hybridRetrieve } from '@services/retriever/retriever.service'
import { embedTexts } from '@services/embedder/embedder.service'
import { buildContext } from '@services/context/context.builder'
import { mapCitations } from '@services/context/citation.mapper'
import { generateAnswerLLM, generateStreamLLM } from '@services/llm/llm.factory'
import { analyseQuery, QueryIntent } from './query.analyser'
import { getCached, setCached } from '@services/cache/query.cache'
import { config } from '@config/index'
import { pool } from '@config/database'
import { logger } from '@utils/logger'
import { randomUUID } from 'crypto'
import { RankedResult } from '@services/retriever/rrf'
import { sanitizeUserQuestion, validateLlmOutput } from '@services/llm/prompt-guard'

const STREAM_CHUNK_SIZE = 48

// ── Fetch conversation history ────────────────────────────────────
async function getHistory(
  conversationId: string,
  repoId: string,
  limit = 4
): Promise<Array<{ question: string; answer: string }>> {
  const res = await pool.query(
    `SELECT question, answer FROM conversations
     WHERE conversation_id = $1 AND repo_id = $2::uuid
     ORDER BY created_at DESC LIMIT $3`,
    [conversationId, repoId, limit]
  )
  return res.rows.reverse()
}

// ── Retrieve with multi-query expansion ──────────────────────────
async function retrieveWithExpansion(
  resolvedQuery:   string,
  expandedQueries: string[],
  repoId:          string,
  intent:          QueryIntent
): Promise<RankedResult[]> {
  const allQueries = [resolvedQuery, ...expandedQueries]
  const vectors    = await embedTexts(allQueries)

  const allResults = await Promise.all(
    allQueries.map((query, i) =>
      hybridRetrieve(query, repoId, 8, intent, vectors[i])
    )
  )

  const merged = new Map<string, RankedResult>()
  for (const results of allResults) {
    for (const r of results) {
      const existing = merged.get(r.id)
      if (!existing || r.rrfScore > existing.rrfScore) {
        merged.set(r.id, r)
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, 10)
}

async function maybeRerank(
  query:   string,
  chunks:  RankedResult[],
  intent:  QueryIntent
): Promise<RankedResult[]> {
  const shouldRerank =
    config.enableRerank &&
    ['ARCHITECTURE', 'DEBUG', 'FLOW'].includes(intent) &&
    chunks.length > 5

  if (!shouldRerank) return chunks

  const { rerank } = await import('@services/retriever/reranker.service')
  return rerank(query, chunks, 5)
}

function persistConversation(
  repoId:         string,
  conversationId: string,
  question:       string,
  answer:         string,
  citations:      Record<string, any>,
  latencyMs:      number
): void {
  void pool.query(
    `INSERT INTO conversations
       (repo_id, conversation_id, question, answer, citations, latency_ms, hallucination_count)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
    [
      repoId, conversationId, question, answer,
      JSON.stringify(citations), latencyMs,
      Object.values(citations).filter((c: any) => !c.verified).length,
    ]
  ).catch(err => logger.warn({ err: err.message }, 'Failed to persist conversation'))

  void setCached(question, repoId, { answer, citations })
    .catch(err => logger.warn({ err: err.message }, 'Failed to cache response'))
}

function* streamText(text: string): Generator<{ type: 'token'; token: string }> {
  for (let i = 0; i < text.length; i += STREAM_CHUNK_SIZE) {
    yield { type: 'token', token: text.slice(i, i + STREAM_CHUNK_SIZE) }
  }
}

// ── Non-streaming query ───────────────────────────────────────────
export async function queryRepo(
  question:       string,
  repoId:         string,
  conversationId: string = randomUUID(),
  intentHint?:    QueryIntent
): Promise<{
  answer:         string
  citations:      Record<string, any>
  conversationId: string
  latencyMs:      number
}> {
  const start = Date.now()
  const safeQuestion = sanitizeUserQuestion(question)

  const cached = !intentHint ? await getCached(safeQuestion, repoId) : null
  if (cached) {
    logger.info({ question: safeQuestion }, 'Cache hit')
    return { ...cached, conversationId, latencyMs: Date.now() - start }
  }

  const history  = conversationId ? await getHistory(conversationId, repoId) : []
  const analysed = await analyseQuery(safeQuestion, history, intentHint)
  logger.info({ question: safeQuestion, repoId, intent: analysed.intent }, 'Query received')

  let ranked = await retrieveWithExpansion(
    analysed.resolvedQuery,
    analysed.expandedQueries,
    repoId,
    analysed.intent
  )

  if (ranked.length === 0) {
    return {
      answer: "I couldn't find relevant code for this question. Make sure the repository has been indexed and try rephrasing.",
      citations: {},
      conversationId,
      latencyMs: Date.now() - start,
    }
  }

  ranked = await maybeRerank(analysed.resolvedQuery, ranked, analysed.intent)

  const { text: contextText, usedChunks } = buildContext(ranked)
  const answer    = await generateAnswerLLM(analysed.resolvedQuery, contextText, analysed.intent)
  const citations = mapCitations(answer, usedChunks)
  const latencyMs = Date.now() - start

  persistConversation(repoId, conversationId, safeQuestion, answer, citations, latencyMs)
  logger.info({ latencyMs, intent: analysed.intent }, 'Query complete')
  return { answer, citations, conversationId, latencyMs }
}

// ── Streaming query ───────────────────────────────────────────────
export async function* queryRepoStream(
  question:       string,
  repoId:         string,
  conversationId: string = randomUUID(),
  intentHint?:    QueryIntent
): AsyncGenerator<
  | { type: 'token';     token: string }
  | { type: 'citations'; citations: Record<string, any>; conversationId: string; latencyMs: number }
  | { type: 'error';     message: string }
> {
  const start = Date.now()
  const safeQuestion = sanitizeUserQuestion(question)

  // Intent override (e.g. Debug mode) must skip generic cache to avoid wrong prompt style
  const cached = !intentHint ? await getCached(safeQuestion, repoId) : null
  if (cached) {
    logger.info({ question: safeQuestion }, 'Cache hit — streaming cached response')
    yield* streamText(cached.answer)
    yield { type: 'citations', citations: cached.citations, conversationId, latencyMs: Date.now() - start }
    return
  }

  const history  = await getHistory(conversationId, repoId)
  const analysed = await analyseQuery(safeQuestion, history, intentHint)
  logger.info({ question: safeQuestion, repoId, intent: analysed.intent }, 'Stream query received')

  let ranked = await retrieveWithExpansion(
    analysed.resolvedQuery,
    analysed.expandedQueries,
    repoId,
    analysed.intent
  )

  if (ranked.length === 0) {
    const msg = "I couldn't find relevant code. Make sure the repo is indexed and try rephrasing."
    yield* streamText(msg)
    yield { type: 'citations', citations: {}, conversationId, latencyMs: Date.now() - start }
    return
  }

  ranked = await maybeRerank(analysed.resolvedQuery, ranked, analysed.intent)

  const { text: contextText, usedChunks } = buildContext(ranked)

  const historyMessages = history.flatMap(h => [
    { role: 'user',      content: h.question },
    { role: 'assistant', content: h.answer   },
  ])

  let fullResponse = ''
  try {
    for await (const token of generateStreamLLM(
      analysed.resolvedQuery,
      contextText,
      analysed.intent,
      historyMessages
    )) {
      fullResponse += token
      yield { type: 'token', token }
    }
  } catch (err: any) {
    yield { type: 'error', message: 'LLM generation failed: ' + err.message }
    return
  }

  const safeAnswer = validateLlmOutput(fullResponse)
  if (safeAnswer !== fullResponse) {
    yield {
      type: 'error',
      message: 'Response blocked: the model attempted to leave its codebase-assistant role.',
    }
    return
  }

  const citations = mapCitations(safeAnswer, usedChunks)
  const latencyMs = Date.now() - start

  yield { type: 'citations', citations, conversationId, latencyMs }
  persistConversation(repoId, conversationId, safeQuestion, safeAnswer, citations, latencyMs)
}

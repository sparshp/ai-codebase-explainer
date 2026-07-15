import axios from 'axios'
import { config } from '@config/index'
import { logger } from '@utils/logger'
import { RankedResult } from './rrf'

async function scoreChunksBatch(
  question: string,
  chunks:   RankedResult[]
): Promise<number[]> {
  const listing = chunks.map((chunk, i) =>
    `[${i}] ${chunk.metadata.filePath}\n${chunk.text.slice(0, 300)}`
  ).join('\n\n')

  const prompt = `Rate how directly each code snippet answers the question.
Question: ${question}

${listing}

Return ONLY valid JSON: {"scores":[<score for index 0>, <score for index 1>, ...]}
Use integers 1-10. No markdown.`

  try {
    const res = await axios.post(`${config.ollamaUrl}/api/generate`, {
      model:      config.ollamaLlmModel,
      prompt,
      stream:     false,
      keep_alive: '30m',
      options:    { temperature: 0, num_predict: 80 },
    })

    const raw   = (res.data.response as string).trim()
    const match = raw.match(/\{[\s\S]*"scores"[\s\S]*\}/)
    if (!match) throw new Error('No scores JSON')

    const parsed = JSON.parse(match[0]) as { scores?: number[] }
    if (!Array.isArray(parsed.scores)) throw new Error('Invalid scores')

    return chunks.map((_, i) => {
      const score = parsed.scores![i]
      return typeof score === 'number'
        ? Math.min(10, Math.max(1, Math.round(score)))
        : 5
    })
  } catch {
    return chunks.map(() => 5)
  }
}

export async function rerank(
  question: string,
  chunks:   RankedResult[],
  topK:     number = 5
): Promise<RankedResult[]> {
  if (chunks.length <= topK) return chunks

  logger.debug({ chunks: chunks.length, topK }, 'Re-ranking chunks')
  const start  = Date.now()
  const scores = await scoreChunksBatch(question, chunks)

  const reranked = chunks
    .map((c, i) => ({ ...c, rerankScore: scores[i] }))
    .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
    .slice(0, topK)

  logger.debug({
    ms:          Date.now() - start,
    topScore:    reranked[0]?.rerankScore,
    bottomScore: reranked[reranked.length - 1]?.rerankScore,
  }, 'Re-ranking complete')

  return reranked
}

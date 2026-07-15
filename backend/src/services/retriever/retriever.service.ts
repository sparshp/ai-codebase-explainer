import { embedSingle } from '@services/embedder/embedder.service'
import { queryVectors } from '@services/vectorstore/chroma.client'
import { rrfFuse, RankedResult } from './rrf'
import { pool } from '@config/database'
import { logger } from '@utils/logger'
import { QueryIntent } from '@modules/chat/query.analyser'
import { needsVectorRebuild, rebuildVectorsFromPostgres } from '@services/vectorstore/chroma.rehydrate'

function extractSearchTerms(query: string): string[] {
  const stop = new Set([
    'the','a','an','is','are','was','were','be','been','being','to','of','in','on','for','and','or',
    'not','why','how','what','when','where','which','who','does','do','did','can','could','should',
    'would','will','this','that','these','those','with','from','into','about','it','its','as','at',
    'by','my','your','our','their','me','you','we','they','i','working','work','works','please',
    'repo','codebase','code','file','files','function','method',
  ])
  const words = query.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || []
  return [...new Set(words.filter(w => !stop.has(w)))]
}

async function bm25Search(
  query: string,
  repoId: string,
  topK: number = 10
): Promise<Array<{ id: string; score: number; text: string; metadata: Record<string, any> }>> {
  const terms = extractSearchTerms(query)

  try {
    // Prefer keyword OR search — full-question AND often matches nothing
    let res
    if (terms.length > 0) {
      const tsQuery = terms.map(t => t.replace(/[^a-z0-9_]/g, '')).filter(Boolean).join(' | ')
      res = await pool.query(
        `SELECT
           id, text,
           file_path   AS "filePath",
           start_line  AS "startLine",
           end_line    AS "endLine",
           symbol_name AS "symbolName",
           symbol_type AS "symbolType",
           ts_rank(to_tsvector('english', text), to_tsquery('english', $1)) AS score
         FROM chunks
         WHERE repo_id = $2::uuid
           AND to_tsvector('english', text) @@ to_tsquery('english', $1)
         ORDER BY score DESC
         LIMIT $3`,
        [tsQuery, repoId, topK]
      )
    } else {
      res = { rows: [] }
    }

    // Fallback: ILIKE any keyword (handles camelCase / SignIn vs login)
    if (res.rows.length === 0 && terms.length > 0) {
      res = await pool.query(
        `SELECT
           id, text,
           file_path   AS "filePath",
           start_line  AS "startLine",
           end_line    AS "endLine",
           symbol_name AS "symbolName",
           symbol_type AS "symbolType",
           0.1 AS score
         FROM chunks
         WHERE repo_id = $1::uuid
           AND (
             text ILIKE ANY($2::text[])
             OR file_path ILIKE ANY($2::text[])
             OR COALESCE(symbol_name,'') ILIKE ANY($2::text[])
           )
         LIMIT $3`,
        [repoId, terms.map(t => `%${t}%`), topK]
      )
    }

    return res.rows.map((row: any) => ({
      id:    row.id,
      score: parseFloat(row.score),
      text:  row.text,
      metadata: {
        filePath:   row.filePath,
        startLine:  row.startLine,
        endLine:    row.endLine,
        symbolName: row.symbolName,
        symbolType: row.symbolType,
      },
    }))
  } catch (err) {
    logger.warn({ err }, 'BM25 search failed, returning empty')
    return []
  }
}

async function ensureVectors(repoId: string): Promise<void> {
  try {
    if (await needsVectorRebuild(repoId)) {
      await rebuildVectorsFromPostgres(repoId)
    }
  } catch (err: any) {
    logger.warn({ err: err.message, repoId }, 'Chroma rehydrate failed — continuing with BM25 only')
  }
}

export async function hybridRetrieve(
  query:       string,
  repoId:      string,
  topK:        number = 8,
  intent:      QueryIntent = 'ARCHITECTURE',
  queryVector?: number[]
): Promise<RankedResult[]> {
  // Rebuild Chroma from Postgres if Docker wiped the vector store
  await ensureVectors(repoId)

  const [queryVec, bm25] = await Promise.all([
    queryVector ? Promise.resolve(queryVector) : embedSingle(query),
    bm25Search(query, repoId, 20),
  ])

  let vectorResults = await queryVectors(repoId, queryVec, 20)

  // If still empty after embed (race), try BM25-only
  if (vectorResults.length === 0 && bm25.length === 0) {
    logger.warn({ repoId, query }, 'Both vector and BM25 empty — checking chunk count')
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM chunks WHERE repo_id = $1::uuid`,
      [repoId]
    )
    if ((rows[0]?.n || 0) === 0) {
      logger.warn({ repoId }, 'Repo has no chunks in Postgres')
    }
  }

  logger.debug({
    vectorCount: vectorResults.length,
    bm25Count:   bm25.length,
    intent,
  }, 'Retrieval counts before fusion')

  return rrfFuse(vectorResults, bm25, 60, topK)
}

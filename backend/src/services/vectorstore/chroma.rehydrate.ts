import { pool } from '@config/database'
import { embedTexts } from '@services/embedder/embedder.service'
import { upsertChunks, collectionExists } from '@services/vectorstore/chroma.client'
import { Chunk } from '@services/chunker/chunker.service'
import { logger } from '@utils/logger'

const inFlight = new Map<string, Promise<number>>()

/** True if Postgres has chunks but Chroma has no collection (common after Docker restart). */
export async function needsVectorRebuild(repoId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM chunks WHERE repo_id = $1::uuid`,
    [repoId]
  )
  if ((rows[0]?.n || 0) === 0) return false
  return !(await collectionExists(repoId))
}

/**
 * Rebuild Chroma vectors from Postgres chunks (no GitHub re-fetch).
 * Concurrent callers wait on the same in-flight rebuild.
 */
export async function rebuildVectorsFromPostgres(repoId: string): Promise<number> {
  const existing = inFlight.get(repoId)
  if (existing) return existing

  const promise = (async () => {
    const { rows } = await pool.query(
      `SELECT id, repo_id, text, file_path, start_line, end_line,
              symbol_name, symbol_type, language
       FROM chunks WHERE repo_id = $1::uuid ORDER BY file_path, start_line`,
      [repoId]
    )

    if (rows.length === 0) return 0

    const chunks: Chunk[] = rows.map((r: any) => ({
      id:          r.id,
      repoId:      r.repo_id,
      text:        r.text,
      filePath:    r.file_path,
      startLine:   r.start_line,
      endLine:     r.end_line,
      symbolName:  r.symbol_name,
      symbolType:  r.symbol_type,
      language:    r.language || 'unknown',
      contentHash: r.id,
    }))

    logger.info({ repoId, count: chunks.length }, 'Rebuilding Chroma vectors from Postgres')
    const vectors = await embedTexts(chunks.map(c => c.text))
    await upsertChunks(repoId, chunks, vectors)
    logger.info({ repoId, count: chunks.length }, 'Chroma rebuild complete')
    return chunks.length
  })().finally(() => {
    inFlight.delete(repoId)
  })

  inFlight.set(repoId, promise)
  return promise
}

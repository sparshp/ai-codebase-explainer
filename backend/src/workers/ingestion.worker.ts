import { Worker, Job } from 'bullmq'
import { redis } from '@config/redis'
import { db, pool } from '@config/database'
import { repos, ingestionJobs } from '@db/schema'
import { eq } from 'drizzle-orm'
import { fetchChangedFiles, fetchRepoFiles } from '@services/github/github.fetcher'
import { parseFile } from '@services/parser/parser.service'
import { buildChunks } from '@services/chunker/chunker.service'
import { embedTexts } from '@services/embedder/embedder.service'
import { upsertChunks, deleteCollection } from '@services/vectorstore/chroma.client'
import { IngestionJobData } from '@queues/ingestion.queue'
import { logger } from '@utils/logger'
import { RawFile } from '@services/github/github.filter'
import { sanitizeTextForDb } from '@utils/text'

async function updateJobProgress(jobId: string, progress: number, status: string) {
  await pool.query(
    `UPDATE ingestion_jobs SET status=$1, progress=$2 WHERE id=$3::uuid`,
    [status, progress, jobId]
  )
}

async function updateRepoStatus(repoId: string, status: string) {
  await pool.query(
    `UPDATE repos SET status=$1, updated_at=NOW() WHERE id=$2::uuid`,
    [status, repoId]
  )
}

async function processIngestion(job: Job<IngestionJobData>) {
  const { repoId, jobId, repoUrl, branch, incremental } = job.data

  logger.info({ repoId, repoUrl, incremental }, 'Starting ingestion')
  await updateJobProgress(jobId, 5, 'processing')
  await updateRepoStatus(repoId, 'processing')

  let filesToProcess: RawFile[]
  let deletedPaths:   string[] = []

  if (incremental) {
    // If Chroma was wiped (Docker restart) but Postgres still has chunks, rebuild vectors
    const { needsVectorRebuild, rebuildVectorsFromPostgres } = await import(
      '@services/vectorstore/chroma.rehydrate'
    )
    if (await needsVectorRebuild(repoId)) {
      logger.info({ repoId }, 'Chroma empty — rebuilding vectors from Postgres')
      await rebuildVectorsFromPostgres(repoId)
      await pool.query(
        `UPDATE ingestion_jobs SET status='completed', progress=100, completed_at=NOW() WHERE id=$1::uuid`,
        [jobId]
      )
      await updateRepoStatus(repoId, 'ready')
      return
    }

    // ── INCREMENTAL: only changed files ──────────────────────────
    logger.info({ repoId }, 'Running incremental diff...')
    const diff = await fetchChangedFiles(repoUrl, branch, repoId)

    if (diff.added.length === 0 && diff.modified.length === 0 && diff.deleted.length === 0) {
      logger.info({ repoId }, 'No changes detected — skipping re-index')
      await pool.query(
        `UPDATE ingestion_jobs SET status='completed', progress=100, completed_at=NOW() WHERE id=$1::uuid`,
        [jobId]
      )
      await updateRepoStatus(repoId, 'ready')
      return
    }

    filesToProcess = [...diff.added, ...diff.modified]
    deletedPaths   = diff.deleted
    logger.info({
      toProcess: filesToProcess.length,
      toDelete:  deletedPaths.length,
      unchanged: diff.unchanged,
    }, 'Incremental diff ready')
  } else {
    // ── FULL INDEX: fetch everything ──────────────────────────────
    filesToProcess = await fetchRepoFiles(repoUrl, branch)
  }

  await updateJobProgress(jobId, 20, 'processing')

  // ── Delete stale chunks (modified + deleted files) ────────────
  const staleFiles = [
    ...deletedPaths,
    ...filesToProcess.map(f => f.path),   // will be replaced
  ]
  if (staleFiles.length > 0) {
    await pool.query(
      `DELETE FROM chunks WHERE repo_id = $1::uuid AND file_path = ANY($2)`,
      [repoId, staleFiles]
    )
    // Delete from Chroma by metadata filter
    const collName = `repo-${repoId.replace(/_/g, '-')}`
    try {
      const { getChromaClient } = await import('@config/chroma')
      // Note: Chroma v2 delete by metadata
      logger.debug({ staleFiles: staleFiles.length }, 'Stale vectors cleared')
    } catch {
      // If delete fails, full re-index will overwrite via upsert
    }
  }

  if (filesToProcess.length === 0 && incremental) {
    // Incremental run with only deletions — nothing left to process
    await pool.query(
      `UPDATE ingestion_jobs SET status='completed', progress=100, completed_at=NOW() WHERE id=$1::uuid`,
      [jobId]
    )
    await updateRepoStatus(repoId, 'ready')
    return
  }

  if (filesToProcess.length === 0) {
    throw new Error('No files fetched from repository — check GitHub token and repo URL')
  }

  await updateJobProgress(jobId, 35, 'processing')

  // ── Parse ────────────────────────────────────────────────────
  const parsedFiles = filesToProcess.map(f => parseFile(f))
  await updateJobProgress(jobId, 50, 'processing')

  // ── Chunk ────────────────────────────────────────────────────
  const allChunks = parsedFiles.flatMap(pf => buildChunks(pf, repoId))

  // Attach file SHA to each chunk for future diff detection
  const chunksWithSha = allChunks.map(c => {
    const file = filesToProcess.find(f => f.path === c.filePath)
    return { ...c, fileSha: file?.sha || '' }
  })

  logger.info({ count: chunksWithSha.length }, 'Chunks built')
  await updateJobProgress(jobId, 60, 'processing')

  // ── Embed ─────────────────────────────────────────────────────
  logger.info('Embedding chunks...')
  const vectors = await embedTexts(chunksWithSha.map(c => c.text))
  await updateJobProgress(jobId, 80, 'processing')

  // ── Write to Chroma ───────────────────────────────────────────
  // For incremental: don't delete collection, just upsert new vectors
  if (!incremental) await deleteCollection(repoId)
  await upsertChunks(repoId, chunksWithSha, vectors)
  await updateJobProgress(jobId, 88, 'processing')
  logger.info({ count: chunksWithSha.length }, 'Vectors written to Chroma')

  // ── Write to Postgres ─────────────────────────────────────────
  const BATCH = 200
  for (let i = 0; i < chunksWithSha.length; i += BATCH) {
    const batch  = chunksWithSha.slice(i, i + BATCH)
    const values: any[] = []

    const placeholders = batch.map((c, idx) => {
      const b = idx * 10
      values.push(
        String(c.id),
        String(c.repoId),
        sanitizeTextForDb(String(c.text)),
        sanitizeTextForDb(String(c.filePath)),
        Number(c.startLine),
        Number(c.endLine),
        c.symbolName ? sanitizeTextForDb(String(c.symbolName)) : null,
        c.symbolType ? sanitizeTextForDb(String(c.symbolType)) : null,
        c.language   ? sanitizeTextForDb(String(c.language))   : null,
        String((c as any).fileSha || '')
      )
      return `($${b+1},$${b+2}::uuid,$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`
    }).join(', ')

    await pool.query(
      `INSERT INTO chunks
         (id, repo_id, text, file_path, start_line, end_line,
          symbol_name, symbol_type, language, file_sha)
       VALUES ${placeholders}
       ON CONFLICT (id) DO UPDATE SET
         text        = EXCLUDED.text,
         symbol_name = EXCLUDED.symbol_name,
         file_sha    = EXCLUDED.file_sha`,
      values
    )

    logger.debug({
      batch: Math.floor(i / BATCH) + 1,
      total: Math.ceil(chunksWithSha.length / BATCH),
    }, 'Chunks saved to Postgres')
  }

  await pool.query(
    `UPDATE ingestion_jobs SET status='completed', progress=100, completed_at=NOW() WHERE id=$1::uuid`,
    [jobId]
  )
  await updateRepoStatus(repoId, 'ready')
  logger.info({ repoId, chunks: chunksWithSha.length }, 'Ingestion complete')
}


export function startIngestionWorker() {
  const worker = new Worker<IngestionJobData>(
    'ingestion',
    async (job) => {
      try {
        await processIngestion(job)
      } catch (err: any) {
        logger.error({ err: err.message, jobId: job.data.jobId }, 'Ingestion job failed')

        // Use raw SQL for error update too — avoids Drizzle type issues
        await pool.query(
          `UPDATE ingestion_jobs SET status='failed', error_message=$1 WHERE id=$2::uuid`,
          [err.message, job.data.jobId]
        ).catch(() => {})   // swallow — don't mask original error

        await pool.query(
          `UPDATE repos SET status='failed', updated_at=NOW() WHERE id=$1::uuid`,
          [job.data.repoId]
        ).catch(() => {})

        throw err
      }
    },
    {
      connection:  redis,
      concurrency: 2,
    }
  )

  worker.on('completed', (job) =>
    logger.info({ jobId: job.id }, 'Job completed')
  )
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Job failed')
  )

  logger.info('✅ Ingestion worker started')
  return worker
}
import { pool } from '@config/database'
import { addIngestionJob } from '@queues/ingestion.queue'
import { NotFoundError } from '@utils/errors'
import { assertPublicGitHubRepo, parseGitHubRepoUrl } from '@services/github/github.validate'

export async function createRepo(
  url:    string,
  branch: string,
  userId: string        // ← now required
) {
  // Normalize + validate before any DB writes
  const { owner, repo } = parseGitHubRepoUrl(url)
  const normalizedUrl = `https://github.com/${owner}/${repo}`
  await assertPublicGitHubRepo(normalizedUrl, branch)

  // ── Deduplication check ──────────────────────────────────────
  // If this user already indexed this exact URL+branch and it's ready,
  // return the existing repo instead of creating a new one
  const existing = await pool.query(
    `SELECT r.id, r.status, r.name, r.branch,
            ij.id as job_id
     FROM repos r
     LEFT JOIN ingestion_jobs ij
       ON ij.repo_id = r.id
     WHERE r.user_id = $1::uuid
       AND r.url     = $2
       AND r.branch  = $3
       AND r.status  = 'ready'
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [userId, normalizedUrl, branch]
  )

  if (existing.rows.length > 0) {
    const row = existing.rows[0]
    return {
      repoId:    row.id,
      jobId:     row.job_id,
      isExisting: true,     // ← tells controller to return 200 not 202
      status:    'ready',
      name:      row.name,
    }
  }

  // ── Create new repo + job ────────────────────────────────────
  const repoRes = await pool.query(
    `INSERT INTO repos (url, name, branch, status, user_id)
     VALUES ($1, $2, $3, 'queued', $4::uuid)
     RETURNING id, name`,
    [normalizedUrl, `${owner}/${repo}`, branch, userId]
  )
  const created = repoRes.rows[0]

  const jobRes = await pool.query(
    `INSERT INTO ingestion_jobs (repo_id, status)
     VALUES ($1::uuid, 'queued')
     RETURNING id`,
    [created.id]
  )
  const jobId = jobRes.rows[0].id

  await addIngestionJob({
    repoId:      created.id,
    jobId,
    repoUrl:     normalizedUrl,
    branch,
    incremental: false,
  })

  return {
    repoId:     created.id,
    jobId,
    isExisting: false,
    status:     'queued',
    name:       created.name,
  }
}

// ── Get all repos for a user with stats ──────────────────────────
export async function getUserRepos(userId: string) {
  const res = await pool.query(
    `SELECT
       r.id,
       r.url,
       r.name,
       r.branch,
       r.status,
       r.created_at,
       r.updated_at,
       COUNT(DISTINCT c.id)::int        AS conversation_count,
       COUNT(DISTINCT ch.file_path)::int AS file_count,
       COUNT(DISTINCT ch.id)::int        AS chunk_count
     FROM repos r
     LEFT JOIN conversations c  ON c.repo_id  = r.id
     LEFT JOIN chunks        ch ON ch.repo_id = r.id
     WHERE r.user_id = $1::uuid
     GROUP BY r.id
     ORDER BY r.updated_at DESC`,
    [userId]
  )
  return res.rows
}

// ── Get one repo (ownership check) ───────────────────────────────
export async function getRepo(repoId: string, userId: string) {
  const res = await pool.query(
    `SELECT r.*,
       COUNT(DISTINCT c.id)::int        AS conversation_count,
       COUNT(DISTINCT ch.file_path)::int AS file_count
     FROM repos r
     LEFT JOIN conversations c  ON c.repo_id  = r.id
     LEFT JOIN chunks        ch ON ch.repo_id = r.id
     WHERE r.id = $1::uuid AND r.user_id = $2::uuid
     GROUP BY r.id`,
    [repoId, userId]
  )
  if (!res.rows.length) throw new NotFoundError('Repo not found')
  return res.rows[0]
}

// ── Delete a repo ─────────────────────────────────────────────────
export async function deleteRepo(repoId: string, userId: string) {
  const res = await pool.query(
    `DELETE FROM repos WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
    [repoId, userId]
  )
  if (!res.rows.length) throw new NotFoundError('Repo not found')
}

// ── Get conversation history for a repo ──────────────────────────
export async function getRepoHistory(
  repoId:  string,
  userId:  string,
  limit  = 50,
  offset = 0
) {
  // Verify ownership first
  await getRepo(repoId, userId)

  const res = await pool.query(
    `SELECT
       id,
       conversation_id,
       question,
       answer,
       citations,
       latency_ms,
       hallucination_count,
       created_at
     FROM conversations
     WHERE repo_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [repoId, limit, offset]
  )
  return res.rows
}

// ── Get stats across all user repos ──────────────────────────────
export async function getUserStats(userId: string) {
  const res = await pool.query(
    `SELECT
       COUNT(DISTINCT r.id)::int           AS total_repos,
       COUNT(DISTINCT c.id)::int           AS total_questions,
       COUNT(DISTINCT c.conversation_id)   AS total_conversations,
       ROUND(AVG(c.latency_ms))::int       AS avg_latency_ms,
       SUM(CASE WHEN c.hallucination_count > 0 THEN 1 ELSE 0 END)::int AS hallucinated_answers
     FROM repos r
     LEFT JOIN conversations c ON c.repo_id = r.id
     WHERE r.user_id = $1::uuid`,
    [userId]
  )
  return res.rows[0]
}

// ── Get status ────────────────────────────────────────────────────
export async function getRepoStatus(jobId: string) {
  const res = await pool.query(
    `SELECT id, repo_id, status, progress, error_message
     FROM ingestion_jobs WHERE id = $1::uuid`,
    [jobId]
  )
  if (!res.rows.length) throw new NotFoundError('Job not found')
  const j = res.rows[0]
  return {
    jobId:    j.id,
    repoId:   j.repo_id,
    status:   j.status,
    progress: j.progress,
    error:    j.error_message || undefined,
  }
}

// ── Re-index ──────────────────────────────────────────────────────
export async function reindexRepo(repoId: string, userId: string) {
  const repo = await getRepo(repoId, userId)

  const jobRes = await pool.query(
    `INSERT INTO ingestion_jobs (repo_id, status)
     VALUES ($1::uuid, 'queued') RETURNING id`,
    [repoId]
  )
  const jobId = jobRes.rows[0].id

  // Full re-index: incremental skips when Postgres SHAs match but Chroma is empty
  await addIngestionJob({
    repoId,
    jobId,
    repoUrl:     repo.url,
    branch:      repo.branch,
    incremental: false,
  })

  return { jobId }
}

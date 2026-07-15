CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued',
  progress      INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_repo_id ON ingestion_jobs(repo_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON ingestion_jobs(status);
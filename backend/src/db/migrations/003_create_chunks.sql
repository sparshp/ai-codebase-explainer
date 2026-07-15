CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  repo_id      UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  start_line   INTEGER NOT NULL DEFAULT 0,
  end_line     INTEGER NOT NULL DEFAULT 0,
  symbol_name  TEXT,
  symbol_type  TEXT,
  language     TEXT,
  content_hash TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BM25 full-text search index — CRITICAL, do not skip
CREATE INDEX IF NOT EXISTS idx_chunks_repo_id
  ON chunks(repo_id);

CREATE INDEX IF NOT EXISTS idx_chunks_file_path
  ON chunks(repo_id, file_path);

-- GIN index for full-text search (BM25 via PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON chunks USING GIN (to_tsvector('english', text));
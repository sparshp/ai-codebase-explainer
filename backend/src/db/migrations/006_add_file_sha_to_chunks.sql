ALTER TABLE chunks ADD COLUMN IF NOT EXISTS file_sha TEXT;

CREATE INDEX IF NOT EXISTS idx_chunks_repo_file_sha
  ON chunks(repo_id, file_path, file_sha);

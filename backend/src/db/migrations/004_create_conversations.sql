CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id              UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  conversation_id      TEXT NOT NULL,
  question             TEXT NOT NULL,
  answer               TEXT NOT NULL,
  citations            JSONB,
  tokens_used          INTEGER,
  latency_ms           INTEGER,
  groundedness_score   REAL,
  hallucination_count  INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_repo_id     ON conversations(repo_id);
CREATE INDEX IF NOT EXISTS idx_conv_conv_id     ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_created_at  ON conversations(created_at DESC);
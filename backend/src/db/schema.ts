import {
  pgTable, text, integer, timestamp,
  jsonb, real, boolean, uuid,
} from 'drizzle-orm/pg-core'

export const repos = pgTable('repos', {
  id:        uuid('id').primaryKey().defaultRandom(),
  url:       text('url').notNull(),
  name:      text('name').notNull(),
  branch:    text('branch').notNull().default('main'),
  status:    text('status').notNull().default('queued'),
  // status: queued | processing | ready | failed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const ingestionJobs = pgTable('ingestion_jobs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  repoId:       uuid('repo_id').notNull().references(() => repos.id),
  status:       text('status').notNull().default('queued'),
  progress:     integer('progress').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt:    timestamp('started_at'),
  completedAt:  timestamp('completed_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const chunks = pgTable('chunks', {
  id:          text('id').primaryKey(),   // deterministic: repoId:filePath:symbol:line
  repoId:      uuid('repo_id').notNull().references(() => repos.id),
  text:        text('text').notNull(),
  filePath:    text('file_path').notNull(),
  startLine:   integer('start_line').notNull(),
  endLine:     integer('end_line').notNull(),
  symbolName:  text('symbol_name'),
  symbolType:  text('symbol_type'),       // function | class | file_summary
  language:    text('language'),
  contentHash: text('content_hash'),
  fileSha:     text('file_sha'),           // GitHub blob SHA for incremental diff
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const conversations = pgTable('conversations', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  repoId:             uuid('repo_id').notNull().references(() => repos.id),
  conversationId:     text('conversation_id').notNull(),
  question:           text('question').notNull(),
  answer:             text('answer').notNull(),
  citations:          jsonb('citations'),
  tokensUsed:         integer('tokens_used'),
  latencyMs:          integer('latency_ms'),
  groundednessScore:  real('groundedness_score'),
  hallucinationCount: integer('hallucination_count').default(0),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// TypeScript types inferred from schema
export type Repo         = typeof repos.$inferSelect
export type NewRepo      = typeof repos.$inferInsert
export type Chunk        = typeof chunks.$inferSelect
export type NewChunk     = typeof chunks.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
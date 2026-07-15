import dotenv from 'dotenv'
dotenv.config()

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProd  = nodeEnv === 'production'

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

export const config = {
  port:              parseInt(process.env.PORT || '3000'),
  nodeEnv,
  isProd,
  databaseUrl:       requireEnv('DATABASE_URL'),
  redisUrl:          requireEnv('REDIS_URL'),
  chromaUrl:         normalizeUrl(process.env.CHROMA_URL || 'http://localhost:8000'),
  frontendUrl:       process.env.FRONTEND_URL || 'http://localhost:5173',

  // Embeddings — ollama (local) or huggingface (cloud)
  embedProvider:     process.env.EMBED_PROVIDER || (isProd ? 'huggingface' : 'ollama'),
  ollamaUrl:         process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaEmbedModel:  process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  hfApiKey:          process.env.HF_API_KEY || '',
  hfEmbedModel:      process.env.HF_EMBED_MODEL || 'nomic-ai/nomic-embed-text-v1.5',
  embedDim:          parseInt(process.env.EMBED_DIM || '768'),

  ollamaLlmModel:    process.env.OLLAMA_LLM_MODEL || 'llama3.2',
  jwtSecret:         requireEnv('JWT_SECRET'),
  jwtAccessExpiry:   process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry:  process.env.JWT_REFRESH_EXPIRY || '7d',
  githubToken:       process.env.GITHUB_TOKEN || '',

  llmProvider:       process.env.LLM_PROVIDER || (isProd ? 'groq' : 'ollama'),
  groqApiKey:        process.env.GROQ_API_KEY || '',
  groqLlmModel:      process.env.GROQ_LLM_MODEL || 'llama-3.1-8b-instant',

  enableRerank:      process.env.ENABLE_RERANK === 'true',
  maxExpandedQueries: parseInt(process.env.MAX_EXPANDED_QUERIES || '1'),
  maxContextTokens:  parseInt(process.env.MAX_CONTEXT_TOKENS || '2500'),
}

/** Allowed browser origins for CORS (dev + deployed frontend). */
export function corsOrigins(): string[] {
  const origins = new Set<string>([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3001',
  ])

  if (config.frontendUrl) origins.add(config.frontendUrl.replace(/\/$/, ''))

  const extra = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || []
  extra.forEach(o => origins.add(o.replace(/\/$/, '')))

  return [...origins]
}

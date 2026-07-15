import dotenv from 'dotenv'
dotenv.config()

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProd  = nodeEnv === 'production'

function normalizeChromaUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, '')

  if (!url.includes('://')) {
    // Blueprint hostport e.g. "codeexplainer-chroma:8000" — free tier has no private net
    const host = url.split(':')[0]
    if (host !== 'localhost' && host !== '127.0.0.1') {
      url = `https://${host}.onrender.com`
    } else {
      url = `http://${url}`
    }
  }

  return url.replace(/\/$/, '')
}

/** Accept plain rediss:// URLs or accidental redis-cli paste from Upstash. */
function normalizeRedisUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, '')

  // Strip: redis-cli --tls -u <url>
  const cliMatch = url.match(/redis(?:s)?:\/\/\S+/)
  if (cliMatch) url = cliMatch[0]

  // Upstash requires TLS — upgrade redis:// → rediss://
  if (url.startsWith('redis://') && /upstash\.io/i.test(url)) {
    url = 'rediss://' + url.slice('redis://'.length)
  }

  return url
}

export const config = {
  port:              parseInt(process.env.PORT || '3000'),
  nodeEnv,
  isProd,
  databaseUrl:       requireEnv('DATABASE_URL'),
  redisUrl:          normalizeRedisUrl(requireEnv('REDIS_URL')),
  chromaUrl:         normalizeChromaUrl(process.env.CHROMA_URL || 'http://localhost:8000'),
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

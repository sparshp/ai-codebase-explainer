
import { redis } from '@config/redis'
import { sha256 } from '@utils/hash'
import { logger } from '@utils/logger'

const TTL_SECONDS = 300  // 5 minutes

function cacheKey(question: string, repoId: string): string {
  const normalised = question.toLowerCase().trim()
  return `qcache:${sha256(normalised + repoId)}`
}

export async function getCached(
  question: string,
  repoId:   string
): Promise<{ answer: string; citations: Record<string, any> } | null> {
  try {
    const key = cacheKey(question, repoId)
    const raw = await redis.get(key)
    if (!raw) return null
    logger.debug({ key }, 'Cache hit')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function setCached(
  question:  string,
  repoId:    string,
  response:  { answer: string; citations: Record<string, any> }
): Promise<void> {
  try {
    const key = cacheKey(question, repoId)
    await redis.set(key, JSON.stringify(response), 'EX', TTL_SECONDS)
    logger.debug({ key }, 'Cached response')
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Cache set failed')
  }
}

export async function invalidateRepo(repoId: string): Promise<void> {
  // When a repo is re-indexed, clear all its cached queries
  const keys = await redis.keys(`qcache:*`)
  // Simple approach: clear all cache on re-index
  // Production: use Redis SCAN with tag-based invalidation
  if (keys.length > 0) await redis.del(...keys)
}

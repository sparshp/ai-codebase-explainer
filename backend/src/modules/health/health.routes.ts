import { Router } from 'express'
import { pool } from '@config/database'
import { redis } from '@config/redis'
import { chromaHeartbeatQuick } from '@config/chroma'

const router = Router()

/**
 * Liveness for Render: return 200 when API can take traffic (Postgres + Redis).
 * Chroma is reported but does NOT fail the health check — free-tier Chroma
 * sleep/429 must not block deploys.
 */
router.get('/', async (_req, res) => {
  const checks = await Promise.allSettled([
    pool.query('SELECT 1'),
    redis.ping(),
    chromaHeartbeatQuick(),
  ])

  const pg = checks[0].status === 'fulfilled' ? 'ok' : 'down'
  const rd = checks[1].status === 'fulfilled' ? 'ok' : 'down'
  const ch =
    checks[2].status === 'fulfilled' && checks[2].value === 'ok' ? 'ok' : 'down'

  const coreOk = pg === 'ok' && rd === 'ok'

  res.status(coreOk ? 200 : 503).json({
    status: coreOk ? (ch === 'ok' ? 'ok' : 'degraded') : 'down',
    services: { postgres: pg, redis: rd, chroma: ch },
    uptime: process.uptime(),
    hint: ch === 'down'
      ? 'Chroma sleeping or wake-rate-limited. API is up; vectors wake on first ingest/chat.'
      : undefined,
  })
})

export default router

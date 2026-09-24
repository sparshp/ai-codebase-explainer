import { Router } from 'express'
import { pool } from '@config/database'
import { redis } from '@config/redis'
import axios from 'axios'
import { config } from '@config/index'

const router = Router()

router.get('/', async (_req, res) => {
  const checks = await Promise.allSettled([
    pool.query('SELECT 1'),
    redis.ping(),
    axios.get(`${config.chromaUrl}/api/v2/heartbeat`, {
      timeout: 15_000,
      validateStatus: s => s < 500,
    }).then(r => {
      if (r.status === 429) throw new Error('chroma rate limited')
      if (r.status >= 400) throw new Error(`chroma ${r.status}`)
      return r
    }),
  ])

  const [pg, rd, ch] = checks.map(c => c.status === 'fulfilled' ? 'ok' : 'down')
  const allOk = [pg, rd, ch].every(s => s === 'ok')

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    services: { postgres: pg, redis: rd, chroma: ch },
    uptime: process.uptime(),
    hint: ch === 'down'
      ? 'Chroma may be sleeping or wake-rate-limited on Render free tier. Open /api/v2/heartbeat once and wait ~60s.'
      : undefined,
  })
})

export default router
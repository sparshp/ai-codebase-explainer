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
    axios.get(`${config.chromaUrl}/api/v2/heartbeat`),
  ])

  const [pg, rd, ch] = checks.map(c => c.status === 'fulfilled' ? 'ok' : 'down')
  const allOk = [pg, rd, ch].every(s => s === 'ok')

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    services: { postgres: pg, redis: rd, chroma: ch },
    uptime: process.uptime(),
  })
})

export default router
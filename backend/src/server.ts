import { createApp } from './app'
import { connectDB }    from '@config/database'
import { connectRedis } from '@config/redis'
import { connectChroma, wakeChromaInBackground } from '@config/chroma'
import { config }       from '@config/index'
import { logger }       from '@utils/logger'

// Run migrations on startup
import { pool } from '@config/database'
import fs from 'fs'
import path from 'path'

async function runMigrations() {
  const dir = path.join(__dirname, 'db', 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const client = await pool.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY, ran_at TIMESTAMPTZ DEFAULT NOW()
    )`)
    for (const file of files) {
      const { rows } = await client.query(
        'SELECT filename FROM _migrations WHERE filename = $1', [file]
      )
      if (rows.length) continue
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'))
      await client.query('INSERT INTO _migrations VALUES ($1)', [file])
      logger.info(`Migration: ${file}`)
    }
  } finally { client.release() }
}

async function start() {
  // Required for serving traffic — keep this fast so Render health checks pass
  await connectDB()
  await connectRedis()
  await runMigrations()

  // Chroma is optional at boot (free tier sleeps / rate-limits). Don't block listen().
  await connectChroma()

  let worker: { close: () => Promise<void> } | null = null
  if (process.env.RUN_WORKER === 'true') {
    const { startIngestionWorker } = await import('@workers/ingestion.worker')
    worker = startIngestionWorker()
    logger.info('Ingestion worker running inside API process')
  }

  const app = createApp()
  // Bind 0.0.0.0 so Render port scan sees the open port
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`✅ API server running on http://0.0.0.0:${config.port}`)
    // Warm Chroma in background after we're healthy for Render
    wakeChromaInBackground()
  })

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received`)
    server.close()
    if (worker) await worker.close().catch(() => {})
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

start().catch(err => {
  logger.error({ err }, 'Server failed to start')
  process.exit(1)
})

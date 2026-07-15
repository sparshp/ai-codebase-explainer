import { createApp } from './app'
import { connectDB }    from '@config/database'
import { connectRedis } from '@config/redis'
import { connectChroma } from '@config/chroma'
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
  await connectDB()
  await connectRedis()
  await connectChroma()
  await runMigrations()

  // Free-tier deploys: run BullMQ worker inside the web process (Render workers are paid)
  let worker: { close: () => Promise<void> } | null = null
  if (process.env.RUN_WORKER === 'true') {
    const { startIngestionWorker } = await import('@workers/ingestion.worker')
    worker = startIngestionWorker()
    logger.info('Ingestion worker running inside API process')
  }

  const app = createApp()
  const server = app.listen(config.port, () => {
    logger.info(`✅ API server running on http://localhost:${config.port}`)
  })

  // Graceful shutdown
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
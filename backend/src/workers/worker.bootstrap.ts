import dotenv from 'dotenv'
dotenv.config()

import { connectDB } from '@config/database'
import { connectRedis } from '@config/redis'
import { connectChroma } from '@config/chroma'
import { startIngestionWorker } from './ingestion.worker'
import { logger } from '@utils/logger'

async function start() {
  await connectDB()
  await connectRedis()
  await connectChroma()
  const worker = startIngestionWorker()

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM — closing worker')
    await worker.close()
    process.exit(0)
  })
}

start().catch(err => {
  logger.error({ err }, 'Worker bootstrap failed')
  process.exit(1)
})

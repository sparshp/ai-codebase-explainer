import { Queue } from 'bullmq'
import { redis } from '@config/redis'

export interface IngestionJobData {
  repoId:  string
  jobId:   string   // Postgres UUID — NOT the BullMQ numeric job.id
  repoUrl: string
  branch:  string
  incremental: boolean
}

export const ingestionQueue = new Queue<IngestionJobData>('ingestion', {
  connection: redis,
  defaultJobOptions: {
    attempts:         1,   // no auto-retry — rate limit burns quota on each attempt
    removeOnComplete: 50,
    removeOnFail:     20,
  },
})

export async function addIngestionJob(data: IngestionJobData): Promise<string> {
  const job = await ingestionQueue.add('ingest', data)
  return job.id!
}
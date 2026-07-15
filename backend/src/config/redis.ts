import Redis from 'ioredis'
import { config as appConfig } from './index'

export const redis = new Redis(appConfig.redisUrl, {
  maxRetriesPerRequest: null,   // BullMQ requires this to be null
  retryStrategy: (times) => Math.min(times * 100, 2000),
})

redis.on('error', (err) => console.error('Redis error:', err.message))

export async function connectRedis(): Promise<void> {
  await redis.ping()
  console.log('✅ Redis connected')
}
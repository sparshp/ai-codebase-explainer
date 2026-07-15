import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@db/schema'
import { config as appConfig } from './index'

export const pool = new Pool({
  connectionString: appConfig.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export const db = drizzle(pool, { schema })

export async function connectDB(): Promise<void> {
  const client = await pool.connect()
  await client.query('SELECT 1')
  client.release()
  console.log('✅ PostgreSQL connected')
}
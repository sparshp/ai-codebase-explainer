import { pool } from '@config/database'
import fs from 'fs'
import path from 'path'

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).sort()

  const client = await pool.connect()
  try {
    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        ran_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    for (const file of files) {
      if (!file.endsWith('.sql')) continue

      const { rows } = await client.query(
        'SELECT filename FROM _migrations WHERE filename = $1', [file]
      )
      if (rows.length > 0) {
        console.log(`⏭  Already ran: ${file}`)
        continue
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query(sql)
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)', [file]
      )
      console.log(`✅ Ran migration: ${file}`)
    }
    console.log('✅ All migrations complete')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
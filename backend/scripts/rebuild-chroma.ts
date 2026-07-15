import { rebuildVectorsFromPostgres } from '../src/services/vectorstore/chroma.rehydrate'
import { pool } from '../src/config/database'

const repoId = process.argv[2] || '3150ef8d-fc42-409a-ba1e-6d3c1a789777'

async function main() {
  const n = await rebuildVectorsFromPostgres(repoId)
  await pool.query(`UPDATE repos SET status='ready', updated_at=NOW() WHERE id=$1::uuid`, [repoId])
  console.log(`Rebuilt ${n} vectors for ${repoId}`)
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end().catch(() => {})
  process.exit(1)
})

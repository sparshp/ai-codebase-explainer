import axios from 'axios'
import { config } from '@config/index'
import { Chunk } from '@services/chunker/chunker.service'
import { logger } from '@utils/logger'
import { ensureChromaAwake, markChromaDown } from '@config/chroma'

const BASE = () => `${config.chromaUrl}/api/v2/tenants/default_tenant/databases/default_database`

function collectionName(repoId: string): string {
  return `repo-${repoId.replace(/_/g, '-')}`
}

const collectionIdCache = new Map<string, string>()

async function withChroma<T>(fn: () => Promise<T>): Promise<T> {
  const awake = await ensureChromaAwake()
  if (!awake) {
    throw new Error(
      'Chroma is still waking up or rate-limited on Render free tier. ' +
      'Open the Chroma heartbeat URL once, wait ~60s, then retry.'
    )
  }
  try {
    return await fn()
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 429 || status === 502 || status === 503) {
      markChromaDown()
    }
    throw err
  }
}

// ── helpers ──────────────────────────────────────────────────────

function cacheCollectionId(name: string, id: string): string {
  collectionIdCache.set(name, id)
  return id
}

async function getOrCreateCollection(name: string): Promise<string> {
  const cached = collectionIdCache.get(name)
  if (cached) return cached

  // Try to get existing collection
  try {
    const res = await axios.get(`${BASE()}/collections/${name}`)
    return cacheCollectionId(name, res.data.id)
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err
  }

  // Create new collection
  const res = await axios.post(`${BASE()}/collections`, {
    name,
    metadata: { 'hnsw:space': 'cosine' },
    get_or_create: true,
  })
  return cacheCollectionId(name, res.data.id)
}

async function getCollectionId(name: string): Promise<string | null> {
  const cached = collectionIdCache.get(name)
  if (cached) return cached

  try {
    const res = await axios.get(`${BASE()}/collections/${name}`)
    return cacheCollectionId(name, res.data.id)
  } catch {
    return null
  }
}

export async function collectionExists(repoId: string): Promise<boolean> {
  const id = await getCollectionId(collectionName(repoId))
  return id != null
}

// ── public API ───────────────────────────────────────────────────

export async function upsertChunks(
  repoId: string,
  chunks: Chunk[],
  vectors: number[][]
): Promise<void> {
  await withChroma(async () => {
    const name         = collectionName(repoId)
    const collectionId = await getOrCreateCollection(name)

    const BATCH = 100
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batchChunks  = chunks.slice(i, i + BATCH)
      const batchVectors = vectors.slice(i, i + BATCH)

      await axios.post(`${BASE()}/collections/${collectionId}/upsert`, {
        ids:        batchChunks.map(c => c.id),
        embeddings: batchVectors,
        metadatas:  batchChunks.map(c => ({
          repoId:     c.repoId,
          filePath:   c.filePath,
          startLine:  String(c.startLine),
          endLine:    String(c.endLine),
          symbolName: c.symbolName || '',
          symbolType: c.symbolType || '',
        })),
        documents: batchChunks.map(c => c.text),
      })

      logger.debug({
        batch: Math.floor(i / BATCH) + 1,
        total: Math.ceil(chunks.length / BATCH),
      }, 'Chroma upsert batch')
    }
  })
}

export async function queryVectors(
  repoId: string,
  queryVector: number[],
  topK: number = 10
): Promise<Array<{ id: string; score: number; metadata: Record<string, any>; text: string }>> {
  return withChroma(async () => {
    const name         = collectionName(repoId)
    const collectionId = await getCollectionId(name)
    if (!collectionId) return []

    const res = await axios.post(`${BASE()}/collections/${collectionId}/query`, {
      query_embeddings: [queryVector],
      n_results:        topK,
      include:          ['distances', 'metadatas', 'documents'],
    })

    const ids       = res.data.ids?.[0]       || []
    const distances = res.data.distances?.[0] || []
    const metadatas = res.data.metadatas?.[0] || []
    const documents = res.data.documents?.[0] || []

    return ids.map((id: string, i: number) => ({
      id,
      score:    1 - (distances[i] || 0),
      metadata: metadatas[i] || {},
      text:     documents[i] || '',
    }))
  })
}

export async function deleteCollection(repoId: string): Promise<void> {
  await withChroma(async () => {
    const name         = collectionName(repoId)
    const collectionId = await getCollectionId(name)
    if (!collectionId) return
    try {
      await axios.delete(`${BASE()}/collections/${collectionId}`)
    } catch {
      // ignore if already gone
    } finally {
      collectionIdCache.delete(name)
    }
  })
}
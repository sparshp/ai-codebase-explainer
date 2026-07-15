import axios from 'axios'
import { config } from '@config/index'
import { logger } from '@utils/logger'
import { sleep } from '@utils/sleep'

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return norm === 0 ? vec : vec.map(v => v / norm)
}

function toVector(raw: unknown): number[] {
  if (Array.isArray(raw) && typeof raw[0] === 'number') {
    return l2Normalize(raw as number[])
  }
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    // Token-level matrix → mean pool, or already [[embedding]]
    const first = raw[0] as unknown
    if (Array.isArray(first) && typeof (first as number[])[0] === 'number') {
      const tokens = raw as number[][]
      // single embedding row: [[dim0, dim1, ...]]
      if (tokens.length === 1) return l2Normalize(tokens[0])
      const dim  = tokens[0].length
      const mean = new Array(dim).fill(0)
      for (const tok of tokens) {
        for (let i = 0; i < dim; i++) mean[i] += tok[i]
      }
      return l2Normalize(mean.map(v => v / tokens.length))
    }
  }
  throw new Error('Unexpected embedding shape from provider')
}

function formatHfError(err: any): string {
  const data = err?.response?.data
  if (typeof data === 'string') return data.slice(0, 400)
  if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
  if (data?.message) return data.message
  return err?.message || 'unknown error'
}

async function embedWithOllama(texts: string[]): Promise<number[][]> {
  const BATCH = 20
  const allVectors: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    let attempts = 0

    while (attempts < 3) {
      try {
        const res = await axios.post(`${config.ollamaUrl}/api/embed`, {
          model:      config.ollamaEmbedModel,
          input:      batch,
          keep_alive: '30m',
        })
        const vecs: number[][] = res.data.embeddings
        allVectors.push(...vecs.map(l2Normalize))
        break
      } catch (err: any) {
        attempts++
        logger.warn({ attempt: attempts, error: err?.message }, 'Ollama embed retry')
        if (attempts >= 3) throw err
        await sleep(1000 * attempts)
      }
    }
  }

  return allVectors
}

async function embedWithHuggingFace(texts: string[]): Promise<number[][]> {
  if (!config.hfApiKey) {
    throw new Error('HF_API_KEY is required when EMBED_PROVIDER=huggingface')
  }

  // Explicit feature-extraction pipeline — required by Inference Providers
  const url =
    `https://router.huggingface.co/hf-inference/models/${config.hfEmbedModel}` +
    '/pipeline/feature-extraction'

  const vectors: number[][] = []
  const BATCH = 8

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map(t => t.slice(0, 8000))
    let attempts = 0

    while (attempts < 3) {
      try {
        const res = await axios.post(
          url,
          {
            inputs: batch.length === 1 ? batch[0] : batch,
            truncate: true,
            normalize: true,
          },
          {
            headers: {
              Authorization: `Bearer ${config.hfApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
          }
        )

        const data = res.data
        if (batch.length === 1) {
          vectors.push(toVector(data))
        } else if (Array.isArray(data)) {
          for (const item of data) vectors.push(toVector(item))
        } else {
          throw new Error('Unexpected batch embedding response from Hugging Face')
        }
        break
      } catch (err: any) {
        attempts++
        const status = err?.response?.status
        const detail = formatHfError(err)
        logger.warn({ attempt: attempts, status, error: detail, model: config.hfEmbedModel }, 'HF embed retry')

        if (attempts >= 3) {
          if (status === 401 || status === 403) {
            throw new Error(
              `Hugging Face rejected the API key (${status}): ${detail}. ` +
              'Create a new token with Inference Providers access and set HF_API_KEY on Render.'
            )
          }
          if (status === 400) {
            throw new Error(
              `Hugging Face bad request (400) for model "${config.hfEmbedModel}": ${detail}. ` +
              'Set HF_EMBED_MODEL to a serverless-supported embedding model ' +
              '(e.g. sentence-transformers/all-mpnet-base-v2) and keep EMBED_DIM=768.'
            )
          }
          throw new Error(`Hugging Face embed failed (${status ?? 'network'}): ${detail}`)
        }
        await sleep(status === 503 ? 3000 * attempts : 1000 * attempts)
      }
    }
  }

  return vectors
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const safe = texts.map(t => (t?.trim() ? t.trim() : '(empty)'))

  if (config.embedProvider === 'huggingface') {
    return embedWithHuggingFace(safe)
  }
  return embedWithOllama(safe)
}

export async function embedSingle(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text])
  return vec
}

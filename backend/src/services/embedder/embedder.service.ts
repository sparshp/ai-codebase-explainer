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
    const tokens = raw as number[][]
    const dim    = tokens[0].length
    const mean   = new Array(dim).fill(0)
    for (const tok of tokens) {
      for (let i = 0; i < dim; i++) mean[i] += tok[i]
    }
    return l2Normalize(mean.map(v => v / tokens.length))
  }
  throw new Error('Unexpected embedding shape from provider')
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

  const url = `https://router.huggingface.co/hf-inference/models/${config.hfEmbedModel}`
  const vectors: number[][] = []

  for (const text of texts) {
    let attempts = 0
    while (attempts < 3) {
      try {
        const res = await axios.post(
          url,
          { inputs: text },
          {
            headers: {
              Authorization: `Bearer ${config.hfApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          }
        )
        vectors.push(toVector(res.data))
        break
      } catch (err: any) {
        attempts++
        const status = err?.response?.status
        logger.warn({ attempt: attempts, status, error: err?.message }, 'HF embed retry')
        if (attempts >= 3) throw err
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

import axios from 'axios'
import { config as appConfig } from './index'
import { logger } from '@utils/logger'

let chromaReady = false
let wakeInFlight: Promise<boolean> | null = null

function heartbeatUrl(): string {
  return `${appConfig.chromaUrl.replace(/\/$/, '')}/api/v2/heartbeat`
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Wake / probe Chroma on Render free tier.
 * Call this on first ingest/query — NOT during boot (blocks Render health checks).
 */
export async function ensureChromaAwake(opts?: {
  attempts?: number
  maxWaitMs?: number
}): Promise<boolean> {
  if (chromaReady) return true
  if (wakeInFlight) return wakeInFlight

  const attempts = opts?.attempts ?? 8
  const maxWaitMs = opts?.maxWaitMs ?? 120_000
  const started = Date.now()

  wakeInFlight = (async () => {
    for (let i = 1; i <= attempts; i++) {
      if (Date.now() - started > maxWaitMs) break

      try {
        const res = await axios.get(heartbeatUrl(), {
          timeout: 15_000,
          validateStatus: () => true,
        })

        if (res.status >= 200 && res.status < 300) {
          chromaReady = true
          console.log('✅ ChromaDB connected')
          return true
        }

        const routing = String(res.headers?.['x-render-routing'] || '')
        logger.warn(
          { attempt: i, status: res.status, routing, chromaUrl: appConfig.chromaUrl },
          'Chroma heartbeat failed'
        )

        if (routing === 'no-deploy') {
          logger.error(
            'Chroma has no active Render deploy. Open Render → codeexplainer-chroma → Manual Deploy.'
          )
          return false
        }

        if (res.status === 429 || routing.includes('hibernate-rate-limited')) {
          await sleep(Math.min(20_000 * i, 60_000))
          continue
        }

        await sleep(Math.min(8_000 * i, 40_000))
      } catch (err: any) {
        const status = err?.response?.status
        const routing = err?.response?.headers?.['x-render-routing']
        logger.warn(
          { attempt: i, status, routing, chromaUrl: appConfig.chromaUrl },
          'Chroma heartbeat failed'
        )

        if (routing === 'no-deploy') return false

        if (status === 429 || routing === 'hibernate-rate-limited') {
          await sleep(Math.min(20_000 * i, 60_000))
        } else {
          await sleep(Math.min(8_000 * i, 40_000))
        }
      }
    }

    console.warn(
      '⚠️  ChromaDB unreachable. Open the Chroma heartbeat URL once, wait ~60s, then retry.'
    )
    return false
  })()

  try {
    return await wakeInFlight
  } finally {
    wakeInFlight = null
  }
}

/**
 * Boot-time: one quick probe, never block deploy.
 * Full wake happens lazily via ensureChromaAwake() on first vector use.
 */
export async function connectChroma(): Promise<void> {
  chromaReady = false
  try {
    const res = await axios.get(heartbeatUrl(), {
      timeout: 3_000,
      validateStatus: () => true,
    })
    if (res.status >= 200 && res.status < 300) {
      chromaReady = true
      console.log('✅ ChromaDB connected')
      return
    }
    logger.warn(
      { status: res.status, routing: res.headers?.['x-render-routing'] },
      'Chroma not ready at boot — will wake on first use'
    )
  } catch (err: any) {
    logger.warn(
      { err: err?.message },
      'Chroma not reachable at boot — will wake on first use'
    )
  }
}

/** Non-blocking background wake (fire-and-forget after listen). */
export function wakeChromaInBackground(): void {
  void ensureChromaAwake().catch(() => {})
}

export function markChromaDown(): void {
  chromaReady = false
}

/** Fast status for /health — never waits on cold start. */
export async function chromaHeartbeatQuick(): Promise<'ok' | 'down'> {
  if (chromaReady) return 'ok'
  try {
    const res = await axios.get(heartbeatUrl(), {
      timeout: 2_000,
      validateStatus: () => true,
    })
    if (res.status >= 200 && res.status < 300) {
      chromaReady = true
      return 'ok'
    }
    return 'down'
  } catch {
    return 'down'
  }
}

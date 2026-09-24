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
 * - Sleeping service → 502 / cold start (wait longer)
 * - Too many wake probes → 429 + x-render-routing: hibernate-rate-limited (back off hard)
 * - no-deploy → permanent failure until redeployed
 */
export async function ensureChromaAwake(opts?: {
  attempts?: number
  /** Cap total wait; default ~2 minutes for free-tier wake */
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
          timeout: 25_000,
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

        // Rate-limited wake: wait much longer before next probe
        if (res.status === 429 || routing.includes('hibernate-rate-limited')) {
          await sleep(Math.min(20_000 * i, 60_000))
          continue
        }

        // Cold start / 502: moderate backoff
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
      '⚠️  ChromaDB unreachable — continuing without vectors. ' +
      'Tip: open https://codeexplainer-chroma.onrender.com/api/v2/heartbeat in a browser, ' +
      'wait ~60s for wake, then retry. Free tier rate-limits rapid wake probes.'
    )
    return false
  })()

  try {
    return await wakeInFlight
  } finally {
    wakeInFlight = null
  }
}

/** Startup probe — soft fail so API still boots when Chroma is sleeping. */
export async function connectChroma(): Promise<void> {
  chromaReady = false
  const ok = await ensureChromaAwake({ attempts: 6, maxWaitMs: 90_000 })
  if (!ok) {
    console.warn(
      '⚠️  ChromaDB unreachable at boot — API started anyway. ' +
      'Ingest/chat will retry waking Chroma on first use.'
    )
  }
}

export function markChromaDown(): void {
  chromaReady = false
}

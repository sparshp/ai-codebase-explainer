import axios from 'axios'
import { config as appConfig } from './index'
import { logger } from '@utils/logger'

/**
 * Free-tier Chroma on Render often returns 502 while sleeping or if the
 * service has no active deploy (`x-render-routing: no-deploy`).
 * Retry for cold starts; do not crash the API if Chroma is down.
 */
export async function connectChroma(): Promise<void> {
  const url = `${appConfig.chromaUrl}/api/v2/heartbeat`
  const attempts = 5

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await axios.get(url, { timeout: 20_000 })
      if (res.status >= 200 && res.status < 300) {
        console.log('✅ ChromaDB connected')
        return
      }
    } catch (err: any) {
      const status = err?.response?.status
      const routing = err?.response?.headers?.['x-render-routing']
      logger.warn(
        { attempt: i, status, routing, chromaUrl: appConfig.chromaUrl },
        'Chroma heartbeat failed'
      )

      if (routing === 'no-deploy') {
        logger.error(
          'Chroma Render service has no active deploy (x-render-routing: no-deploy). ' +
          'Fix: Render → codeexplainer-chroma → Manual Deploy (or recreate from render.yaml).'
        )
        break
      }

      if (i < attempts) {
        // Free-tier cold start can take 30–60s
        await new Promise(r => setTimeout(r, 4000 * i))
      }
    }
  }

  console.warn(
    '⚠️  ChromaDB unreachable — API started anyway. ' +
    'Ingest/chat vector search will fail until Chroma is healthy. ' +
    'Check Render service: codeexplainer-chroma'
  )
}

import axios from 'axios'
import { config as appConfig } from './index'

export async function connectChroma(): Promise<void> {
  // v2 API heartbeat
  await axios.get(`${appConfig.chromaUrl}/api/v2/heartbeat`)
  console.log('✅ ChromaDB connected')
}
import { QueryIntent } from '@modules/chat/query.analyser'

export function maxTokensForIntent(intent: QueryIntent): number {
  switch (intent) {
    case 'LOOKUP':       return 384
    case 'DEBUG':        return 768
    case 'FLOW':         return 1200
    case 'ARCHITECTURE': return 1100
  }
}

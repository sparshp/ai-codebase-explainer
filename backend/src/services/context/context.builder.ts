import { RankedResult } from '@services/retriever/rrf'
import { config } from '@config/index'
import { countTokens } from '@utils/tokens'

const DEFAULT_MAX_CONTEXT_TOKENS = config.maxContextTokens

export interface ContextBlock {
  text:         string
  usedChunks:   RankedResult[]
  droppedCount: number
  totalTokens:  number
}

// Track per-file chunk count for diversity
function enforceFileDiversity(
  chunks: RankedResult[],
  maxPerFile = 3
): RankedResult[] {
  const fileCounts: Record<string, number> = {}
  return chunks.filter(c => {
    const fp = c.metadata.filePath || ''
    fileCounts[fp] = (fileCounts[fp] || 0) + 1
    return fileCounts[fp] <= maxPerFile
  })
}

export function buildContext(
  chunks: RankedResult[],
  maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS
): ContextBlock {
  const diversified = enforceFileDiversity(chunks)
  const used: RankedResult[] = []
  let totalTokens = 0

  for (const chunk of diversified) {
    const snippet = [
      `--- Source: ${chunk.metadata.filePath}:${chunk.metadata.startLine} | ${chunk.metadata.symbolName} ---`,
      chunk.text,
    ].join('\n')

    const t = countTokens(snippet)
    if (totalTokens + t > maxTokens) break

    used.push(chunk)
    totalTokens += t
  }

  const text = used.map(c =>
    `--- Source: ${c.metadata.filePath}:${c.metadata.startLine} | ${c.metadata.symbolName} ---\n${c.text}`
  ).join('\n\n')

  return {
    text,
    usedChunks:   used,
    droppedCount: chunks.length - used.length,
    totalTokens,
  }
}

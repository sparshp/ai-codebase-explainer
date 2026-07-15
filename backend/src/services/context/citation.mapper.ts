import { RankedResult } from '@services/retriever/rrf'

export interface Citation {
  filePath:  string
  line:      number
  verified:  boolean
  chunkText?: string
}

export type CitationMap = Record<string, Citation>

const FILE_REF =
  '([a-zA-Z0-9_./()\\[\\]-]+\\.[a-zA-Z]{1,6})'

const INLINE_PATTERNS = [
  new RegExp(`\\[${FILE_REF}:(\\d+)(?:-\\d+)?\\]`, 'g'),
  new RegExp('`' + FILE_REF + ':(\\d+)(?:-\\d+)?`', 'g'),
  new RegExp('---\\s*' + FILE_REF + ':(\\d+)', 'g'),
  new RegExp('\\b' + FILE_REF + ':(\\d+)(?:-\\d+)?\\b', 'g'),
]

function findChunk(
  usedChunks: RankedResult[],
  filePath:   string,
  line:       number
): RankedResult | undefined {
  return usedChunks.find(c =>
    c.metadata.filePath === filePath &&
    c.metadata.startLine <= line &&
    c.metadata.endLine   >= line
  ) ?? usedChunks.find(c => c.metadata.filePath === filePath)
}

function addCitation(
  citationMap: CitationMap,
  filePath:    string,
  line:        number,
  usedChunks:  RankedResult[],
  verified?:   boolean
): void {
  const key = `${filePath}:${line}`
  if (citationMap[key]) return

  const chunk = findChunk(usedChunks, filePath, line)
  citationMap[key] = {
    filePath,
    line,
    verified:  verified ?? !!chunk,
    chunkText: chunk?.text?.slice(0, 400),
  }
}

function citationsFromChunks(usedChunks: RankedResult[]): CitationMap {
  const map: CitationMap = {}
  for (const chunk of usedChunks) {
    const filePath = chunk.metadata.filePath
    if (!filePath) continue
    addCitation(map, filePath, chunk.metadata.startLine || 0, usedChunks, true)
  }
  return map
}

export function mapCitations(
  response:   string,
  usedChunks: RankedResult[]
): CitationMap {
  const citationMap: CitationMap = {}

  for (const pattern of INLINE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(response)) !== null) {
      addCitation(citationMap, match[1], parseInt(match[2], 10), usedChunks)
    }
  }

  if (Object.keys(citationMap).length === 0) {
    return citationsFromChunks(usedChunks)
  }

  // Always attach source chunks so the UI can show verified references
  for (const chunk of usedChunks) {
    const filePath = chunk.metadata.filePath
    if (!filePath) continue
    addCitation(
      citationMap,
      filePath,
      chunk.metadata.startLine || 0,
      usedChunks,
      true
    )
  }

  return citationMap
}

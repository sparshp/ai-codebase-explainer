import { ParsedFile } from '@services/parser/parser.service'
import { makeChunkId } from '@utils/hash'
import { countTokens } from '@utils/tokens'

const MAX_CHUNK_TOKENS = 400

export interface Chunk {
  id:          string
  text:        string
  repoId:      string
  filePath:    string
  startLine:   number
  endLine:     number
  symbolName:  string
  symbolType:  string
  language:    string
  contentHash: string
}

function buildChunkText(
  filePath: string,
  symbolName: string,
  startLine: number,
  endLine: number,
  body: string,
  docstring?: string
): string {
  const header = `File: ${filePath} | Symbol: ${symbolName} | Lines: ${startLine}-${endLine}`
  const doc    = docstring ? `\n// ${docstring}` : ''
  return `${header}${doc}\n\n${body}`
}

export function buildChunks(parsedFile: ParsedFile, repoId: string): Chunk[] {
  const chunks: Chunk[] = []

  for (const symbol of parsedFile.symbols) {
    const text = buildChunkText(
      parsedFile.path,
      symbol.name,
      symbol.startLine,
      symbol.endLine,
      symbol.body,
      symbol.docstring
    )

    // If chunk is too large, split on blank lines
    if (countTokens(text) > MAX_CHUNK_TOKENS) {
      const subChunks = splitLargeChunk(
        parsedFile.path, symbol.name,
        symbol.startLine, symbol.body, repoId,
        parsedFile.language
      )
      chunks.push(...subChunks)
      continue
    }

    const id = makeChunkId(repoId, parsedFile.path, symbol.name, symbol.startLine)
    chunks.push({
      id,
      text,
      repoId,
      filePath:    parsedFile.path,
      startLine:   symbol.startLine,
      endLine:     symbol.endLine,
      symbolName:  symbol.name,
      symbolType:  symbol.type,
      language:    parsedFile.language,
      contentHash: id,   // reuse sha as content hash for simplicity
    })
  }

  // Add file-level summary chunk
  const summaryText = [
    `File summary: ${parsedFile.path}`,
    `Language: ${parsedFile.language}`,
    `Exports: ${parsedFile.symbols.map(s => s.name).join(', ')}`,
    `Imports: ${parsedFile.imports.slice(0, 10).join(', ')}`,
  ].join('\n')

  chunks.push({
    id:          makeChunkId(repoId, parsedFile.path, '__file_summary__', 0),
    text:        summaryText,
    repoId,
    filePath:    parsedFile.path,
    startLine:   0,
    endLine:     0,
    symbolName:  '__file_summary__',
    symbolType:  'file_summary',
    language:    parsedFile.language,
    contentHash: makeChunkId(repoId, parsedFile.path, '__file_summary__', 0),
  })

  return chunks
}

function splitLargeChunk(
  filePath: string,
  symbolName: string,
  startLine: number,
  body: string,
  repoId: string,
  language: string
): Chunk[] {
  const lines  = body.split('\n')
  const chunks: Chunk[] = []
  let buf: string[] = []
  let bufStart = startLine
  let part = 0

  for (let i = 0; i < lines.length; i++) {
    buf.push(lines[i])
    const text = buildChunkText(
      filePath, `${symbolName}_part${part}`,
      bufStart + i - buf.length + 1,
      bufStart + i,
      buf.join('\n')
    )

    if (countTokens(text) >= MAX_CHUNK_TOKENS || i === lines.length - 1) {
      const chunkStartLine = bufStart + i - buf.length + 1
      const id = makeChunkId(repoId, filePath, `${symbolName}_part${part}`, chunkStartLine)
      chunks.push({
        id, text, repoId, filePath,
        startLine:   chunkStartLine,
        endLine:     bufStart + i,
        symbolName:  `${symbolName}_part${part}`,
        symbolType:  'function',
        language,
        contentHash: id,
      })
      buf = []
      part++
    }
  }

  return chunks
}
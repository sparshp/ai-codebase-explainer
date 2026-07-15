import crypto from 'crypto'

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function makeChunkId(
  repoId: string,
  filePath: string,
  symbolName: string,
  startLine: number
): string {
  return sha256(`${repoId}:${filePath}:${symbolName}:${startLine}`)
}
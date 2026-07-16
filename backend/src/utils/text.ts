/** PostgreSQL TEXT columns reject NUL (0x00) and some control bytes. */
export function sanitizeTextForDb(text: string): string {
  return text
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/** Skip files that are clearly binary (common when GitHub serves non-text blobs). */
export function isBinaryContent(content: string): boolean {
  if (content.includes('\0')) return true

  const sample = content.slice(0, 8000)
  if (!sample.length) return false

  let control = 0
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i)
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) control++
  }
  return control / sample.length > 0.03
}

export function decodeGitHubBlobContent(base64: string): string | null {
  try {
    const raw = Buffer.from(base64.replace(/\n/g, ''), 'base64').toString('utf8')
    if (isBinaryContent(raw)) return null
    return sanitizeTextForDb(raw)
  } catch {
    return null
  }
}

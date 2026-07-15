import { get_encoding } from 'tiktoken'

const enc = get_encoding('cl100k_base')

export function countTokens(text: string): number {
  try {
    return enc.encode(text).length
  } catch {
    // fallback: rough estimate
    return Math.ceil(text.length / 4)
  }
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const tokens = enc.encode(text)
  if (tokens.length <= maxTokens) return text
  return new TextDecoder().decode(enc.decode(tokens.slice(0, maxTokens)))
}
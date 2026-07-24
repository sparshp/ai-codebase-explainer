/** Shared anti-injection footer appended to every intent system prompt. */
import { ANTI_INJECTION_RULES } from '../prompt-guard'

export function withSecurityRules(prompt: string): string {
  return `${prompt.trim()}\n${ANTI_INJECTION_RULES}`
}

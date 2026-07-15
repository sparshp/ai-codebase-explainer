import { z } from 'zod'

export const querySchema = z.object({
  question:        z.string().min(3).max(1000),
  repoId:          z.string().uuid(),
  conversationId:  z.string().optional(),
  // Optional override from UI mode chips (Lookup / Architecture / Flow / Debug)
  intent:          z.enum(['LOOKUP', 'ARCHITECTURE', 'DEBUG', 'FLOW']).optional(),
})
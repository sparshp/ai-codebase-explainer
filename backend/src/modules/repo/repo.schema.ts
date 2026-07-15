import { z } from 'zod'

export const ingestRepoSchema = z.object({
  url:    z.string().url().includes('github.com'),
  branch: z.string().optional().default('main'),
})
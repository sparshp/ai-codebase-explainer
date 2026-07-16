import { z } from 'zod'

const GITHUB_REPO_URL =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(?:\.git)?\/?$/i

export const ingestRepoSchema = z.object({
  url: z
    .string()
    .trim()
    .regex(
      GITHUB_REPO_URL,
      'Only public GitHub repository URLs are supported (e.g. https://github.com/owner/repo)'
    ),
  branch: z.string().trim().min(1).optional().default('main'),
})

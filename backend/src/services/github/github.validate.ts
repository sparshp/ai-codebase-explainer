import axios from 'axios'
import { config } from '@config/index'
import { AppError } from '@utils/errors'

const GITHUB_REPO_RE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } {
  const trimmed = url.trim()
  const match = trimmed.match(GITHUB_REPO_RE)
  if (!match) {
    throw new AppError(
      'Only public GitHub repository URLs are supported (e.g. https://github.com/owner/repo)',
      400,
      'INVALID_REPO_URL'
    )
  }
  return { owner: match[1], repo: match[2] }
}

/** Fail fast before enqueueing: public GitHub only, repo + branch must exist. */
export async function assertPublicGitHubRepo(url: string, branch: string): Promise<void> {
  const { owner, repo } = parseGitHubRepoUrl(url)

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (config.githubToken) {
    headers.Authorization = `token ${config.githubToken}`
  }

  let meta: any
  try {
    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    })

    if (res.status === 404) {
      throw new AppError(
        'Repository not found. Only public GitHub repositories can be indexed.',
        404,
        'REPO_NOT_FOUND'
      )
    }
    if (res.status === 403) {
      throw new AppError(
        'This repository is private or access was denied. Only public GitHub repositories are supported.',
        403,
        'PRIVATE_REPO'
      )
    }
    if (res.status !== 200) {
      throw new AppError(
        `GitHub API error (${res.status}). Please try again.`,
        502,
        'GITHUB_API_ERROR'
      )
    }
    meta = res.data
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError(
      `Could not reach GitHub: ${err?.message || 'network error'}`,
      502,
      'GITHUB_UNAVAILABLE'
    )
  }

  if (meta?.private === true) {
    throw new AppError(
      'This repository is private. Only public GitHub repositories are supported.',
      403,
      'PRIVATE_REPO'
    )
  }

  // Confirm branch exists (404 here usually means wrong branch name)
  const branchRes = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    { headers, timeout: 15000, validateStatus: () => true }
  )

  if (branchRes.status === 404) {
    throw new AppError(
      `Branch "${branch}" was not found on this repository.`,
      404,
      'BRANCH_NOT_FOUND'
    )
  }
  if (branchRes.status === 403) {
    throw new AppError(
      'This repository is private or access was denied. Only public GitHub repositories are supported.',
      403,
      'PRIVATE_REPO'
    )
  }
  if (branchRes.status !== 200) {
    throw new AppError(
      `Could not verify branch "${branch}" (GitHub ${branchRes.status}).`,
      502,
      'GITHUB_API_ERROR'
    )
  }
}

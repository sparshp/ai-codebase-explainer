import axios from 'axios'
import { config } from '@config/index'
import { filterFiles, RawFile } from './github.filter'
import { logger } from '@utils/logger'
import { sleep } from '@utils/sleep'
import { AppError } from '@utils/errors'
import { decodeGitHubBlobContent } from '@utils/text'

interface GitHubTreeItem {
  path:  string
  type:  string
  sha:   string
  size?: number
  url:   string
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) throw new AppError(`Invalid GitHub URL: ${url}`, 400)
  return { owner: match[1], repo: match[2] }
}

export async function fetchRepoFiles(
  repoUrl: string,
  branch: string = 'main'
): Promise<RawFile[]> {
  const { owner, repo } = parseGitHubUrl(repoUrl)
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (config.githubToken) {
    headers['Authorization'] = `token ${config.githubToken}`
  }

  logger.info({ owner, repo, branch }, 'Fetching repo tree')

  // Get file tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  let treeRes
  try {
    treeRes = await axios.get(treeUrl, { headers })
  } catch (err: any) {
    if (err?.response?.status === 404) {
      // try 'master' if 'main' not found
      if (branch === 'main') return fetchRepoFiles(repoUrl, 'master')
      throw new AppError(`Repo not found or branch '${branch}' does not exist`, 404)
    }
    throw new AppError(`GitHub API error: ${err?.message}`, 502)
  }

  const tree: GitHubTreeItem[] = treeRes.data.tree
  const blobs = tree.filter(
    item => item.type === 'blob' && item.size && item.size < 500_000
  )

  logger.info({ total: blobs.length }, 'Tree fetched, downloading blobs')

  // Download blobs sequentially in batches of 10 to avoid secondary rate limits
  const rawFiles: RawFile[] = []
  const BATCH = 10

  for (let i = 0; i < blobs.length; i += BATCH) {
    const batch = blobs.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        let blobRes
        try {
          blobRes = await axios.get(item.url, { headers })
        } catch (err: any) {
          const status = err?.response?.status
          const msg    = err?.response?.data?.message ?? err?.message ?? ''
          // GitHub rate limit is 403 (primary) or 429 (secondary)
          if (status === 403 || status === 429 || msg.toLowerCase().includes('rate limit')) {
            throw new AppError(`GitHub rate limit exceeded — wait and retry: ${msg}`, 429)
          }
          throw err
        }

        const rawContent: string | null = blobRes.data?.content ?? null
        if (rawContent === null) return null   // binary/empty blob — skip

        const content = decodeGitHubBlobContent(rawContent)
        if (content === null) return null
        return {
          path:    item.path,
          content,
          sha:     item.sha,
          size:    item.size || 0,
        } as RawFile
      })
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        const err = result.reason
        // Rate limit: stop immediately — no point hammering GitHub further
        if (err?.statusCode === 429 || err?.message?.includes('rate limit')) throw err
        logger.warn({ err: err?.message }, 'Blob download failed, skipping file')
      } else if (result.value !== null) {
        rawFiles.push(result.value!)
      }
    }

    // 500 ms between batches to stay well under GitHub's secondary rate limit
    if (i + BATCH < blobs.length) await sleep(500)
    logger.debug({ downloaded: Math.min(i + BATCH, blobs.length), total: blobs.length }, 'Progress')
  }

  const filtered = filterFiles(rawFiles)
  logger.info({ total: rawFiles.length, filtered: filtered.length }, 'Files fetched and filtered')
  return filtered
}

export interface FileDiff {
  added:    RawFile[]
  modified: RawFile[]
  deleted:  string[]    // file paths only
  unchanged: number     // count — not downloaded again
}

export async function fetchChangedFiles(
  repoUrl:  string,
  branch:   string,
  repoId:   string
): Promise<FileDiff> {
  const { owner, repo } = parseGitHubUrl(repoUrl)
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (config.githubToken) {
    headers['Authorization'] = `token ${config.githubToken}`
  }

  // Get current tree from GitHub
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  const treeRes = await axios.get(treeUrl, { headers })
  const currentTree: Array<{ path: string; sha: string; size?: number; type: string }> =
    treeRes.data.tree.filter((f: any) => f.type === 'blob')

  // Get stored SHAs from Postgres
  const { pool } = await import('@config/database')
  const stored = await pool.query(
    `SELECT DISTINCT file_path, file_sha FROM chunks WHERE repo_id = $1::uuid`,
    [repoId]
  )
  const storedMap = new Map<string, string>(
    stored.rows.map((r: any) => [r.file_path, r.file_sha])
  )

  const currentMap = new Map<string, string>(
    currentTree.map(f => [f.path, f.sha])
  )

  // Compute diff
  const addedPaths:    string[] = []
  const modifiedPaths: string[] = []
  const deletedPaths:  string[] = []
  let   unchangedCount = 0

  for (const [path, sha] of currentMap) {
    if (!storedMap.has(path)) {
      addedPaths.push(path)
    } else if (storedMap.get(path) !== sha) {
      modifiedPaths.push(path)
    } else {
      unchangedCount++
    }
  }

  for (const path of storedMap.keys()) {
    if (!currentMap.has(path)) deletedPaths.push(path)
  }

  logger.info({
    added:     addedPaths.length,
    modified:  modifiedPaths.length,
    deleted:   deletedPaths.length,
    unchanged: unchangedCount,
  }, 'File diff computed')

  // Download only added + modified blobs
  const pathsToDownload = [...addedPaths, ...modifiedPaths]
  const rawFiles: RawFile[] = []

  if (pathsToDownload.length > 0) {
    const BATCH = 20
    for (let i = 0; i < pathsToDownload.length; i += BATCH) {
      const batch = pathsToDownload.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        batch.map(async (path) => {
          const item = currentTree.find(f => f.path === path)!
          const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`
          const blobRes = await axios.get(blobUrl, { headers })
          const content = decodeGitHubBlobContent(blobRes.data.content)
          if (content === null) return null
          return { path, content, sha: item.sha, size: item.size || 0 } as RawFile
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null) rawFiles.push(r.value)
      }
      if (i + BATCH < pathsToDownload.length) await sleep(200)
    }
  }

  const filtered = filterFiles(rawFiles)

  return {
    added:     filtered.filter(f => addedPaths.includes(f.path)),
    modified:  filtered.filter(f => modifiedPaths.includes(f.path)),
    deleted:   deletedPaths,
    unchanged: unchangedCount,
  }
}


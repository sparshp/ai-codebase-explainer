import { Request, Response, NextFunction } from 'express'
import * as repoService from './repo.service'

export async function ingestRepo(req: Request, res: Response, next: NextFunction) {
  try {
    const { url, branch }  = req.body
    const userId           = req.user!.userId
    const result           = await repoService.createRepo(url, branch, userId)

    // Existing ready repo — redirect client to it directly
    if (result.isExisting) {
      return res.status(200).json({
        message:    'Repository already indexed',
        repoId:     result.repoId,
        jobId:      result.jobId,
        isExisting: true,
        status:     'ready',
      })
    }

    res.status(202).json({
      message:    'Ingestion started',
      repoId:     result.repoId,
      jobId:      result.jobId,
      isExisting: false,
    })
  } catch (err) { next(err) }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repoService.getRepoStatus(req.params.jobId))
  } catch (err) { next(err) }
}

export async function listRepos(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repoService.getUserRepos(req.user!.userId))
  } catch (err) { next(err) }
}

export async function getRepo(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repoService.getRepo(req.params.repoId, req.user!.userId))
  } catch (err) { next(err) }
}

export async function deleteRepo(req: Request, res: Response, next: NextFunction) {
  try {
    await repoService.deleteRepo(req.params.repoId, req.user!.userId)
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function getRepoHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit = '50', offset = '0' } = req.query as Record<string, string>
    const history = await repoService.getRepoHistory(
      req.params.repoId,
      req.user!.userId,
      parseInt(limit),
      parseInt(offset)
    )
    res.json(history)
  } catch (err) { next(err) }
}

export async function getUserStats(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await repoService.getUserStats(req.user!.userId))
  } catch (err) { next(err) }
}

export async function reindexRepo(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await repoService.reindexRepo(req.params.repoId, req.user!.userId)
    res.status(202).json({ message: 'Re-index started', jobId: result.jobId })
  } catch (err) { next(err) }
}

export async function getDependencies(req: Request, res: Response, next: NextFunction) {
  try {
    const { file } = req.query as { file: string }
    if (!file) return next(new Error('file query param required'))
    const { getDependencies: getDeps } = await import('@services/parser/dependency.builder')
    res.json(await getDeps(req.params.repoId, file))
  } catch (err) { next(err) }
}
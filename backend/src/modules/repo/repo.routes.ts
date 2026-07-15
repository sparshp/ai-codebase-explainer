import { Router } from 'express'
import { validate } from '@middleware/validate.middleware'
import { ingestRepoSchema } from './repo.schema'
import * as ctrl from './repo.controller'
import { authMiddleware } from '@middleware/auth.middleware'

const router = Router()
router.use(authMiddleware)
router.post('/ingest',        validate(ingestRepoSchema), ctrl.ingestRepo)
router.get('/status/:jobId',  ctrl.getStatus)
router.get('/',               ctrl.listRepos)
router.post('/:repoId/reindex', ctrl.reindexRepo)

router.post('/',                       validate(ingestRepoSchema), ctrl.ingestRepo)
router.get('/',                        ctrl.listRepos)
router.get('/stats',                   ctrl.getUserStats)
router.get('/:repoId',                 ctrl.getRepo)
router.delete('/:repoId',              ctrl.deleteRepo)
router.get('/:repoId/history',         ctrl.getRepoHistory)
router.post('/:repoId/reindex',        ctrl.reindexRepo)
router.get('/:repoId/dependencies',    ctrl.getDependencies)
router.get('/status/:jobId',           ctrl.getStatus)

export default router
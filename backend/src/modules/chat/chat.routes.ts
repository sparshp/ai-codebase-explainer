import { Router } from 'express'
import { validate } from '@middleware/validate.middleware'
import { rateLimitMiddleware } from '@middleware/ratelimit.middleware'
import { querySchema } from './chat.schema'
import { query, queryStream } from './chat.controller'

const router = Router()

// Non-streaming — Phase 1 compatible
router.post(
  '/query',
  rateLimitMiddleware(20, 60),
  validate(querySchema),
  query
)

// SSE Streaming — Phase 2
router.post(
  '/query/stream',
  rateLimitMiddleware(20, 60),
  validate(querySchema),
  queryStream
)

export default router
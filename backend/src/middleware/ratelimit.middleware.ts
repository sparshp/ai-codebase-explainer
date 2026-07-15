import { Request, Response, NextFunction } from 'express'
import { redis } from '@config/redis'
import { RateLimitError } from '@utils/errors'

export function rateLimitMiddleware(
  limit:         number,
  windowSeconds: number
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Use userId if authenticated, fallback to IP
    const identifier = req.user?.userId || req.ip || 'anonymous'
    const window     = Math.floor(Date.now() / (windowSeconds * 1000))
    const key        = `rl:${identifier}:${window}`

    try {
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, windowSeconds)

      res.setHeader('X-RateLimit-Limit',     limit)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count))
      res.setHeader('X-RateLimit-Window',    windowSeconds)

      if (count > limit) {
        return next(new RateLimitError(`Rate limit: ${limit} requests per ${windowSeconds}s`))
      }
      next()
    } catch {
      // If Redis fails, allow the request through
      next()
    }
  }
}
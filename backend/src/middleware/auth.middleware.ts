import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '@config/index'
import { UnauthorizedError } from '@utils/errors'
import { JWTPayload } from '@modules/auth/auth.types'

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'))
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JWTPayload
    req.user = payload
    next()
  } catch {
    next(new UnauthorizedError('Invalid or expired token'))
  }
}
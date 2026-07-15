import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'

export async function register(
  req: Request, res: Response, next: NextFunction
) {
  try {
    const { email, password } = req.body
    const tokens = await authService.register(email, password)
    res.status(201).json(tokens)
  } catch (err) { next(err) }
}

export async function login(
  req: Request, res: Response, next: NextFunction
) {
  try {
    const { email, password } = req.body
    const tokens = await authService.login(email, password)
    res.json(tokens)
  } catch (err) { next(err) }
}

export async function refresh(
  req: Request, res: Response, next: NextFunction
) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return next(new Error('refreshToken required'))
    }
    const tokens = await authService.refreshTokens(refreshToken)
    res.json(tokens)
  } catch (err) { next(err) }
}

export async function me(
  req: Request, res: Response, next: NextFunction
) {
  try {
    const user = await authService.getMe(req.user!.userId)
    res.json(user)
  } catch (err) { next(err) }
}

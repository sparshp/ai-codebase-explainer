import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '@config/database'
import { config } from '@config/index'
import { AppError, UnauthorizedError } from '@utils/errors'
import { AuthResult, JWTPayload } from './auth.types'

// Cost 8 is ~4x faster than 10 and still fine for this app on free-tier CPU
const BCRYPT_ROUNDS = 8

function generateTokens(userId: string, email: string) {
  const payload: JWTPayload = { userId, email }

  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry as any,
  })

  const refreshToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiry as any,
  })

  return { accessToken, refreshToken }
}

export async function register(
  email: string,
  password: string
): Promise<AuthResult> {
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  )
  if (existing.rows.length > 0) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const res = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email.toLowerCase(), passwordHash]
  )

  const user = res.rows[0]
  return {
    ...generateTokens(user.id, user.email),
    user: { id: user.id, email: user.email, created_at: user.created_at },
  }
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const res = await pool.query(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (res.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const user = res.rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)

  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  return {
    ...generateTokens(user.id, user.email),
    user: { id: user.id, email: user.email, created_at: user.created_at },
  }
}

export async function refreshTokens(token: string) {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JWTPayload
    return generateTokens(payload.userId, payload.email)
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token')
  }
}

export async function getMe(userId: string) {
  const res = await pool.query(
    'SELECT id, email, created_at FROM users WHERE id = $1::uuid',
    [userId]
  )
  if (res.rows.length === 0) throw new UnauthorizedError('User not found')
  return res.rows[0]
}

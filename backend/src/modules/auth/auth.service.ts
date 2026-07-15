import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '@config/database'
import { config } from '@config/index'
import { AppError, UnauthorizedError } from '@utils/errors'
import { AuthTokens, JWTPayload } from './auth.types'

function generateTokens(userId: string, email: string): AuthTokens {
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
): Promise<AuthTokens> {
  // Check if email already exists
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  )
  if (existing.rows.length > 0) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS')
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Insert user
  const res = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email`,
    [email.toLowerCase(), passwordHash]
  )

  const user = res.rows[0]
  return generateTokens(user.id, user.email)
}

export async function login(
  email: string,
  password: string
): Promise<AuthTokens> {
  const res = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
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

  return generateTokens(user.id, user.email)
}

export async function refreshTokens(token: string): Promise<AuthTokens> {
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

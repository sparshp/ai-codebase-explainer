import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import repoRoutes   from '@modules/repo/repo.routes'
import chatRoutes   from '@modules/chat/chat.routes'
import authRoutes   from '@modules/auth/auth.routes'
import healthRoutes from '@modules/health/health.routes'
import { errorMiddleware } from '@middleware/error.middleware'
import { corsOrigins } from '@config/index'

export function createApp() {
  const app = express()

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({
    origin:      corsOrigins(),
    credentials: true,
  }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/health', healthRoutes)
  app.use('/auth',   authRoutes)
  app.use('/repos',  repoRoutes)
  app.use('/chat',   chatRoutes)

  app.use(errorMiddleware)

  return app
}

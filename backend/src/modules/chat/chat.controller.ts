import { Request, Response, NextFunction } from 'express'
import { queryRepo, queryRepoStream } from './chat.service'
import { corsOrigins } from '@config/index'

// Non-streaming (backward compatible)
export async function query(
  req: Request, res: Response, next: NextFunction
) {
  try {
    const { question, repoId, conversationId, intent } = req.body
    const result = await queryRepo(question, repoId, conversationId, intent)
    res.json(result)
  } catch (err) { next(err) }
}

// SSE Streaming
export async function queryStream(
  req: Request, res: Response, next: NextFunction
) {
  const { question, repoId, conversationId, intent } = req.body

  // Set SSE headers
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  const origin = req.headers.origin
  if (origin && corsOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.flushHeaders()

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  let generatorDone = false

  // Handle client disconnect
  req.on('close', () => {
    generatorDone = true
  })

  try {
    for await (const event of queryRepoStream(question, repoId, conversationId, intent)) {
      if (generatorDone) break
      send(event)
    }
  } catch (err: any) {
    send({ type: 'error', message: err.message })
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

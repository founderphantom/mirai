/**
 * Multi-Tenant Voice Agent Server for Cloudflare Containers
 *
 * This server implements multi-tenant architecture where:
 * - One container instance serves 100+ concurrent users
 * - Character-based pooling: Multiple users share one Inworld app per character
 * - Automatic session management and cleanup
 * - Integrated with API Gateway authentication
 */

import 'dotenv/config'

import { InworldError } from '@inworld/runtime/common'
import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { parse } from 'url'
import { RawData, WebSocketServer } from 'ws'

import { WS_APP_PORT } from './constants'
import { CharacterPoolManager } from './middleware/CharacterPoolManager'
import { MessageHandler } from './components/message_handler'
import type { Agent } from './types'

const app = express()
const server = createServer(app)
const webSocket = new WebSocketServer({ noServer: true })

// Get character pool manager singleton
const characterPool = CharacterPoolManager.getInstance()

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())

// Health check endpoint for Cloudflare Container
app.get('/health', (req, res) => {
  const metrics = characterPool.getMetrics()

  const healthcheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalCharacters: metrics.totalCharacters,
      totalSessions: metrics.totalSessions,
      utilizationPercent: metrics.utilizationPercent,
    },
  }

  try {
    res.status(200).json(healthcheck)
  } catch (error) {
    healthcheck.status = 'unhealthy'
    res.status(503).json(healthcheck)
  }
})

// Readiness probe endpoint
app.get('/ready', (req, res) => {
  const metrics = characterPool.getMetrics()

  // Container is ready if below 90% capacity
  const isReady = metrics.utilizationPercent < 90

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    utilizationPercent: metrics.utilizationPercent,
    totalSessions: metrics.totalSessions,
    maxSessions: 100,
  })
})

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const poolMetrics = characterPool.getMetrics()

  res.status(200).json({
    // Character pool metrics
    pool: poolMetrics,

    // Combined summary
    timestamp: new Date().toISOString(),
  })
})

// Session metrics endpoint - Removed (metrics tracker disabled for performance)
app.get('/metrics/session/:sessionKey', (req, res) => {
  const { sessionKey } = req.params

  if (!sessionKey) {
    return res.status(400).json({ error: 'Missing session key' })
  }

  res.status(200).json({
    sessionKey,
    message: 'Session metrics tracking disabled for performance optimization',
  })
})

// WebSocket connection handler with multi-tenant support
webSocket.on('connection', (ws, request) => {
  const { query } = parse(request.url!, true)

  // Extract session data from headers (passed from API Gateway)
  const userId = request.headers['x-user-id'] as string
  const characterId = request.headers['x-character-id'] as string
  const sessionKey = request.headers['x-session-key'] as string
  const conversationId = request.headers['x-conversation-id'] as string

  if (!userId || !characterId || !sessionKey) {
    ws.close(4000, 'Missing required headers')
    return
  }

  // Get or create character instance
  let inworldApp
  try {
    inworldApp = characterPool.getCharacter(characterId)

    if (!inworldApp) {
      ws.close(4001, 'Character not loaded. Call /load first.')
      return
    }

    // Register session in character pool
    characterPool.addSession(characterId, {
      sessionKey,
      userId,
      conversationId,
      websocket: ws,
      createdAt: Date.now(),
    })

  } catch (error) {
    console.error('[WebSocket] Error setting up session:', error)
    ws.close(4002, error instanceof Error ? error.message : 'Failed to setup session')
    return
  }

  // Get connection state for this session
  const key = sessionKey
  if (!inworldApp.connections?.[key]) {
    ws.close(4003, 'Session not found')
    return
  }

  inworldApp.connections[key].ws = ws

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error)
  })

  const messageHandler = new MessageHandler(inworldApp, (data: any) => {
    try {
      ws.send(JSON.stringify(data))
    } catch (error) {
      console.error(`[WebSocket] Failed to send message for session ${sessionKey}:`, error)
    }
  })

  ws.on('message', (data: RawData) => {
    try {
      messageHandler.handleMessage(data, key)
    } catch (error) {
      console.error('[WebSocket] Message handling error:', error)
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Failed to process message',
        }),
      )
    }
  })

  ws.on('close', () => {
    console.log(`[WebSocket] 🔌 Connection closed for session ${sessionKey}`)

    // Clean up connection first
    if (inworldApp.connections[key]) {
      delete inworldApp.connections[key]
    }
    characterPool.removeSession(characterId, sessionKey)
  })
})

// Load agent endpoint - Creates or reuses character instance
app.post('/load', async (req, res) => {
  try {
    const { query } = parse(req.url!, true)
    const sessionKey = query.key?.toString()

    if (!sessionKey) {
      return res.status(400).json({ error: 'Missing session key' })
    }

    const { agent, userName } = req.body as { agent: Agent; userName: string }

    if (!agent || !userName) {
      return res.status(400).json({ error: 'Missing agent or userName' })
    }

    // Extract headers from API Gateway
    const characterId = req.headers['x-character-id'] as string
    const inworldCharacterId = req.headers['x-inworld-character-id'] as string
    const inworldApiKey = req.headers['x-inworld-api-key'] as string

    if (!characterId || !inworldCharacterId || !inworldApiKey) {
      return res.status(400).json({ error: 'Missing required headers' })
    }

    // Parse voice config from request body if provided
    const voiceConfig = req.body.voiceConfig as {
      voiceId?: string
      llmModelName?: string
      llmProvider?: string
      ttsModelId?: string
    } | undefined

    // Get or create character instance (multi-tenant)
    const inworldApp = await characterPool.getOrCreateCharacter(characterId, inworldCharacterId, {
      agent,
      userName,
      apiKey: inworldApiKey,
      voiceConfig,
    })

    // Initialize connection state for this session
    if (!inworldApp.connections) {
      inworldApp.connections = {}
    }

    inworldApp.connections[sessionKey] = {
      state: {
        agent,
        userName,
        messages: [],
      },
      ws: null, // Will be set when WebSocket connects
    }

    // Load the agent (this creates the system message)
    await inworldApp.load(req, res)
  } catch (error) {
    console.error('[Load] Error:', error instanceof Error ? error.message : error)

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to load agent',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
})

// Unload agent endpoint - Removes session but keeps character if other sessions exist
app.post('/unload', async (req, res) => {
  try {
    const { query } = parse(req.url!, true)
    const sessionKey = query.key?.toString()

    if (!sessionKey) {
      return res.status(400).json({ error: 'Missing session key' })
    }

    const characterId = req.headers['x-character-id'] as string

    if (!characterId) {
      return res.status(400).json({ error: 'Missing character header' })
    }

    const inworldApp = characterPool.getCharacter(characterId)

    if (!inworldApp) {
      return res.status(404).json({ error: 'Character not found' })
    }

    // Remove session
    if (inworldApp.connections[sessionKey]) {
      delete inworldApp.connections[sessionKey]
    }

    characterPool.removeSession(characterId, sessionKey)

    res.status(200).json({
      success: true,
      sessionKey,
      message: 'Session unloaded successfully',
    })
  } catch (error) {
    console.error('[Unload] Error unloading session:', error)
    res.status(500).json({
      error: 'Failed to unload session',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// WebSocket upgrade handler
server.on('upgrade', async (request, socket, head) => {
  const { pathname } = parse(request.url!)

  if (pathname === '/session') {
    try {
      webSocket.handleUpgrade(request, socket, head, (ws) => {
        webSocket.emit('connection', ws, request)
      })
    } catch (error) {
      console.error('[Upgrade] WebSocket upgrade error:', error)
      socket.destroy()
    }
  } else {
    socket.destroy()
  }
})

// Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('[Express] Error:', error)

    if (error instanceof InworldError) {
      res.status(500).json({
        error: 'Inworld Error',
        message: error.message,
        context: error.context,
      })
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      })
    }
  },
)

// Start server
try {
  server.listen(WS_APP_PORT, async () => {
    console.log(`Multi-Tenant Voice Agent Server started on port ${WS_APP_PORT}`)
  })

  server.on('error', (error) => {
    console.error('Server startup error:', error)
    process.exit(1)
  })
} catch (error) {
  console.error('Fatal startup error:', error)
  process.exit(1)
}

// Graceful shutdown handler
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`)

  server.close(() => {
    console.log('HTTP server closed')
  })

  // Close all WebSocket connections
  webSocket.clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.close(1000, 'Server shutting down')
    }
  })

  // Shutdown character pool
  characterPool
    .shutdown()
    .then(() => {
      console.log('Shutdown complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Shutdown error:', error)
      process.exit(1)
    })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Signal handlers
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGUSR2', () => shutdown('SIGUSR2'))

// Unhandled rejection handler
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled rejection:', err)
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1)
  }
})

// Uncaught exception handler
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

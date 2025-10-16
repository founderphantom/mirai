/**
 * Multi-Tenant Voice Agent Server for Cloudflare Containers
 *
 * This server implements multi-tenant architecture where:
 * - One container instance serves 100+ concurrent users
 * - Character-based pooling: Multiple users share one Inworld app per character
 * - Automatic session management and cleanup
 * - Integrated with API Gateway authentication
 */

console.log('[Startup] Loading dependencies...')

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
import { getMetricsTracker } from './components/metrics_tracker'
import type { Agent } from './types'

console.log('[Startup] Dependencies loaded successfully')

console.log('[Startup] Creating Express app...')
const app = express()
const server = createServer(app)
const webSocket = new WebSocketServer({ noServer: true })

// Debug: Check if models directory exists
import * as fs from 'fs'
import * as path from 'path'

const modelsPath = '/app/models'
console.log('[Startup] Checking models directory:', modelsPath)
if (fs.existsSync(modelsPath)) {
  const files = fs.readdirSync(modelsPath)
  console.log('[Startup] Models directory contents:', files)
  const vadModelPath = path.join(modelsPath, 'silero_vad.onnx')
  if (fs.existsSync(vadModelPath)) {
    const stats = fs.statSync(vadModelPath)
    console.log('[Startup] VAD model file found:', vadModelPath, 'size:', stats.size, 'bytes')
  } else {
    console.error('[Startup] VAD model file NOT FOUND:', vadModelPath)
  }
} else {
  console.error('[Startup] Models directory does NOT exist:', modelsPath)
}

console.log('[Startup] Initializing CharacterPoolManager...')
// Get character pool manager singleton
const characterPool = CharacterPoolManager.getInstance()
console.log('[Startup] CharacterPoolManager initialized')

console.log('[Startup] Initializing MetricsTracker...')
// Get metrics tracker singleton
const metricsTracker = getMetricsTracker()
console.log('[Startup] MetricsTracker initialized')

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
  const streamingMetrics = metricsTracker.getAggregateMetrics()

  res.status(200).json({
    // Character pool metrics
    pool: poolMetrics,

    // Streaming response metrics
    streaming: {
      totalSessions: streamingMetrics.totalSessions,
      totalInteractions: streamingMetrics.totalInteractions,
      avgTTFA: streamingMetrics.avgTTFA ? `${streamingMetrics.avgTTFA.toFixed(0)}ms` : 'N/A',
      avgChunkLatency: streamingMetrics.avgChunkLatency ? `${streamingMetrics.avgChunkLatency.toFixed(0)}ms` : 'N/A',
      avgInteractionDuration: streamingMetrics.avgInteractionDuration ? `${streamingMetrics.avgInteractionDuration.toFixed(0)}ms` : 'N/A',
      sttAccuracy: `${streamingMetrics.overallSTTAccuracy.toFixed(1)}%`,
    },

    // Combined summary
    timestamp: new Date().toISOString(),
  })
})

// Session metrics endpoint - Get detailed metrics for a specific session
app.get('/metrics/session/:sessionKey', (req, res) => {
  const { sessionKey } = req.params

  if (!sessionKey) {
    return res.status(400).json({ error: 'Missing session key' })
  }

  const sessionMetrics = metricsTracker.getSessionMetrics(sessionKey)

  if (!sessionMetrics) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.status(200).json({
    sessionKey: sessionMetrics.sessionKey,
    startTime: new Date(sessionMetrics.startTime).toISOString(),
    endTime: sessionMetrics.endTime ? new Date(sessionMetrics.endTime).toISOString() : null,
    totalInteractions: sessionMetrics.totalInteractions,
    successfulInteractions: sessionMetrics.successfulInteractions,
    failedInteractions: sessionMetrics.failedInteractions,
    avgTTFA: sessionMetrics.avgTTFA ? `${sessionMetrics.avgTTFA.toFixed(0)}ms` : 'N/A',
    avgChunkLatency: sessionMetrics.avgChunkLatency ? `${sessionMetrics.avgChunkLatency.toFixed(0)}ms` : 'N/A',
    avgInteractionDuration: sessionMetrics.avgInteractionDuration ? `${sessionMetrics.avgInteractionDuration.toFixed(0)}ms` : 'N/A',
    sttAccuracy: `${sessionMetrics.sttAccuracy.toFixed(1)}%`,
    recentInteractions: sessionMetrics.interactions.slice(-10).map(i => ({
      interactionId: i.interactionId,
      ttfa: i.ttfa ? `${i.ttfa}ms` : 'N/A',
      totalDuration: i.totalDuration ? `${i.totalDuration}ms` : 'N/A',
      audioChunks: i.audioChunks.length,
      sttSuccess: i.sttSuccess,
      sttText: i.sttText?.substring(0, 100), // First 100 chars
    })),
  })
})

// WebSocket connection handler with multi-tenant support
webSocket.on('connection', (ws, request) => {
  const { query } = parse(request.url!, true)

  // Extract session data from headers (passed from API Gateway)
  const userId = request.headers['x-user-id'] as string
  const characterId = request.headers['x-character-id'] as string
  const inworldCharacterId = request.headers['x-inworld-character-id'] as string
  const sessionKey = request.headers['x-session-key'] as string
  const conversationId = request.headers['x-conversation-id'] as string

  if (!userId || !characterId || !sessionKey) {
    console.error('[WebSocket] Missing required headers')
    ws.close(4000, 'Missing required headers')
    return
  }

  console.log(`[WebSocket] New connection - Session: ${sessionKey}, User: ${userId}, Character: ${characterId}`)

  // Get or create character instance
  let inworldApp
  try {
    inworldApp = characterPool.getCharacter(characterId)

    if (!inworldApp) {
      console.log(`[WebSocket] Character ${characterId} not loaded yet, checking connections`)
      // Character not in pool, need to load it first
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
    console.error('[WebSocket] Session not found in connections')
    ws.close(4003, 'Session not found')
    return
  }

  inworldApp.connections[key].ws = ws

  ws.on('error', (error) => {
    console.error(`[WebSocket] Error for session ${sessionKey}:`, error)
  })

  const messageHandler = new MessageHandler(inworldApp, (data: any) => {
    try {
      ws.send(JSON.stringify(data))
    } catch (error) {
      console.error(`[WebSocket] Failed to send message for session ${sessionKey}:`, error)
    }
  })

  // Initialize metrics tracking for this session
  messageHandler.initSession(sessionKey)

  // Start VAD calibration immediately when WebSocket connects
  console.log(`[WebSocket] Starting VAD calibration for session ${sessionKey}`)
  messageHandler.startCalibration()

  ws.on('message', (data: RawData) => {
    try {
      messageHandler.handleMessage(data, key)
    } catch (error) {
      console.error(`[WebSocket] Failed to handle message for session ${sessionKey}:`, error)
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Failed to process message',
        }),
      )
    }
  })

  ws.on('close', () => {
    console.log(`[WebSocket] Disconnected - Session: ${sessionKey}`)

    // End metrics tracking for this session
    metricsTracker.endSession(sessionKey)

    // Remove session from character pool
    characterPool.removeSession(characterId, sessionKey)

    // Clean up connection
    if (inworldApp.connections[key]) {
      delete inworldApp.connections[key]
    }
  })
})

// Load agent endpoint - Creates or reuses character instance
app.post('/load', async (req, res) => {
  const loadStartTime = Date.now()
  try {
    const { query } = parse(req.url!, true)
    const sessionKey = query.key?.toString()

    console.log(`[Load] Request received - sessionKey: ${sessionKey}`)

    if (!sessionKey) {
      console.error('[Load] Missing session key')
      return res.status(400).json({ error: 'Missing session key' })
    }

    const { agent, userName } = req.body as { agent: Agent; userName: string }

    if (!agent || !userName) {
      console.error('[Load] Missing agent or userName in request body')
      return res.status(400).json({ error: 'Missing agent or userName' })
    }

    // Extract headers from API Gateway
    const characterId = req.headers['x-character-id'] as string
    const inworldCharacterId = req.headers['x-inworld-character-id'] as string
    const inworldApiKey = req.headers['x-inworld-api-key'] as string

    if (!characterId || !inworldCharacterId || !inworldApiKey) {
      console.error('[Load] Missing required headers:', {
        hasCharacterId: !!characterId,
        hasInworldCharacterId: !!inworldCharacterId,
        hasInworldApiKey: !!inworldApiKey,
      })
      return res.status(400).json({ error: 'Missing required headers' })
    }

    console.log(`[Load] Starting character load - characterId: ${characterId}, sessionKey: ${sessionKey}`)

    // Parse voice config from request body if provided
    const voiceConfig = req.body.voiceConfig as {
      voiceId?: string
      llmModelName?: string
      llmProvider?: string
      ttsModelId?: string
    } | undefined

    // Get or create character instance (multi-tenant)
    // This will initialize the Inworld app if it's a new character
    console.log(`[Load] Calling characterPool.getOrCreateCharacter - elapsed: ${Date.now() - loadStartTime}ms`)
    const inworldApp = await characterPool.getOrCreateCharacter(characterId, inworldCharacterId, {
      agent,
      userName,
      apiKey: inworldApiKey,
      voiceConfig,
    })
    console.log(`[Load] Character obtained from pool - elapsed: ${Date.now() - loadStartTime}ms`)

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
    // Note: inworldApp.load() calls res.end() internally, so we don't send another response
    console.log(`[Load] Calling inworldApp.load() - elapsed: ${Date.now() - loadStartTime}ms`)
    await inworldApp.load(req, res)

    const totalDuration = Date.now() - loadStartTime
    console.log(`[Load] SUCCESS - Character ${characterId} loaded for session ${sessionKey} - total duration: ${totalDuration}ms`)
  } catch (error) {
    // Enhanced error logging for debugging
    const { query } = parse(req.url!, true)
    const sessionKeyFromQuery = query.key?.toString()
    const characterIdFromHeader = req.headers['x-character-id'] as string | undefined

    console.error('[Load] Error loading agent:', {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      sessionKey: sessionKeyFromQuery,
      characterId: characterIdFromHeader,
    })

    // Only send error response if headers haven't been sent yet
    // (inworldApp.load() may have already sent a response)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to load agent',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : JSON.stringify(error),
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

    console.log(`[Unload] Unloading session ${sessionKey} for character ${characterId}`)

    const inworldApp = characterPool.getCharacter(characterId)

    if (!inworldApp) {
      return res.status(404).json({ error: 'Character not found' })
    }

    // Remove session
    if (inworldApp.connections[sessionKey]) {
      delete inworldApp.connections[sessionKey]
    }

    characterPool.removeSession(characterId, sessionKey)

    console.log(`[Unload] Session ${sessionKey} unloaded`)

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

// Periodic cleanup for metrics tracker (every 30 minutes)
setInterval(() => {
  console.log('[Cleanup] Running periodic metrics cleanup...')
  metricsTracker.cleanup(100) // Keep last 100 sessions
  console.log('[Cleanup] Metrics cleanup completed')
}, 30 * 60 * 1000) // 30 minutes

// Start server
console.log(`[Startup] Starting server on port ${WS_APP_PORT}...`)

try {
  server.listen(WS_APP_PORT, async () => {
    console.log(`[Startup] ✓ Multi-Tenant Voice Agent Server STARTED`)
    console.log(`[Startup] ✓ Port: ${WS_APP_PORT}`)
    console.log(`[Startup] ✓ Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`[Startup] ✓ Max Sessions: 100`)
    console.log(`[Startup] ✓ WebSocket endpoint: ws://localhost:${WS_APP_PORT}/session`)
    console.log(`[Startup] ✓ Metrics tracking enabled`)
  })

  server.on('error', (error) => {
    console.error('[Startup] Server startup error:', error)
    console.error('[Startup] Error stack:', error.stack)
    process.exit(1)
  })
} catch (error) {
  console.error('[Startup] Fatal error during server startup:', error)
  console.error('[Startup] Error type:', typeof error)
  console.error('[Startup] Error message:', error instanceof Error ? error.message : String(error))
  console.error('[Startup] Error stack:', error instanceof Error ? error.stack : undefined)
  process.exit(1)
}

// Graceful shutdown handler
function shutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`)

  // Stop accepting new connections
  server.close(() => {
    console.log('[Shutdown] HTTP server closed')
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
      console.log('[Shutdown] Character pool shutdown complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Shutdown] Error during shutdown:', error)
      process.exit(1)
    })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[Shutdown] Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Signal handlers
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGUSR2', () => shutdown('SIGUSR2'))

// Unhandled rejection handler
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('[UnhandledRejection] Inworld Error:', {
      message: err.message,
      context: err.context,
    })
  } else {
    console.error('[UnhandledRejection]:', err)
  }

  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1)
  }
})

// Uncaught exception handler
process.on('uncaughtException', (err: Error) => {
  console.error('[UncaughtException]:', err)
  process.exit(1)
})

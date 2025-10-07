/**
 * Enhanced Voice Agent Server for Cloudflare Containers
 *
 * This is an enhanced version of the voice agent server that includes:
 * - Health check endpoint
 * - Better error handling
 * - Graceful shutdown
 * - Container-specific optimizations
 * - Database integration ready
 */

import 'dotenv/config'

import { InworldError } from '@inworld/runtime/common'
import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { parse } from 'url'
import { RawData, WebSocketServer } from 'ws'

const { query } = require('express-validator')

import { body } from 'express-validator'

import { WS_APP_PORT } from '../constants'
import { InworldApp } from './components/app'
import { MessageHandler } from './components/message_handler'

const app = express()
const server = createServer(app)
const webSocket = new WebSocketServer({ noServer: true })

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(express.static('frontend'))

const inworldApp = new InworldApp()

// Health check endpoint for Cloudflare Container
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    inworldStatus: inworldApp.isInitialized ? 'ready' : 'initializing',
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
  if (inworldApp.isInitialized) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    })
  }
})

// Metrics endpoint (optional, for monitoring)
app.get('/metrics', (req, res) => {
  const metrics = {
    activeConnections: Object.keys(inworldApp.connections || {}).length,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  }

  res.status(200).json(metrics)
})

// WebSocket connection handler
webSocket.on('connection', (ws, request) => {
  const { query } = parse(request.url!, true)
  const key = query.key?.toString()

  if (!key) {
    ws.close(4000, 'Session key required')
    return
  }

  if (!inworldApp.connections?.[key]) {
    ws.close(4001, 'Session not found')
    return
  }

  inworldApp.connections[key].ws = inworldApp.connections[key].ws ?? ws

  console.log(`WebSocket connected for session: ${key}`)

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${key}:`, error)
  })

  const messageHandler = new MessageHandler(inworldApp, (data: any) => {
    try {
      ws.send(JSON.stringify(data))
    } catch (error) {
      console.error(`Failed to send message for session ${key}:`, error)
    }
  })

  ws.on('message', (data: RawData) => {
    try {
      messageHandler.handleMessage(data, key)
    } catch (error) {
      console.error(`Failed to handle message for session ${key}:`, error)
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Failed to process message',
      }))
    }
  })

  ws.on('close', () => {
    console.log(`WebSocket disconnected for session: ${key}`)
    if (inworldApp.connections[key]) {
      delete inworldApp.connections[key]
    }
  })
})

// Load agent endpoint
app.post(
  '/load',
  query('key').trim().isLength({ min: 1 }),
  body('agent').isObject(),
  body('userName').trim().isLength({ min: 1 }),
  async (req, res, next) => {
    try {
      await inworldApp.load(req, res, next)
    } catch (error) {
      console.error('Load agent error:', error)
      res.status(500).json({
        error: 'Failed to load agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
)

// Unload agent endpoint
app.post(
  '/unload',
  query('key').trim().isLength({ min: 1 }),
  async (req, res, next) => {
    try {
      await inworldApp.unload(req, res, next)
    } catch (error) {
      console.error('Unload agent error:', error)
      res.status(500).json({
        error: 'Failed to unload agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
)

// WebSocket upgrade handler
server.on('upgrade', async (request, socket, head) => {
  const { pathname } = parse(request.url!)

  if (pathname === '/session') {
    try {
      webSocket.handleUpgrade(request, socket, head, (ws) => {
        webSocket.emit('connection', ws, request)
      })
    } catch (error) {
      console.error('WebSocket upgrade error:', error)
      socket.destroy()
    }
  } else {
    socket.destroy()
  }
})

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', error)

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
})

// Start server
server.listen(WS_APP_PORT, async () => {
  try {
    await inworldApp.initialize()
    console.log(`✓ Inworld App initialized`)
    console.log(`✓ Server running on port ${WS_APP_PORT}`)
    console.log(`✓ WebSocket available at ws://localhost:${WS_APP_PORT}/session?key=<session_key>`)
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`)
  } catch (error) {
    console.error('Failed to initialize server:', error)
    process.exit(1)
  }
})

// Graceful shutdown handler
function done(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`)

  // Close WebSocket connections
  webSocket.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.close(1000, 'Server shutting down')
    }
  })

  // Shutdown Inworld app
  inworldApp.shutdown()

  // Close server
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Signal handlers
process.on('SIGINT', () => done('SIGINT'))
process.on('SIGTERM', () => done('SIGTERM'))
process.on('SIGUSR2', () => done('SIGUSR2'))

// Unhandled rejection handler
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error (unhandled): ', {
      message: err.message,
      context: err.context,
    })
  } else {
    console.error('Unhandled rejection:', err)
  }

  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1)
  }
})

// Uncaught exception handler
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught exception:', err)

  // Exit on uncaught exceptions
  process.exit(1)
})

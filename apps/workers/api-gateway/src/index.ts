/**
 * API Gateway for Mirai MVP
 *
 * Cloudflare Worker that serves as the central API gateway for:
 * - Better-Auth authentication
 * - Character management
 * - Voice session handling
 * - Asset management
 * - Polar payment webhooks
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv } from './types/env'
import { createAuth } from './lib/auth'
import { authMiddleware, errorHandler, logger } from './lib/middleware'

// Import routes
import characterRoutes from './routes/characters'
import voiceRoutes from './routes/voice'
import assetRoutes from './routes/assets'
import webhookRoutes from './routes/webhooks'

// Export Durable Objects
export { VoiceSession } from './services/voice'

// Create Hono app
const app = new Hono<HonoEnv>()

// Global middleware
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://app.miraichat.ai'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.use('*', logger)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  })
})

// Better-Auth routes - mounted at /api/auth/*
app.all('/api/auth/*', async (c) => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

// Protected API routes - require authentication
app.route('/api/characters', characterRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/assets', assetRoutes)

// Apply auth middleware to all /api/* routes except /api/auth/* and /api/webhooks/*
app.use('/api/*', async (c, next) => {
  const path = c.req.path

  // Skip auth for auth routes and webhooks
  if (path.startsWith('/api/auth/') || path.startsWith('/api/webhooks/')) {
    return next()
  }

  const auth = createAuth(c.env)
  return authMiddleware(auth)(c, next)
})

// Webhook routes - no auth required (signature verification instead)
app.route('/api/webhooks', webhookRoutes)

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
    },
    404,
  )
})

// Error handler
app.onError(errorHandler)

// Export worker
export default {
  fetch: app.fetch,
}

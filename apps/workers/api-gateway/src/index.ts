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
import audioStreamRoutes from './routes/audio-stream'
import assetRoutes from './routes/assets'
import webhookRoutes from './routes/webhooks'
import adminRoutes from './routes/admin'
import paymentRoutes from './routes/payments'

// Export Durable Objects
export { VoiceSession } from './services/voice'

// Create Hono app
const app = new Hono<HonoEnv>()

// Global middleware
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://miraichat.app',
    'https://www.miraichat.app',
    'https://mirai-stage-web.founder-968.workers.dev',
    'https://mirai-api-gateway.founder-968.workers.dev',
  ],
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

// Apply auth middleware to all /api/* routes except /api/auth/*, /api/webhooks/*, /api/voice/ws, /api/assets/public/*, and /admin/*
// IMPORTANT: Must be defined BEFORE routes to protect them
app.use('/api/*', async (c, next) => {
  const path = c.req.path

  // Skip auth for:
  // - /api/auth/* - Better-Auth handles its own auth
  // - /api/webhooks/* - Uses signature verification
  // - /api/voice/ws - Uses sessionKey from KV cache
  // - /api/audio/stream - Uses sessionKey from KV cache (new Workers AI audio streaming)
  // - /api/assets/public/* - Public assets (preset character thumbnails, etc.)
  // - /api/characters/presets - Public preset characters list
  // - /admin/* - Uses admin secret verification (handled in admin routes)
  if (
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/webhooks/') ||
    path === '/api/voice/ws' ||
    path === '/api/audio/stream' ||
    path.startsWith('/api/assets/public/') ||
    path === '/api/characters/presets' ||
    path.startsWith('/admin/')
  ) {
    return next()
  }

  const auth = createAuth(c.env)
  return authMiddleware(auth)(c, next)
})

// Protected API routes - require authentication
app.route('/api/characters', characterRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/audio', audioStreamRoutes)
app.route('/api/assets', assetRoutes)
app.route('/api/payments', paymentRoutes)

// Webhook routes - no auth required (signature verification instead)
app.route('/api/webhooks', webhookRoutes)

// Admin routes - require admin secret
app.route('/admin', adminRoutes)

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

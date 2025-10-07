/**
 * Cloudflare Worker for Voice Agent Container
 *
 * Routes WebSocket and HTTP requests to the Voice Agent container
 * Handles authentication, session management, and request proxying
 */

import { Container, getContainer } from '@cloudflare/containers'

/**
 * Voice Agent Container class
 * Configures container behavior for Cloudflare Containers
 */
export class VoiceAgentContainer extends Container {
  defaultPort = 4000 // Container listening port
  sleepAfter = '5m' // Scale to zero after 5 minutes of inactivity
  maxInstances = 10 // Maximum concurrent instances
}

/**
 * Environment bindings interface
 */
export interface Env {
  VOICE_AGENT: Container
  DB: D1Database
  VOICE_SESSION: DurableObjectNamespace
  SESSION_CACHE: KVNamespace
  AUDIO_STORAGE: R2Bucket
  ANALYTICS: AnalyticsEngineDataset

  // Secrets (set via wrangler secret)
  INWORLD_API_KEY: string
  JWT_SECRET: string

  // Environment variables
  NODE_ENV: string
  WS_APP_PORT: string
  LOG_LEVEL: string
}

/**
 * Main Worker fetch handler
 * Routes requests to appropriate handlers
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Health check endpoint (bypass container)
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV,
        }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // WebSocket upgrade requests
      if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocketRequest(request, env)
      }

      // HTTP requests (load/unload agent, etc.)
      if (path.startsWith('/api/voice-agent/')) {
        return handleAPIRequest(request, env)
      }

      // Proxy all other requests to container
      const container = getContainer(env.VOICE_AGENT)
      return container.fetch(request)
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}

/**
 * Handle WebSocket connections
 * Validates session and routes to container
 */
async function handleWebSocketRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key) {
    return new Response('Session key required', { status: 400 })
  }

  // Validate session exists in cache
  const sessionData = await env.SESSION_CACHE.get(`session:${key}`, 'json')

  if (!sessionData) {
    return new Response('Invalid or expired session', { status: 401 })
  }

  // Track WebSocket connection in analytics
  env.ANALYTICS?.writeDataPoint({
    blobs: ['websocket_connection'],
    doubles: [1],
    indexes: [`session:${key}`],
  })

  // Forward WebSocket upgrade to container
  const container = getContainer(env.VOICE_AGENT)
  return container.fetch(request)
}

/**
 * Handle API requests
 * Manages agent loading, session creation, etc.
 */
async function handleAPIRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // Authenticate request
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const token = authHeader.substring(7)
  const userId = await verifyToken(token, env.JWT_SECRET)

  if (!userId) {
    return new Response('Invalid token', { status: 401 })
  }

  // Route to appropriate handler
  if (path === '/api/voice-agent/create-session' && request.method === 'POST') {
    return createSession(request, env, userId)
  }

  if (path === '/api/voice-agent/end-session' && request.method === 'POST') {
    return endSession(request, env, userId)
  }

  // Forward other API requests to container
  const container = getContainer(env.VOICE_AGENT)
  return container.fetch(request)
}

/**
 * Create a new voice agent session
 */
async function createSession(request: Request, env: Env, userId: string): Promise<Response> {
  try {
    const body = await request.json() as {
      characterId: string
      agentConfig: {
        name: string
        description: string
        motivation: string
      }
    }

    // Generate session key
    const sessionKey = crypto.randomUUID()

    // Get character from database
    const character = await env.DB.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).bind(body.characterId, userId).first()

    if (!character) {
      return new Response('Character not found', { status: 404 })
    }

    // Create conversation record
    const conversationId = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO conversations (id, user_id, character_id, started_at)
      VALUES (?, ?, ?, ?)
    `).bind(conversationId, userId, body.characterId, Date.now()).run()

    // Create voice session record
    const sessionId = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO voice_sessions (id, conversation_id, user_id, character_id, status, started_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).bind(sessionId, conversationId, userId, body.characterId, Date.now()).run()

    // Store session in KV cache
    const sessionData = {
      sessionId,
      conversationId,
      userId,
      characterId: body.characterId,
      agentConfig: body.agentConfig,
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes TTL
    }

    await env.SESSION_CACHE.put(
      `session:${sessionKey}`,
      JSON.stringify(sessionData),
      { expirationTtl: 300 } // 5 minutes
    )

    // Track session creation in analytics
    env.ANALYTICS?.writeDataPoint({
      blobs: ['session_created'],
      doubles: [1],
      indexes: [`user:${userId}`, `character:${body.characterId}`],
    })

    return new Response(JSON.stringify({
      sessionKey,
      sessionId,
      conversationId,
      websocketUrl: `wss://${new URL(request.url).host}/session?key=${sessionKey}`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Create session error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * End a voice agent session
 */
async function endSession(request: Request, env: Env, userId: string): Promise<Response> {
  try {
    const { sessionId } = await request.json() as { sessionId: string }

    // Get session from database
    const session = await env.DB.prepare(`
      SELECT * FROM voice_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first()

    if (!session) {
      return new Response('Session not found', { status: 404 })
    }

    // Update session status
    const endedAt = Date.now()
    const durationSeconds = Math.floor((endedAt - (session.started_at as number)) / 1000)

    await env.DB.prepare(`
      UPDATE voice_sessions
      SET status = 'ended', ended_at = ?, total_audio_seconds = ?
      WHERE id = ?
    `).bind(endedAt, durationSeconds, sessionId).run()

    // Update conversation
    await env.DB.prepare(`
      UPDATE conversations
      SET ended_at = ?, duration_seconds = ?
      WHERE id = ?
    `).bind(endedAt, durationSeconds, session.conversation_id).run()

    // Track session end in analytics
    env.ANALYTICS?.writeDataPoint({
      blobs: ['session_ended'],
      doubles: [durationSeconds],
      indexes: [`user:${userId}`, `session:${sessionId}`],
    })

    // Track usage for billing
    await env.DB.prepare(`
      INSERT INTO usage_events (id, user_id, event_type, quantity, metadata, polar_synced)
      VALUES (?, ?, 'voice_minutes', ?, ?, FALSE)
    `).bind(
      crypto.randomUUID(),
      userId,
      Math.ceil(durationSeconds / 60), // Convert to minutes
      JSON.stringify({ sessionId, conversationId: session.conversation_id }),
    ).run()

    return new Response(JSON.stringify({
      success: true,
      durationSeconds,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('End session error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to end session',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Verify JWT token and extract user ID
 */
async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    // Simple JWT verification (in production, use a proper JWT library)
    const [header, payload, signature] = token.split('.')

    if (!header || !payload || !signature) {
      return null
    }

    // Decode payload
    const decodedPayload = JSON.parse(atob(payload))

    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      return null
    }

    return decodedPayload.sub || null
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

/**
 * Durable Object for session state management
 */
export class VoiceSession implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private sessionData: any

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/init' && request.method === 'POST') {
      this.sessionData = await request.json()
      await this.state.storage.put('session', this.sessionData)
      return new Response('Session initialized', { status: 200 })
    }

    if (path === '/state' && request.method === 'GET') {
      const session = await this.state.storage.get('session')
      return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }
}

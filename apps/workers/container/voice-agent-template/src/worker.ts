/**
 * Cloudflare Worker for Voice Agent Container
 *
 * This worker is NOT called directly by clients. It is called by api-gateway.
 *
 * Flow:
 *   Client → api-gateway (auth, secrets) → this worker → container
 *
 * Trust boundary:
 *   - api-gateway validates JWT and manages secrets
 *   - This worker trusts requests from api-gateway
 *   - Container receives INWORLD_API_KEY via X-Inworld-API-Key header
 */

import { Container, getContainer } from '@cloudflare/containers'

/**
 * Voice Agent Container class
 * Configures container behavior for Cloudflare Containers
 *
 * Note: maxInstances is configured in wrangler.toml, not here
 */
export class VoiceAgentContainer extends Container {
  override defaultPort = 4000 // Container listening port
  override sleepAfter = '5m' // Scale to zero after 5 minutes of inactivity
}

/**
 * Environment bindings interface
 *
 * Secrets and KV bindings are now available for direct client connections
 */
export interface Env {
  VOICE_AGENT: DurableObjectNamespace<VoiceAgentContainer>  // Durable Object namespace for container
  SESSION_CACHE: KVNamespace  // Session cache for validating direct connections

  // Environment variables
  NODE_ENV: string
  WS_APP_PORT: string
  LOG_LEVEL: string

  // Secrets (set via: wrangler secret put)
  INWORLD_API_KEY: string
  INWORLD_WORKSPACE_ID: string
}

/**
 * Voice session data structure (from KV cache)
 */
interface VoiceSessionData {
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
  agentConfig: any  // PersonalityConfig
  createdAt: number
  expiresAt: number
}

/**
 * Handle direct WebSocket connections from clients
 * Validates session from KV and proxies to container
 *
 * This bypasses API Gateway to reduce latency
 */
async function handleDirectWebSocket(
  request: Request,
  env: Env,
  startTime: number,
): Promise<Response> {
  try {
    // 1. Get and validate session key
    const url = new URL(request.url)
    const sessionKey = url.searchParams.get('sessionKey')

    if (!sessionKey) {
      console.error('[WORKER_WS] Missing session key')
      return new Response(JSON.stringify({ error: 'Missing session key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate session from KV cache
    const sessionData = await env.SESSION_CACHE.get<VoiceSessionData>(
      `session:${sessionKey}`,
      { type: 'json' },
    )

    if (!sessionData) {
      console.error('[WORKER_WS] Invalid or expired session:', sessionKey)
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Check expiration
    if (Date.now() > sessionData.expiresAt) {
      console.error('[WORKER_WS] Session expired:', sessionKey)
      await env.SESSION_CACHE.delete(`session:${sessionKey}`)
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[WORKER_WS] Session validated:', {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
    })

    // 4. Load character in container before WebSocket upgrade
    const loadStartTime = Date.now()
    const loadUrl = new URL('/load', request.url)
    loadUrl.searchParams.set('key', sessionKey)

    // Create abort controller with 60 second timeout
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 60000)

    // Prepare headers for container
    const commonHeaders = {
      'X-User-ID': sessionData.userId,
      'X-Character-ID': sessionData.characterId,
      'X-Inworld-Character-ID': sessionData.inworldCharacterId,
      'X-Inworld-API-Key': env.INWORLD_API_KEY,
      'X-Inworld-Workspace-ID': env.INWORLD_WORKSPACE_ID,
    }

    const loadRequest = new Request(loadUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...commonHeaders,
      },
      body: JSON.stringify({
        agent: sessionData.agentConfig,
        userName: sessionData.userId,
        voiceConfig: sessionData.agentConfig?.voiceConfig || {},
      }),
      signal: abortController.signal,
    })

    // Call /load via container
    let loadResponse: Response
    try {
      const containerInstance = getContainer(env.VOICE_AGENT)
      loadResponse = await containerInstance.fetch(loadRequest)
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[WORKER_WS] Character load timeout (60s exceeded):', {
          sessionKey,
          characterId: sessionData.characterId,
          duration: Date.now() - loadStartTime,
        })
        return new Response(
          JSON.stringify({
            error: 'Character initialization timeout',
            message: 'Container took too long to initialize character (>60s). This may be a cold start - please try again.',
          }),
          {
            status: 504,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw error
    }

    clearTimeout(timeoutId)

    if (!loadResponse.ok) {
      const errorData = await loadResponse.json().catch(() => ({
        message: 'Unknown error',
      })) as { message?: string; error?: string }

      console.error('[WORKER_WS] Failed to load character:', {
        sessionKey,
        characterId: sessionData.characterId,
        error: errorData,
        duration: Date.now() - loadStartTime,
      })

      return new Response(
        JSON.stringify({
          error: 'Failed to initialize character',
          message: errorData.message || 'Character loading failed',
          details: errorData.error || 'Container returned error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const loadDuration = Date.now() - loadStartTime
    console.log('[WORKER_WS] Character loaded successfully:', {
      sessionKey,
      characterId: sessionData.characterId,
      duration: loadDuration,
    })

    // 5. Prepare container request for WebSocket upgrade
    const containerUrl = new URL(request.url)
    containerUrl.pathname = '/session' // WebSocket upgrade path in container

    const containerRequest = new Request(containerUrl.toString(), {
      method: request.method,
      headers: new Headers({
        // Forward all original headers (including WebSocket upgrade headers)
        ...Object.fromEntries(request.headers.entries()),
        // Add authentication and session context headers
        ...commonHeaders,
        'X-Session-Key': sessionKey,
        'X-Conversation-ID': sessionData.conversationId,
      }),
    })

    // 6. Forward WebSocket upgrade to container
    console.log('[WORKER_WS] Forwarding WebSocket upgrade to container:', {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
      loadDuration,
      totalDuration: Date.now() - startTime,
    })

    const containerInstance = getContainer(env.VOICE_AGENT)
    return containerInstance.fetch(containerRequest)
  } catch (error) {
    console.error('[WORKER_WS] Direct WebSocket error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to establish WebSocket connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * Main Worker fetch handler
 *
 * Supports two modes:
 * 1. Direct client connections (/ws endpoint) - validates session from KV
 * 2. API Gateway proxy (all other endpoints) - trusts headers from gateway
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const startTime = Date.now()

    console.log(`[WORKER] Incoming request: ${request.method} ${path}`)

    try {
      // Public endpoints - no authentication required
      if (path === '/health' || path === '/ready' || path === '/metrics') {
        // Proxy these monitoring endpoints directly to container
        const containerInstance = getContainer(env.VOICE_AGENT)
        const response = await containerInstance.fetch(request)
        const duration = Date.now() - startTime
        console.log(`[WORKER] Public endpoint ${path}: ${response.status} (${duration}ms)`)
        return response
      }

      // Direct WebSocket endpoint - bypasses API Gateway for reduced latency
      if (path === '/ws') {
        return handleDirectWebSocket(request, env, startTime)
      }

      // All other endpoints require headers from api-gateway
      const userId = request.headers.get('X-User-ID')
      const inworldApiKey = request.headers.get('X-Inworld-API-Key')

      if (!userId || !inworldApiKey) {
        console.error('[WORKER] Missing required headers from api-gateway')
        return new Response(JSON.stringify({
          error: 'Invalid request',
          message: 'This endpoint must be called via api-gateway',
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // All requests are proxied to container
      // Container will extract X-Inworld-API-Key and X-User-ID headers
      console.log(`[WORKER] Proxying ${request.method} ${path} to container`)

      const containerInstance = getContainer(env.VOICE_AGENT)
      const response = await containerInstance.fetch(request)

      const duration = Date.now() - startTime
      console.log(`[WORKER] Container response: ${response.status} (${duration}ms)`)

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('[WORKER] Worker error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        duration,
        path,
      })
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

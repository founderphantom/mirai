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
 */
export class VoiceAgentContainer extends Container {
  defaultPort = 4000 // Container listening port
  sleepAfter = '5m' // Scale to zero after 5 minutes of inactivity
  maxInstances = 10 // Maximum concurrent instances
}

/**
 * Environment bindings interface
 *
 * NOTE: Secrets are managed by api-gateway, not this worker
 */
export interface Env {
  VOICE_AGENT: Container
  DB: D1Database
  VOICE_SESSION: DurableObjectNamespace
  SESSION_CACHE: KVNamespace
  AUDIO_STORAGE: R2Bucket
  ANALYTICS: AnalyticsEngineDataset

  // Environment variables
  NODE_ENV: string
  WS_APP_PORT: string
  LOG_LEVEL: string
}

/**
 * Main Worker fetch handler
 *
 * IMPORTANT: This worker should only be called by api-gateway, not directly by clients.
 * api-gateway is responsible for:
 *   - JWT authentication
 *   - Rate limiting
 *   - Passing INWORLD_API_KEY via X-Inworld-API-Key header
 *   - Passing authenticated user ID via X-User-ID header
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Verify request comes from api-gateway
      // In production, add additional verification (e.g., internal header token)
      const userId = request.headers.get('X-User-ID')
      const inworldApiKey = request.headers.get('X-Inworld-API-Key')

      if (!userId || !inworldApiKey) {
        console.error('Missing required headers from api-gateway')
        return new Response(JSON.stringify({
          error: 'Invalid request',
          message: 'This endpoint must be called via api-gateway',
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Health check endpoint (bypass container)
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV,
          container: 'voice-agent-runtime',
        }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // All requests are proxied to container
      // Container will extract X-Inworld-API-Key and X-User-ID headers
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

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

import { Container } from '@cloudflare/containers'

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
 * NOTE: Secrets are managed by api-gateway, not this worker
 */
export interface Env {
  VOICE_AGENT: Container

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
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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
      return env.VOICE_AGENT.fetch(request)
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

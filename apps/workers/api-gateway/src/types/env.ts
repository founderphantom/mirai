/**
 * Environment bindings for Cloudflare Workers
 */

export interface Env {
  // D1 Database
  DB: D1Database

  // R2 Buckets
  USER_ASSETS: R2Bucket

  // KV Namespaces
  CACHE: KVNamespace
  SESSION_CACHE: KVNamespace

  // Durable Objects
  VOICE_SESSION: DurableObjectNamespace

  // Service Bindings (Worker-to-Worker)
  VOICE_AGENT: Fetcher  // Service binding to voice-agent-container Worker

  // Environment Variables
  ENVIRONMENT: string
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string

  // OAuth Credentials
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string

  // Polar Configuration
  POLAR_ACCESS_TOKEN: string
  POLAR_ORGANIZATION_ID: string
  POLAR_WEBHOOK_SECRET: string

  // Inworld Configuration
  INWORLD_API_KEY: string
  INWORLD_WORKSPACE_ID: string
}

/**
 * Hono context with environment bindings
 */
export interface HonoEnv {
  Bindings: Env
  Variables: {
    user?: {
      id: string
      email: string
      name: string
      [key: string]: any
    }
    session?: {
      id: string
      userId: string
      expiresAt: Date
      [key: string]: any
    }
  }
}

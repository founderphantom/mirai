/**
 * Voice Session Routes
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import type { VoiceSessionData } from '../types/session'
import { VoiceSessionService } from '../services/voice'

const voiceRoutes = new Hono<HonoEnv>()

// Validation schemas
const startSessionSchema = z.object({
  characterId: z.string().min(1),
})

const endSessionSchema = z.object({
  durationSeconds: z.number().optional(),
  audioSeconds: z.number().optional(),
})

/**
 * POST /api/voice/session/start
 * Start a new voice session
 */
voiceRoutes.post(
  '/session/start',
  zValidator('json', startSessionSchema),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { characterId } = c.req.valid('json')
    const service = new VoiceSessionService(c.env)

    try {
      const session = await service.startSession(user.id, characterId)
      return c.json(session, 201)
    } catch (error) {
      console.error('[VOICE] Start session error:', error)
      return c.json(
        {
          error: 'Failed to start voice session',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  },
)

/**
 * GET /api/voice/session/:id
 * Get voice session details
 */
voiceRoutes.get('/session/:id', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = c.req.param('id')
  const service = new VoiceSessionService(c.env)

  try {
    const session = await service.getSession(sessionId, user.id)

    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(session)
  } catch (error) {
    console.error('[VOICE] Get session error:', error)
    return c.json({ error: 'Failed to fetch session' }, 500)
  }
})

/**
 * POST /api/voice/session/:id/end
 * End a voice session
 */
voiceRoutes.post(
  '/session/:id/end',
  zValidator('json', endSessionSchema),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const sessionId = c.req.param('id')
    const metrics = c.req.valid('json')
    const service = new VoiceSessionService(c.env)

    try {
      await service.endSession(sessionId, user.id, metrics)
      return c.json({ success: true })
    } catch (error) {
      console.error('[VOICE] End session error:', error)
      return c.json(
        {
          error: 'Failed to end session',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  },
)

/**
 * GET /api/voice/sessions/active
 * Get active voice sessions for the user
 */
voiceRoutes.get('/sessions/active', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const service = new VoiceSessionService(c.env)

  try {
    const sessions = await service.getActiveSessions(user.id)
    return c.json({ sessions })
  } catch (error) {
    console.error('[VOICE] Get active sessions error:', error)
    return c.json({ error: 'Failed to fetch active sessions' }, 500)
  }
})

/**
 * GET /api/voice/ws?sessionKey=xxx
 * WebSocket endpoint - proxies to voice agent container
 *
 * Flow:
 *   1. Validate sessionKey from KV cache
 *   2. Check if WebSocket upgrade request
 *   3. Call /load to initialize character in container
 *   4. Forward WebSocket upgrade to container
 *   5. Container handles WebSocket connection
 */
voiceRoutes.get('/ws', async (c) => {
  try {
    // 1. Get and validate session key
    const sessionKey = c.req.query('sessionKey')

    if (!sessionKey) {
      console.error('[VOICE_WS] Missing session key')
      return c.json({ error: 'Missing session key' }, 400)
    }

    // 2. Validate session from KV cache (optimized: get as JSON directly)
    const sessionData = await c.env.SESSION_CACHE.get<VoiceSessionData>(`session:${sessionKey}`, { type: 'json' })

    if (!sessionData) {
      console.error('[VOICE_WS] Invalid or expired session:', sessionKey)
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    // 3. Check expiration (combined with existence check for faster path)
    if (Date.now() > sessionData.expiresAt) {
      console.error('[VOICE_WS] Session expired:', sessionKey)
      await c.env.SESSION_CACHE.delete(`session:${sessionKey}`)
      return c.json({ error: 'Session expired' }, 401)
    }

    // 4. Load character in Voice Agent Container before WebSocket upgrade
    // This ensures the character is initialized in the multi-tenant pool
    // Note: Skipping WebSocket upgrade header validation - will fail naturally if not WS
    console.log('[VOICE_WS] Loading character before WebSocket upgrade:', {
      sessionKey,
      characterId: sessionData.characterId,
    })

    const loadStartTime = Date.now()
    const loadUrl = new URL('/load', c.req.url)
    loadUrl.searchParams.set('key', sessionKey)

    // Create abort controller with 60 second timeout for container initialization
    // Container cold start + VAD model loading + Inworld graph creation can take 30-60s
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 60000) // 60 seconds

    // Prepare common headers (reused for both /load and /session requests)
    const commonHeaders = {
      'X-User-ID': sessionData.userId,
      'X-Character-ID': sessionData.characterId,
      'X-Inworld-Character-ID': sessionData.inworldCharacterId,
      'X-Inworld-API-Key': c.env.INWORLD_API_KEY,
      'X-Inworld-Workspace-ID': c.env.INWORLD_WORKSPACE_ID,
    }

    const loadRequest = new Request(loadUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...commonHeaders,
      },
      body: JSON.stringify({
        agent: sessionData.agentConfig,  // Personality config from character
        userName: sessionData.userId,    // User ID as userName
        voiceConfig: sessionData.agentConfig?.voiceConfig || {},
      }),
      signal: abortController.signal,
    })

    // Call /load via service binding (worker validates, proxies to container)
    let loadResponse: Response
    try {
      loadResponse = await c.env.VOICE_AGENT.fetch(loadRequest)
    } catch (error) {
      clearTimeout(timeoutId)

      // Check if error is due to abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[VOICE_WS] Character load timeout (60s exceeded):', {
          sessionKey,
          characterId: sessionData.characterId,
          duration: Date.now() - loadStartTime,
        })
        return c.json(
          {
            error: 'Character initialization timeout',
            message: 'Container took too long to initialize character (>60s). This may be a cold start - please try again.',
            details: 'The voice agent container is warming up. Subsequent requests will be faster.',
          },
          504, // Gateway Timeout
        )
      }

      // Re-throw other errors
      throw error
    }

    clearTimeout(timeoutId)

    if (!loadResponse.ok) {
      const errorData = await loadResponse.json().catch(() => ({
        message: 'Unknown error'
      })) as { message?: string; error?: string }
      console.error('[VOICE_WS] Failed to load character:', {
        sessionKey,
        characterId: sessionData.characterId,
        error: errorData,
        duration: Date.now() - loadStartTime,
      })
      return c.json(
        {
          error: 'Failed to initialize character',
          message: errorData.message || 'Character loading failed',
          details: errorData.error || 'Container returned error',
        },
        500,
      )
    }

    const loadDuration = Date.now() - loadStartTime
    console.log('[VOICE_WS] Character loaded successfully:', {
      sessionKey,
      characterId: sessionData.characterId,
      duration: loadDuration,
    })

    // 5. Prepare container request for WebSocket upgrade
    const containerUrl = new URL(c.req.url)
    containerUrl.pathname = '/session'  // WebSocket upgrade path in container

    // Build container request with all necessary headers (optimized: reuse commonHeaders)
    const containerRequest = new Request(containerUrl.toString(), {
      method: c.req.method,
      headers: new Headers({
        // Forward all original headers (including WebSocket upgrade headers)
        ...Object.fromEntries(c.req.raw.headers.entries()),
        // Add authentication and session context headers (reusing prepared headers)
        ...commonHeaders,
        'X-Session-Key': sessionKey,
        'X-Conversation-ID': sessionData.conversationId,
      }),
    })

    // 6. Forward WebSocket upgrade to voice agent worker (worker proxies to container)
    console.log('[VOICE_WS] Forwarding WebSocket upgrade to worker:', {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
      loadDuration,
    })

    return c.env.VOICE_AGENT.fetch(containerRequest)

  } catch (error) {
    console.error('[VOICE_WS] WebSocket proxy error:', error)
    return c.json(
      {
        error: 'Failed to establish WebSocket connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

export default voiceRoutes

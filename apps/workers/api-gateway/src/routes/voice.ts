/**
 * Voice Session Routes
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { VoiceSessionService } from '../services/voice'
import { getContainer } from '@cloudflare/containers'

const voiceRoutes = new Hono<HonoEnv>()

// Validation schemas
const startSessionSchema = z.object({
  characterId: z.string().uuid(),
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
 *   3. Forward to container with authentication headers
 *   4. Container handles WebSocket connection
 */
voiceRoutes.get('/ws', async (c) => {
  try {
    // 1. Get and validate session key
    const sessionKey = c.req.query('sessionKey')

    if (!sessionKey) {
      console.error('[VOICE_WS] Missing session key')
      return c.json({ error: 'Missing session key' }, 400)
    }

    // 2. Validate session from KV cache
    const sessionDataStr = await c.env.SESSION_CACHE.get(`session:${sessionKey}`)

    if (!sessionDataStr) {
      console.error('[VOICE_WS] Invalid or expired session:', sessionKey)
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    const sessionData = JSON.parse(sessionDataStr)

    // 3. Check expiration
    if (Date.now() > sessionData.expiresAt) {
      console.error('[VOICE_WS] Session expired:', sessionKey)
      await c.env.SESSION_CACHE.delete(`session:${sessionKey}`)
      return c.json({ error: 'Session expired' }, 401)
    }

    // 4. Verify WebSocket upgrade
    const upgradeHeader = c.req.header('Upgrade')
    if (upgradeHeader?.toLowerCase() !== 'websocket') {
      console.error('[VOICE_WS] Not a WebSocket upgrade request')
      return c.json({ error: 'Expected WebSocket upgrade' }, 426)
    }

    // 5. Prepare container request with authentication headers
    const containerUrl = new URL(c.req.url)

    // Build container request with all necessary headers
    const containerRequest = new Request(containerUrl.toString(), {
      method: c.req.method,
      headers: new Headers({
        // Forward all original headers
        ...Object.fromEntries(c.req.raw.headers.entries()),
        // Add authentication and session context headers
        'X-User-ID': sessionData.userId,
        'X-Character-ID': sessionData.characterId,
        'X-Inworld-Character-ID': sessionData.inworldCharacterId,
        'X-Session-Key': sessionKey,
        'X-Conversation-ID': sessionData.conversationId,
        'X-Inworld-API-Key': c.env.INWORLD_API_KEY,
        'X-Inworld-Workspace-ID': c.env.INWORLD_WORKSPACE_ID,
      }),
    })

    // 6. Forward to voice agent container
    console.log('[VOICE_WS] Forwarding WebSocket upgrade to container:', {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
    })

    const container = getContainer(c.env.VOICE_AGENT_CONTAINER)
    return container.fetch(containerRequest)

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

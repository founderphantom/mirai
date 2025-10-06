/**
 * Voice Session Routes
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { VoiceSessionService } from '../services/voice'

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

export default voiceRoutes

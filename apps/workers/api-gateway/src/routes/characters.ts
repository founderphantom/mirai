/**
 * Character Management Routes
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { HonoEnv } from '../types/env'
import { CharacterService } from '../services/characters'

const characterRoutes = new Hono<HonoEnv>()

// Validation schemas
const createCharacterSchema = z.object({
  displayName: z.string().min(1).max(100),
  personalityConfig: z.object({
    motivations: z.array(z.string()).min(1),
    flaws: z.array(z.string()).min(1),
    dialogueStyle: z.string(),
    adjectives: z.array(z.string()).min(1),
    voiceConfig: z.object({
      pitch: z.number().optional(),
      speed: z.number().optional(),
      emotionRange: z.enum(['low', 'medium', 'high']).optional(),
    }).optional(),
  }),
  live2dModelKey: z.string().optional(),
})

const updateCharacterSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  personalityConfig: z.object({
    motivations: z.array(z.string()).min(1),
    flaws: z.array(z.string()).min(1),
    dialogueStyle: z.string(),
    adjectives: z.array(z.string()).min(1),
    voiceConfig: z.object({
      pitch: z.number().optional(),
      speed: z.number().optional(),
      emotionRange: z.enum(['low', 'medium', 'high']).optional(),
    }).optional(),
  }).optional(),
  live2dModelKey: z.string().optional(),
  avatarThumbnail: z.string().optional(),
  isPublic: z.boolean().optional(),
})

/**
 * POST /api/characters
 * Create a new character
 */
characterRoutes.post(
  '/',
  zValidator('json', createCharacterSchema),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const data = c.req.valid('json')
    const service = new CharacterService(c.env)

    try {
      const character = await service.createCharacter(user.id, data)
      return c.json(character, 201)
    } catch (error) {
      console.error('[CHARACTERS] Create error:', error)
      return c.json(
        {
          error: 'Failed to create character',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  },
)

/**
 * GET /api/characters
 * Get all characters for the authenticated user
 */
characterRoutes.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const service = new CharacterService(c.env)

  try {
    const characters = await service.getUserCharacters(user.id)
    return c.json({ characters })
  } catch (error) {
    console.error('[CHARACTERS] List error:', error)
    return c.json({ error: 'Failed to fetch characters' }, 500)
  }
})

/**
 * GET /api/characters/:id
 * Get a specific character
 */
characterRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const characterId = c.req.param('id')
  const service = new CharacterService(c.env)

  try {
    const character = await service.getCharacter(characterId, user.id)

    if (!character) {
      return c.json({ error: 'Character not found' }, 404)
    }

    return c.json(character)
  } catch (error) {
    console.error('[CHARACTERS] Get error:', error)
    return c.json({ error: 'Failed to fetch character' }, 500)
  }
})

/**
 * PUT /api/characters/:id
 * Update a character
 */
characterRoutes.put(
  '/:id',
  zValidator('json', updateCharacterSchema),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const characterId = c.req.param('id')
    const updates = c.req.valid('json')
    const service = new CharacterService(c.env)

    try {
      const character = await service.updateCharacter(
        characterId,
        user.id,
        updates,
      )

      if (!character) {
        return c.json({ error: 'Character not found' }, 404)
      }

      return c.json(character)
    } catch (error) {
      console.error('[CHARACTERS] Update error:', error)
      return c.json(
        {
          error: 'Failed to update character',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  },
)

/**
 * DELETE /api/characters/:id
 * Delete a character
 */
characterRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const characterId = c.req.param('id')
  const service = new CharacterService(c.env)

  try {
    await service.deleteCharacter(characterId, user.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('[CHARACTERS] Delete error:', error)
    return c.json(
      {
        error: 'Failed to delete character',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

export default characterRoutes

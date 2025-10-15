/**
 * Admin Routes
 * Protected endpoints for administrative tasks
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'
import { seedPresetsRuntime } from '@proj-airi/database-schema/seed-presets-runtime'
import { drizzle } from 'drizzle-orm/d1'
import { characters } from '@proj-airi/database-schema'
import { eq } from 'drizzle-orm'

const adminRoutes = new Hono<HonoEnv>()

/**
 * Admin authentication middleware
 */
adminRoutes.use('*', async (c, next) => {
  const adminSecret = c.req.header('X-Admin-Secret')

  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

/**
 * POST /admin/seed-presets-runtime
 * Seed preset characters for Inworld Runtime
 * Runtime creates characters on-the-fly from personality config
 */
adminRoutes.post('/seed-presets-runtime', async (c) => {
  try {
    console.log('[ADMIN] Starting Runtime preset character seed...')

    await seedPresetsRuntime(c.env.DB)

    return c.json({
      success: true,
      message: 'Preset characters seeded successfully (Runtime mode)',
    })
  } catch (error) {
    console.error('[ADMIN] Error seeding presets (runtime):', error)
    return c.json(
      {
        error: 'Failed to seed presets',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

/**
 * GET /admin/seed-presets
 * Check seed status and list preset characters
 */
adminRoutes.get('/seed-presets', async (c) => {
  try {
    const db = drizzle(c.env.DB)

    const presets = await db
      .select()
      .from(characters)
      .where(eq(characters.isPreset, true))

    return c.json({
      presetCount: presets.length,
      presets: presets.map(p => ({
        id: p.id,
        displayName: p.displayName,
        description: p.description,
        inworldCharacterId: p.inworldCharacterId,
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    console.error('[ADMIN] Error fetching presets:', error)
    return c.json(
      {
        error: 'Failed to fetch presets',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

/**
 * DELETE /admin/seed-presets/:id
 * Delete a specific preset character
 */
adminRoutes.delete('/seed-presets/:id', async (c) => {
  try {
    const presetId = c.req.param('id')
    const db = drizzle(c.env.DB)

    await db
      .delete(characters)
      .where(eq(characters.id, presetId))

    return c.json({
      success: true,
      message: `Preset ${presetId} deleted`,
    })
  } catch (error) {
    console.error('[ADMIN] Error deleting preset:', error)
    return c.json(
      {
        error: 'Failed to delete preset',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

export default adminRoutes

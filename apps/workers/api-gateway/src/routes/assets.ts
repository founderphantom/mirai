/**
 * Asset Management Routes
 *
 * Handles user asset uploads and downloads (Live2D models, avatars, etc.)
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'

const assetRoutes = new Hono<HonoEnv>()

/**
 * POST /api/assets/avatar
 * Upload user avatar to R2
 */
assetRoutes.post('/avatar', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const formData = await c.req.formData()
    const fileEntry = formData.get('avatar')

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'No file provided' }, 400)
    }

    const file = fileEntry as File

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400)
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size must be less than 5MB' }, 400)
    }

    // Generate R2 key for avatar
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const key = `users/${user.id}/avatar/${timestamp}.${extension}`

    // Upload to R2
    await c.env.USER_ASSETS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        userId: user.id,
        assetType: 'avatar',
      },
    })

    // Generate public URL for the avatar
    const url = `/api/assets/${key}`

    return c.json({
      key,
      url,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('[ASSETS] Avatar upload error:', error)
    return c.json(
      {
        error: 'Failed to upload avatar',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * POST /api/assets/upload
 * Upload an asset to R2
 */
assetRoutes.post('/upload', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const formData = await c.req.formData()
    const fileEntry = formData.get('file')
    const characterId = formData.get('characterId') as string
    const assetType = (formData.get('type') as string) || 'live2d'

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'No file provided' }, 400)
    }

    const file = fileEntry as File

    if (!characterId) {
      return c.json({ error: 'Character ID required' }, 400)
    }

    // Verify character ownership
    const { drizzle } = await import('drizzle-orm/d1')
    const { characters } = await import('@proj-airi/database-schema')
    const { eq, and } = await import('drizzle-orm')

    const db = drizzle(c.env.DB)

    const character = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.userId, user.id),
        ),
      )
      .limit(1)

    if (!character.length) {
      return c.json({ error: 'Character not found' }, 404)
    }

    // Generate R2 key
    const timestamp = Date.now()
    const key = `users/${user.id}/characters/${characterId}/${assetType}/${timestamp}-${file.name}`

    // Upload to R2
    await c.env.USER_ASSETS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        userId: user.id,
        characterId,
        assetType,
      },
    })

    // Update character if this is a model or avatar
    if (assetType === 'live2d') {
      await db
        .update(characters)
        .set({
          live2dModelKey: key,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId))
    } else if (assetType === 'avatar') {
      await db
        .update(characters)
        .set({
          avatarThumbnail: key,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId))
    }

    return c.json({
      key,
      url: `/api/assets/${key}`,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('[ASSETS] Upload error:', error)
    return c.json(
      {
        error: 'Failed to upload asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * GET /api/assets/:key
 * Download an asset from R2
 */
assetRoutes.get('/:key{.+}', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const key = c.req.param('key')

  // Verify user owns this asset (key should start with users/{userId}/)
  if (!key.startsWith(`users/${user.id}/`)) {
    return c.json({ error: 'Access denied' }, 403)
  }

  try {
    const object = await c.env.USER_ASSETS.get(key)

    if (!object) {
      return c.json({ error: 'Asset not found' }, 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Cache-Control', 'max-age=86400') // 24 hour cache
    headers.set('Access-Control-Allow-Origin', '*')

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('[ASSETS] Download error:', error)
    return c.json({ error: 'Failed to download asset' }, 500)
  }
})

/**
 * DELETE /api/assets/:key
 * Delete an asset from R2
 */
assetRoutes.delete('/:key{.+}', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const key = c.req.param('key')

  // Verify user owns this asset
  if (!key.startsWith(`users/${user.id}/`)) {
    return c.json({ error: 'Access denied' }, 403)
  }

  try {
    await c.env.USER_ASSETS.delete(key)
    return c.json({ success: true })
  } catch (error) {
    console.error('[ASSETS] Delete error:', error)
    return c.json({ error: 'Failed to delete asset' }, 500)
  }
})

export default assetRoutes

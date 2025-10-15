/**
 * Seed Preset Characters (Inworld Runtime Version)
 *
 * With Inworld Runtime, characters are NOT created via REST API.
 * Instead, characters are defined by:
 * 1. System prompts (personality configuration)
 * 2. Voice/model configuration
 * 3. The Runtime creates the character on-the-fly during conversations
 *
 * This script simply adds preset characters to the database with their configurations.
 */

import { drizzle } from 'drizzle-orm/d1'
import { characters } from './schema/characters'
import type { PersonalityConfig } from './schema/characters'

/**
 * Preset character definitions for Inworld Runtime
 */
const PRESET_CHARACTERS = [
  {
    id: 'preset-hiyori-001',
    displayName: 'Hiyori',
    description: 'A cheerful and energetic companion who loves to chat and help out!',
    live2dModelKey: 'hiyori_pro_zh.zip', // Live2D model archive path (relative to /assets/live2d/models/)
    avatarThumbnail: '/assets/live2d/models/hiyori/preview.png', // Thumbnail for character card

    // This is just a reference ID - not actually used by Runtime
    // Runtime creates characters on-the-fly from personality config
    inworldCharacterId: 'runtime-character-hiyori',

    personalityConfig: {
      motivations: [
        'Help users feel comfortable and happy',
        "Learn about the user's interests",
        'Provide helpful and friendly conversation',
      ],
      flaws: ['Sometimes too enthusiastic', 'Can be a bit chatty'],
      dialogueStyle: 'Cheerful, friendly, and upbeat with a touch of playfulness',
      adjectives: ['Cheerful', 'Energetic', 'Helpful', 'Curious', 'Optimistic'],
      voiceConfig: {
        pitch: 1.1,
        speed: 1.0,
        emotionRange: 'high' as const,
      },
    } as PersonalityConfig,
  },
]

/**
 * Seed preset characters for Inworld Runtime
 */
export async function seedPresetsRuntime(db: D1Database) {
  const drizzleDb = drizzle(db)

  console.log('[SEED-RUNTIME] Starting preset character seed (Inworld Runtime mode)...')

  for (const preset of PRESET_CHARACTERS) {
    console.log(`[SEED-RUNTIME] Seeding preset character: ${preset.displayName}`)

    try {
      // Check if character already exists
      const existing = await drizzleDb
        .select()
        .from(characters)
        .where((c) => c.id === preset.id)
        .limit(1)

      if (existing.length > 0) {
        console.log(
          `[SEED-RUNTIME] ⚠️  Character ${preset.displayName} already exists, skipping...`
        )
        continue
      }

      // Insert into database
      await drizzleDb.insert(characters).values({
        id: preset.id,
        userId: null, // Preset characters have no owner
        inworldCharacterId: preset.inworldCharacterId,
        displayName: preset.displayName,
        description: preset.description,
        live2dModelKey: preset.live2dModelKey,
        avatarThumbnail: preset.avatarThumbnail,
        personalityConfig: preset.personalityConfig as any,
        isPreset: true,
        isPublic: false,
        totalConversations: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      console.log(`[SEED-RUNTIME] ✅ Seeded preset: ${preset.displayName}`)
    } catch (error) {
      console.error(
        `[SEED-RUNTIME] ❌ Failed to seed preset ${preset.displayName}:`,
        error
      )
      throw error
    }
  }

  console.log('[SEED-RUNTIME] ✅ All preset characters seeded successfully!')
}

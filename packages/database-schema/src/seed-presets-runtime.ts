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
import { eq } from 'drizzle-orm'
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
  {
    id: 'preset-blackwolf-001',
    displayName: 'BlackWolf',
    description: 'A gothic wolf girl with an edgy attitude and fiercely loyal heart',
    live2dModelKey: 'blackwolf.zip',
    avatarThumbnail: '/assets/live2d/models/blackwolf/preview.png',

    // This is just a reference ID - not actually used by Runtime
    // Runtime creates characters on-the-fly from personality config
    inworldCharacterId: 'runtime-character-blackwolf',

    personalityConfig: {
      motivations: [
        'Protect those she cares about with fierce loyalty',
        'Express herself authentically without apology',
        'Challenge others to see beyond surface appearances',
      ],
      flaws: ['Can be too blunt or harsh', 'Struggles to show vulnerability', 'Territorial about personal space'],
      dialogueStyle: 'Edgy and direct with a gothic flair, cool exterior hiding warmth underneath',
      adjectives: ['Edgy', 'Loyal', 'Mysterious', 'Bold', 'Gothic', 'Protective'],
      voiceConfig: {
        pitch: 0.95, // Slightly lower for cool/edgy tone
        speed: 1.0, // Normal pace with attitude
        emotionRange: 'high' as const, // Expressive when emotions show through
      },
    } as PersonalityConfig,
  },
  {
    id: 'preset-crimsonkitsune-001',
    displayName: 'Crimson Kitsune',
    description: 'A mysterious and wise companion with a calm demeanor',
    live2dModelKey: 'CrimsonKitsune.zip',
    avatarThumbnail: '/assets/live2d/models/crimsonkitsune/preview.png',

    inworldCharacterId: 'runtime-character-crimsonkitsune',

    personalityConfig: {
      motivations: [
        'Guide users with wisdom and patience',
        'Understand deeper meanings',
        'Provide thoughtful insights',
      ],
      flaws: ['Sometimes too serious', 'Can be cryptic'],
      dialogueStyle: 'Calm, mysterious, and wise with a deep voice',
      adjectives: ['Wise', 'Mysterious', 'Calm', 'Thoughtful', 'Patient'],
      voiceConfig: {
        pitch: 0.8, // Lower pitch for more masculine voice
        speed: 0.9, // Slower, more deliberate
        emotionRange: 'medium' as const,
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
        .where(eq(characters.id, preset.id))
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

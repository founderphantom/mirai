/**
 * Character Service
 *
 * Business logic for character management
 */

import type { Env } from '../types/env'
import { drizzle } from 'drizzle-orm/d1'
import { characters, type NewCharacter, type PersonalityConfig } from '@proj-airi/database-schema'
import { eq, and } from 'drizzle-orm'

export class CharacterService {
  private db

  constructor(private env: Env) {
    this.db = drizzle(env.DB)
  }

  /**
   * Create a new character
   */
  async createCharacter(
    userId: string,
    data: {
      displayName: string
      personalityConfig: PersonalityConfig
      live2dModelKey?: string
    },
  ) {
    // 1. Create character in Inworld Studio via REST API
    const inworldChar = await this.createInworldCharacter(data)

    // 2. Store character in D1
    const characterId = crypto.randomUUID()

    const newCharacter: NewCharacter = {
      id: characterId,
      userId,
      inworldCharacterId: inworldChar.id,
      displayName: data.displayName,
      personalityConfig: data.personalityConfig as any,
      live2dModelKey: data.live2dModelKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.db.insert(characters).values(newCharacter)

    return {
      characterId,
      inworldCharacterId: inworldChar.id,
      displayName: data.displayName,
      createdAt: newCharacter.createdAt,
    }
  }

  /**
   * Get user's characters
   */
  async getUserCharacters(userId: string) {
    return await this.db
      .select()
      .from(characters)
      .where(eq(characters.userId, userId))
      .orderBy(characters.createdAt)
  }

  /**
   * Get character by ID
   */
  async getCharacter(characterId: string, userId: string) {
    const result = await this.db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.userId, userId),
        ),
      )
      .limit(1)

    return result[0] || null
  }

  /**
   * Update character
   */
  async updateCharacter(
    characterId: string,
    userId: string,
    updates: Partial<{
      displayName: string
      personalityConfig: PersonalityConfig
      live2dModelKey: string
      avatarThumbnail: string
      isPublic: boolean
    }>,
  ) {
    // Verify ownership
    const character = await this.getCharacter(characterId, userId)
    if (!character) {
      throw new Error('Character not found')
    }

    // Update in database
    await this.db
      .update(characters)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId))

    // If personality changed, update Inworld character
    if (updates.personalityConfig) {
      await this.updateInworldCharacter(
        character.inworldCharacterId,
        updates.personalityConfig,
      )
    }

    return this.getCharacter(characterId, userId)
  }

  /**
   * Delete character
   */
  async deleteCharacter(characterId: string, userId: string) {
    // Verify ownership
    const character = await this.getCharacter(characterId, userId)
    if (!character) {
      throw new Error('Character not found')
    }

    // Delete from database (cascades to conversations and sessions)
    await this.db
      .delete(characters)
      .where(eq(characters.id, characterId))

    // TODO: Delete from Inworld (optional, may want to keep)
    // await this.deleteInworldCharacter(character.inworldCharacterId)

    return { success: true }
  }

  /**
   * Create character in Inworld Studio
   * @private
   */
  private async createInworldCharacter(data: {
    displayName: string
    personalityConfig: PersonalityConfig
  }) {
    const response = await fetch(
      `https://studio.inworld.ai/v1/workspaces/${this.env.INWORLD_WORKSPACE_ID}/characters`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.INWORLD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: data.displayName,
          brain: {
            motivations: data.personalityConfig.motivations,
            flaws: data.personalityConfig.flaws,
            personalityTraits: data.personalityConfig.adjectives,
            dialogueStyle: data.personalityConfig.dialogueStyle,
          },
          defaultCharacterAssets: {
            voicePreset: data.personalityConfig.voiceConfig?.pitch
              ? 'custom'
              : 'default',
          },
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to create Inworld character: ${response.statusText}`)
    }

    const result = await response.json() as { name: string }
    return {
      id: result.name, // e.g., "workspaces/abc/characters/def"
    }
  }

  /**
   * Update character in Inworld Studio
   * @private
   */
  private async updateInworldCharacter(
    inworldCharacterId: string,
    personalityConfig: PersonalityConfig,
  ) {
    const response = await fetch(
      `https://studio.inworld.ai/v1/${inworldCharacterId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.env.INWORLD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brain: {
            motivations: personalityConfig.motivations,
            flaws: personalityConfig.flaws,
            personalityTraits: personalityConfig.adjectives,
            dialogueStyle: personalityConfig.dialogueStyle,
          },
        }),
      },
    )

    if (!response.ok) {
      console.error('[INWORLD] Failed to update character:', response.statusText)
    }
  }
}

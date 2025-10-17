/**
 * Character Service
 *
 * Business logic for character management
 */

import type { Env } from '../types/env'
import { drizzle } from 'drizzle-orm/d1'
import { characters, type NewCharacter, type PersonalityConfig } from '@proj-airi/database-schema'
import { eq, and, or, isNull, asc, desc } from 'drizzle-orm'

export class CharacterService {
  private db

  constructor(private env: Env) {
    this.db = drizzle(env.DB)
  }

  /**
   * Create a new character (Inworld Runtime approach)
   *
   * With Inworld Runtime, characters are NOT pre-created via Studio API.
   * Instead, we store the personality configuration in D1, and the voice agent
   * creates the character on-the-fly during conversations using Runtime.
   */
  async createCharacter(
    userId: string,
    data: {
      displayName: string
      personalityConfig: PersonalityConfig
      live2dModelKey?: string
      description?: string
      avatarThumbnail?: string
    },
  ) {
    const characterId = crypto.randomUUID()

    // Generate a unique Runtime character reference
    // This is NOT an actual Inworld character ID - Runtime creates characters on-the-fly
    const runtimeCharacterRef = `runtime-${characterId}`

    const newCharacter: NewCharacter = {
      id: characterId,
      userId,
      inworldCharacterId: runtimeCharacterRef, // Just a reference, not a real Inworld character
      displayName: data.displayName,
      description: data.description,
      personalityConfig: data.personalityConfig as any,
      live2dModelKey: data.live2dModelKey,
      avatarThumbnail: data.avatarThumbnail,
      isPreset: false,
      isPublic: false,
      totalConversations: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.db.insert(characters).values(newCharacter)

    return {
      characterId,
      displayName: data.displayName,
      description: data.description,
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
      .orderBy(asc(characters.createdAt))
  }

  /**
   * Get all preset characters (available to all users)
   */
  async getPresetCharacters() {
    return await this.db
      .select()
      .from(characters)
      .where(eq(characters.isPreset, true))
      .orderBy(asc(characters.displayName))
  }

  /**
   * Get character by ID
   * Supports both user-owned and preset characters
   */
  async getCharacter(characterId: string, userId: string) {
    const result = await this.db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          // Allow access to:
          // 1. User's own characters (userId matches) OR
          // 2. Preset characters (userId is null and isPreset is true)
          or(
            eq(characters.userId, userId),
            and(
              isNull(characters.userId),
              eq(characters.isPreset, true)
            )
          )
        ),
      )
      .limit(1)

    return result[0] || null
  }

  /**
   * Get preset character by ID (public access)
   * This is specifically for preset characters and doesn't require userId check
   */
  async getPresetCharacter(characterId: string) {
    const result = await this.db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.isPreset, true),
        ),
      )
      .limit(1)

    return result[0] || null
  }

  /**
   * Update character (Inworld Runtime approach)
   *
   * Only updates the database. The voice agent will use the updated
   * personality config the next time a conversation starts.
   */
  async updateCharacter(
    characterId: string,
    userId: string,
    updates: Partial<{
      displayName: string
      personalityConfig: PersonalityConfig
      live2dModelKey: string
      avatarThumbnail: string
      description: string
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
        personalityConfig: updates.personalityConfig as any,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId))

    return this.getCharacter(characterId, userId)
  }

  /**
   * Delete character (Inworld Runtime approach)
   *
   * Only deletes from database. Runtime-created characters don't need cleanup.
   */
  async deleteCharacter(characterId: string, userId: string) {
    // Verify ownership
    const character = await this.getCharacter(characterId, userId)
    if (!character) {
      throw new Error('Character not found')
    }

    // Prevent deletion of preset characters
    if (character.isPreset) {
      throw new Error('Cannot delete preset characters')
    }

    // Delete from database (cascades to conversations and sessions)
    await this.db
      .delete(characters)
      .where(eq(characters.id, characterId))

    return { success: true }
  }
}

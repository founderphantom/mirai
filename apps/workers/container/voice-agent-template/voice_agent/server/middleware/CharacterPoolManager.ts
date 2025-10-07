/**
 * Character Pool Manager - Multi-Tenant Session Management
 *
 * This manager implements character-based pooling where:
 * - One Inworld app instance per character (not per user)
 * - Multiple users share the same character instance
 * - Automatic cleanup of idle characters
 * - Max 100 concurrent sessions per container
 *
 * Architecture:
 *   Character A (Inworld App) → User 1, User 2, User 5 (sessions)
 *   Character B (Inworld App) → User 3, User 7 (sessions)
 *   Character C (Inworld App) → User 4, User 6, User 8 (sessions)
 */

import { WebSocket } from 'ws'
import { InworldApp } from '../components/app'
import type { Agent } from '../types'

interface CharacterInstance {
  characterId: string
  inworldCharacterId: string
  app: InworldApp
  sessions: Map<string, SessionData>
  lastActivity: number
}

interface SessionData {
  sessionKey: string
  userId: string
  conversationId: string
  websocket: WebSocket
  createdAt: number
}

interface CharacterConfig {
  agent: Agent
  userName: string
}

export class CharacterPoolManager {
  private static instance: CharacterPoolManager
  private characters: Map<string, CharacterInstance> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  // Configuration
  private readonly MAX_SESSIONS_PER_CONTAINER = 100
  private readonly CHARACTER_IDLE_TIMEOUT = 10 * 60 * 1000 // 10 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000 // 1 minute

  private constructor() {
    this.startCleanupTimer()
    console.log('[CharacterPool] Manager initialized')
  }

  static getInstance(): CharacterPoolManager {
    if (!CharacterPoolManager.instance) {
      CharacterPoolManager.instance = new CharacterPoolManager()
    }
    return CharacterPoolManager.instance
  }

  /**
   * Get or create a character instance
   * Multiple users can share the same character instance
   */
  async getOrCreateCharacter(
    characterId: string,
    inworldCharacterId: string,
    config: CharacterConfig,
  ): Promise<InworldApp> {
    // Check if character already exists
    let charInstance = this.characters.get(characterId)

    if (charInstance) {
      charInstance.lastActivity = Date.now()
      console.log(
        `[CharacterPool] Reusing existing character ${characterId} (${charInstance.sessions.size} active sessions)`,
      )
      return charInstance.app
    }

    // Check if we've hit max sessions (need to scale)
    const totalSessions = this.getTotalSessionCount()
    if (totalSessions >= this.MAX_SESSIONS_PER_CONTAINER) {
      console.error(
        `[CharacterPool] Container at max capacity (${totalSessions}/${this.MAX_SESSIONS_PER_CONTAINER})`,
      )
      throw new Error('Container at max capacity, scaling required')
    }

    // Create new Inworld app instance for this character
    console.log(`[CharacterPool] Creating new instance for character ${characterId}`)

    const app = new InworldApp()

    // Initialize will happen when load() is called
    // Store the character instance
    charInstance = {
      characterId,
      inworldCharacterId,
      app,
      sessions: new Map(),
      lastActivity: Date.now(),
    }

    this.characters.set(characterId, charInstance)
    console.log(
      `[CharacterPool] Character ${characterId} instance created. Total characters: ${this.characters.size}`,
    )

    return app
  }

  /**
   * Get existing character instance
   */
  getCharacter(characterId: string): InworldApp | undefined {
    const charInstance = this.characters.get(characterId)
    if (charInstance) {
      charInstance.lastActivity = Date.now()
      return charInstance.app
    }
    return undefined
  }

  /**
   * Add a session to a character instance
   */
  addSession(characterId: string, sessionData: SessionData): void {
    const charInstance = this.characters.get(characterId)

    if (!charInstance) {
      throw new Error(`Character ${characterId} not found in pool`)
    }

    charInstance.sessions.set(sessionData.sessionKey, sessionData)
    charInstance.lastActivity = Date.now()

    console.log(
      `[CharacterPool] Session ${sessionData.sessionKey} added to character ${characterId}. ` +
        `Active sessions: ${charInstance.sessions.size}`,
    )
  }

  /**
   * Get session data for a specific session
   */
  getSession(characterId: string, sessionKey: string): SessionData | undefined {
    const charInstance = this.characters.get(characterId)
    if (!charInstance) {
      return undefined
    }
    return charInstance.sessions.get(sessionKey)
  }

  /**
   * Remove a session from a character instance
   */
  removeSession(characterId: string, sessionKey: string): void {
    const charInstance = this.characters.get(characterId)

    if (!charInstance) {
      return
    }

    charInstance.sessions.delete(sessionKey)
    charInstance.lastActivity = Date.now()

    console.log(
      `[CharacterPool] Session ${sessionKey} removed from character ${characterId}. ` +
        `Remaining sessions: ${charInstance.sessions.size}`,
    )

    // If no sessions remain, character becomes idle and will be cleaned up later
    if (charInstance.sessions.size === 0) {
      console.log(`[CharacterPool] Character ${characterId} now idle`)
    }
  }

  /**
   * Get total session count across all characters
   */
  getTotalSessionCount(): number {
    let total = 0
    for (const charInstance of this.characters.values()) {
      total += charInstance.sessions.size
    }
    return total
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.characters.size
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    const characterMetrics = Array.from(this.characters.entries()).map(([id, instance]) => ({
      characterId: id,
      sessionCount: instance.sessions.size,
      idleTime: Date.now() - instance.lastActivity,
    }))

    return {
      totalCharacters: this.characters.size,
      totalSessions: this.getTotalSessionCount(),
      maxSessions: this.MAX_SESSIONS_PER_CONTAINER,
      utilizationPercent: Math.round(
        (this.getTotalSessionCount() / this.MAX_SESSIONS_PER_CONTAINER) * 100,
      ),
      characters: characterMetrics,
    }
  }

  /**
   * Cleanup idle characters to free resources
   */
  private async cleanupIdleCharacters(): Promise<void> {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [characterId, instance] of this.characters.entries()) {
      // Skip if character has active sessions
      if (instance.sessions.size > 0) {
        continue
      }

      // Check if character has been idle too long
      const idleTime = now - instance.lastActivity
      if (idleTime > this.CHARACTER_IDLE_TIMEOUT) {
        toRemove.push(characterId)
      }
    }

    // Clean up idle characters
    for (const characterId of toRemove) {
      const instance = this.characters.get(characterId)
      if (instance) {
        console.log(
          `[CharacterPool] Cleaning up idle character ${characterId} ` +
            `(idle for ${Math.round((now - instance.lastActivity) / 1000)}s)`,
        )

        try {
          // Gracefully shutdown Inworld app
          await instance.app.shutdown()
        } catch (error) {
          console.error(`[CharacterPool] Error shutting down character ${characterId}:`, error)
        }

        this.characters.delete(characterId)
      }
    }

    if (toRemove.length > 0) {
      console.log(
        `[CharacterPool] Cleaned up ${toRemove.length} idle characters. ` +
          `Remaining: ${this.characters.size}`,
      )
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleCharacters().catch((error) => {
        console.error('[CharacterPool] Cleanup error:', error)
      })
    }, this.CLEANUP_INTERVAL)

    console.log(
      `[CharacterPool] Cleanup timer started (interval: ${this.CLEANUP_INTERVAL / 1000}s)`,
    )
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      console.log('[CharacterPool] Cleanup timer stopped')
    }
  }

  /**
   * Gracefully shutdown all characters
   */
  async shutdown(): Promise<void> {
    console.log('[CharacterPool] Shutting down all characters...')
    this.stopCleanupTimer()

    const promises = Array.from(this.characters.values()).map(async (instance) => {
      try {
        // Close all WebSocket connections
        for (const session of instance.sessions.values()) {
          if (session.websocket && session.websocket.readyState === 1) {
            session.websocket.close(1001, 'Server shutting down')
          }
        }

        // Shutdown Inworld app
        await instance.app.shutdown()
      } catch (error) {
        console.error(`Error shutting down character ${instance.characterId}:`, error)
      }
    })

    await Promise.all(promises)
    this.characters.clear()
    console.log('[CharacterPool] Shutdown complete')
  }
}

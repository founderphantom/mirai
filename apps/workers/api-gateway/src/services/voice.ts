/**
 * Voice Session Service
 *
 * Business logic for voice session management
 */

import type { Env } from '../types/env'
import { drizzle } from 'drizzle-orm/d1'
import {
  voiceSessions,
  conversations,
  characters,
  type NewVoiceSession,
  type NewConversation,
} from '@proj-airi/database-schema'
import { eq, and } from 'drizzle-orm'

export class VoiceSessionService {
  private db

  constructor(private env: Env) {
    this.db = drizzle(env.DB)
  }

  /**
   * Start a new voice session
   */
  async startSession(userId: string, characterId: string) {
    // 1. Verify character ownership
    const character = await this.db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.userId, userId),
        ),
      )
      .limit(1)

    if (!character.length) {
      throw new Error('Character not found')
    }

    // 2. Create conversation record
    const conversationId = crypto.randomUUID()
    const newConversation: NewConversation = {
      id: conversationId,
      userId,
      characterId,
      startedAt: new Date(),
    }

    await this.db.insert(conversations).values(newConversation)

    // 3. Create voice session
    const sessionId = crypto.randomUUID()
    const websocketUrl = `wss://${this.env.BETTER_AUTH_URL.replace(/^https?:\/\//, '')}/api/voice/ws?sessionId=${sessionId}`

    const newSession: NewVoiceSession = {
      id: sessionId,
      conversationId,
      userId,
      characterId,
      status: 'active',
      websocketUrl,
      startedAt: new Date(),
    }

    await this.db.insert(voiceSessions).values(newSession)

    return {
      sessionId,
      conversationId,
      websocketUrl,
      character: character[0],
    }
  }

  /**
   * Get voice session by ID
   */
  async getSession(sessionId: string, userId: string) {
    const result = await this.db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.id, sessionId),
          eq(voiceSessions.userId, userId),
        ),
      )
      .limit(1)

    return result[0] || null
  }

  /**
   * End a voice session
   */
  async endSession(
    sessionId: string,
    userId: string,
    metrics?: {
      durationSeconds?: number
      audioSeconds?: number
    },
  ) {
    // Get session
    const session = await this.getSession(sessionId, userId)
    if (!session) {
      throw new Error('Session not found')
    }

    const endedAt = new Date()

    // Update session
    await this.db
      .update(voiceSessions)
      .set({
        status: 'ended',
        endedAt,
        totalAudioSeconds: metrics?.audioSeconds || 0,
      })
      .where(eq(voiceSessions.id, sessionId))

    // Update conversation
    await this.db
      .update(conversations)
      .set({
        endedAt,
        durationSeconds: metrics?.durationSeconds,
      })
      .where(eq(conversations.id, session.conversationId))

    // Track usage for billing
    if (metrics?.audioSeconds) {
      await this.trackUsage(userId, session.conversationId, metrics.audioSeconds)
    }

    return { success: true }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string) {
    return await this.db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          eq(voiceSessions.status, 'active'),
        ),
      )
      .orderBy(voiceSessions.startedAt)
  }

  /**
   * Track usage for billing
   * @private
   */
  private async trackUsage(
    userId: string,
    conversationId: string,
    audioSeconds: number,
  ) {
    const { usageEvents } = await import('@proj-airi/database-schema')

    const eventId = crypto.randomUUID()
    const minutes = Math.ceil(audioSeconds / 60)

    await this.db.insert(usageEvents).values({
      id: eventId,
      userId,
      eventType: 'voice_minutes',
      quantity: minutes,
      metadata: { conversationId },
      createdAt: new Date(),
      polarSynced: false,
    })

    // TODO: Report to Polar API (async, non-blocking)
    console.log(`[USAGE] Tracked ${minutes} voice minutes for user ${userId}`)
  }
}

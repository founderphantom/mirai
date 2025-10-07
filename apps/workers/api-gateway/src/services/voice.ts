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

/**
 * Session metadata stored in Durable Object state
 */
interface SessionMetadata {
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
}

/**
 * Durable Object for managing WebSocket voice sessions
 * Handles session state and proxies WebSocket traffic to Inworld Container
 */
export class VoiceSession {
  state: DurableObjectState
  env: Env
  private sessionMetadata?: SessionMetadata

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle session initialization
    if (url.pathname === '/init' && request.method === 'POST') {
      const metadata = await request.json() as SessionMetadata
      this.sessionMetadata = metadata

      // Store in Durable Object state for persistence
      await this.state.storage.put('sessionMetadata', metadata)

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Handle WebSocket upgrade
    if (url.pathname === '/websocket') {
      const upgradeHeader = request.headers.get('Upgrade')
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected websocket', { status: 400 })
      }

      // Load session metadata if not in memory
      if (!this.sessionMetadata) {
        this.sessionMetadata = await this.state.storage.get('sessionMetadata')
      }

      if (!this.sessionMetadata) {
        return new Response('Session not initialized', { status: 400 })
      }

      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      this.state.acceptWebSocket(server)

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // TODO: Forward to Inworld Container when container binding is available
    // For now, just log the message
    console.log('Received message from client:', typeof message === 'string' ? message : `Binary data: ${message.byteLength} bytes`)

    // When INWORLD_RUNTIME container binding is added, forward like this:
    // const containerWs = await this.env.INWORLD_RUNTIME.connect({
    //   userId: this.sessionMetadata.userId,
    //   characterId: this.sessionMetadata.inworldCharacterId
    // })
    // containerWs.send(message)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log(`WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`)

    // Clean up session state if needed
    if (this.sessionMetadata) {
      console.log(`Session ${this.sessionMetadata.sessionId} ended`)
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error)
  }
}

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

    // 3. Create voice session via Durable Object
    const voiceSessionId = crypto.randomUUID()
    const durableObjectId = this.env.VOICE_SESSION.idFromName(voiceSessionId)
    const durableObject = this.env.VOICE_SESSION.get(durableObjectId)

    // Initialize Durable Object with session metadata
    await durableObject.fetch('https://internal/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: voiceSessionId,
        conversationId,
        userId,
        characterId,
        inworldCharacterId: character[0].inworldCharacterId,
      }),
    })

    // 4. Store session in D1
    const websocketUrl = `wss://${this.env.BETTER_AUTH_URL.replace(/^https?:\/\//, '')}/api/inworld/ws?sessionId=${voiceSessionId}`

    const newSession: NewVoiceSession = {
      id: voiceSessionId,
      conversationId,
      userId,
      characterId,
      status: 'active',
      websocketUrl,
      startedAt: new Date(),
    }

    await this.db.insert(voiceSessions).values(newSession)

    return {
      sessionId: voiceSessionId,
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

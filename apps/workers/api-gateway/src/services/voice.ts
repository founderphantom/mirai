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
    // 1. Verify character access (either owned by user OR is a preset)
    const character = await this.db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1)

    if (!character.length) {
      throw new Error('Character not found')
    }

    // Verify user has access to this character
    const isOwned = character[0].userId === userId
    const isPreset = character[0].isPreset === true

    if (!isOwned && !isPreset) {
      throw new Error('You do not have access to this character')
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

    // 3. Create session key and metadata
    const sessionKey = crypto.randomUUID()
    const sessionData = {
      sessionId: sessionKey,
      conversationId,
      userId,
      characterId,
      inworldCharacterId: character[0].inworldCharacterId,
      inworldApiKey: this.env.INWORLD_API_KEY,
      agentConfig: character[0].personalityConfig,
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 minutes
    }

    // 4. Store session in KV cache (5 min TTL)
    await this.env.SESSION_CACHE.put(
      `session:${sessionKey}`,
      JSON.stringify(sessionData),
      { expirationTtl: 300 },
    )

    // 5. Store session in D1
    // Use unified domain with service binding for LOWEST latency
    // Flow: Client → stage-web (public) → Voice Agent (service binding) → Container
    // Latency: ~50ms initial (public) + ~0.5-2ms (service binding) = ~50-52ms total
    // vs Direct: ~50ms (public) + ~50ms (public) = ~100ms total
    // Savings: ~45-50ms on initial connection + ~3-8ms per message
    const websocketUrl = `wss://miraichat.app/ws?sessionKey=${sessionKey}`

    // Fallback URLs (for testing different routing):
    // Direct Voice Worker:  wss://voice.miraichat.app/ws?sessionKey=${sessionKey}
    // Via API Gateway:      wss://api.miraichat.app/api/voice/ws?sessionKey=${sessionKey}

    const newSession: NewVoiceSession = {
      id: sessionKey,
      conversationId,
      userId,
      characterId,
      status: 'active',
      websocketUrl,
      startedAt: new Date(),
    }

    await this.db.insert(voiceSessions).values(newSession)

    return {
      sessionId: sessionKey,
      sessionKey, // For backward compatibility
      conversationId,
      websocketUrl,
      character: character[0],
      expiresAt: sessionData.expiresAt,
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
    // Always track usage, even if 0 seconds (for record-keeping and debugging)
    const audioSeconds = metrics?.audioSeconds ?? 0
    console.log(`[VOICE_SERVICE] Tracking usage for session ${sessionId}: ${audioSeconds} seconds`)
    await this.trackUsage(userId, session.conversationId, audioSeconds)

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

    console.log(`[VOICE_SERVICE] Creating usage event:`, {
      userId,
      conversationId,
      audioSeconds,
      minutes,
      eventId,
    })

    await this.db.insert(usageEvents).values({
      id: eventId,
      userId,
      eventType: 'voice_minutes',
      quantity: minutes,
      metadata: { conversationId },
      createdAt: new Date(),
      polarSynced: false,
    })

    console.log(`[VOICE_SERVICE] Successfully tracked ${minutes} voice minutes for user ${userId} (${audioSeconds}s audio)`)

    // TODO: Report to Polar API (async, non-blocking)
  }
}

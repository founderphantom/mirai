/**
 * Session-related types
 */

import type { PersonalityConfig } from '@proj-airi/database-schema'

/**
 * Voice session data stored in KV cache
 * Created by VoiceSessionService.startSession()
 * Retrieved by voice.ts WebSocket handler and stage-web worker
 */
export interface VoiceSessionData {
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
  inworldApiKey: string // Inworld API key for voice agent requests
  agentConfig: PersonalityConfig
  createdAt: number
  expiresAt: number
}

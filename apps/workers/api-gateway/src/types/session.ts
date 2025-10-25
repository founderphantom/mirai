/**
 * Session-related types
 */

import type { PersonalityConfig } from '@proj-airi/database-schema'

/**
 * Voice session data stored in KV cache
 * Created by VoiceSessionService.startSession()
 * Retrieved by voice.ts WebSocket handler
 */
export interface VoiceSessionData {
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
  agentConfig: PersonalityConfig
  createdAt: number
  expiresAt: number
}

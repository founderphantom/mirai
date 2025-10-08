/**
 * Voice Session Manager
 *
 * Manages voice session lifecycle with the API Gateway via service binding
 *
 * Note: Uses relative paths - worker proxies /api/* to API Gateway internally
 */

import { authClient } from '@/lib/auth'
import type { Character } from '../api/characters'

export interface VoiceSession {
  sessionKey: string
  conversationId: string
  websocketUrl: string
  expiresAt: number
}

export interface VoiceSessionMetrics {
  durationSeconds: number
  audioSeconds: number
}

export class VoiceSessionManager {
  /**
   * Start a new voice session with a character
   */
  async startSession(character: Character): Promise<VoiceSession> {
    const session = await authClient.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Use relative path - worker proxies to API Gateway via service binding
    const response = await fetch('/api/voice/session/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        characterId: character.id,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to start voice session',
      })) as { message?: string }
      throw new Error(error.message || 'Failed to start voice session')
    }

    return response.json()
  }

  /**
   * End an active voice session
   */
  async endSession(
    sessionKey: string,
    metrics: VoiceSessionMetrics
  ): Promise<void> {
    const session = await authClient.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Use relative path - worker proxies to API Gateway via service binding
    const response = await fetch(`/api/voice/session/${sessionKey}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(metrics),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to end voice session',
      })) as { message?: string }
      throw new Error(error.message || 'Failed to end voice session')
    }
  }

  /**
   * Get WebSocket URL for voice streaming
   * Constructs proper WebSocket URL based on current page protocol
   */
  getWebSocketUrl(sessionKey: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/api/voice/ws?sessionKey=${sessionKey}`
  }
}

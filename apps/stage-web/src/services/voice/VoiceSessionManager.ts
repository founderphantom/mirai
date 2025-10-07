/**
 * Voice Session Manager
 * Handles voice session lifecycle (start, end) via API Gateway
 */

import { authClient } from '@/lib/auth'
import type { Character } from '@/services/api/characters'

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
  private apiUrl: string
  private wsUrl: string

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL
    this.wsUrl = import.meta.env.VITE_WS_URL
  }

  /**
   * Start a new voice session
   */
  async startSession(character: Character): Promise<VoiceSession> {
    const session = await authClient.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${this.apiUrl}/api/voice/session/start`, {
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
      const error = await response.json()
      throw new Error(error.message || 'Failed to start voice session')
    }

    const data = await response.json()

    // Return session with websocket URL
    return {
      ...data,
      websocketUrl: this.getWebSocketUrl(data.sessionKey),
    }
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

    const response = await fetch(
      `${this.apiUrl}/api/voice/session/${sessionKey}/end`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(metrics),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to end voice session')
    }
  }

  /**
   * Get WebSocket URL for voice streaming
   */
  getWebSocketUrl(sessionKey: string): string {
    return `${this.wsUrl}/api/voice/ws?sessionKey=${sessionKey}`
  }
}

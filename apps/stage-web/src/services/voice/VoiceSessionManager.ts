/**
 * Voice Session Manager
 *
 * Manages voice session lifecycle with the API Gateway
 * Uses VITE_API_URL for direct connection to API Gateway
 */

import { authClient } from '@/lib/auth'
import type { Character } from '../api/characters'

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin

export interface VoiceSession {
  sessionKey: string
  conversationId: string
  websocketUrl: string
  expiresAt: number
}

export interface QuotaError extends Error {
  isQuotaError: boolean
  usage?: any
  upgradeUrl?: string
  percentUsed?: number
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

    const response = await fetch(`${API_BASE_URL}/api/voice/session/start`, {
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
      })) as {
        message?: string
        error?: string
        usage?: any
        upgradeUrl?: string
        action?: string
      }

      // Handle quota exceeded error (403)
      if (response.status === 403 && error.action === 'upgrade_required') {
        const quotaError = new Error(
          error.message || 'Voice minutes quota exceeded'
        ) as QuotaError
        quotaError.isQuotaError = true
        quotaError.usage = error.usage
        quotaError.upgradeUrl = error.upgradeUrl
        throw quotaError
      }

      throw new Error(error.message || error.error || 'Failed to start voice session')
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

    const response = await fetch(`${API_BASE_URL}/api/voice/session/${sessionKey}/end`, {
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
   * Get WebSocket URL for voice streaming (connects through stage-web worker)
   *
   * Architecture: Client → stage-web (/ws) → VOICE_AGENT service binding → container
   * This provides lowest latency using internal Cloudflare service bindings (~0.5-2ms)
   *
   * Constructs proper WebSocket URL based on current page protocol
   */
  getWebSocketUrl(sessionKey: string): string {
    // In development, use environment variable to avoid protocol issues
    const wsBaseUrl = import.meta.env.VITE_WS_URL

    if (wsBaseUrl) {
      // stage-web worker proxies /ws to VOICE_AGENT (see apps/stage-web/src/worker.ts:220)
      return `${wsBaseUrl}/ws?sessionKey=${sessionKey}`
    }

    // Production: Auto-detect from page protocol
    // Uses unified domain for lowest latency (wss://miraichat.app/ws)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/ws?sessionKey=${sessionKey}`
  }

  /**
   * Get WebSocket URL for Workers AI audio streaming (NEW - edge-based VAD/STT)
   * Returns /audio-stream endpoint for real-time subtitles and transcription
   */
  getWorkersAIWebSocketUrl(sessionKey: string): string {
    // In development, use dedicated audio stream WebSocket URL
    const wsBaseUrl = import.meta.env.VITE_AUDIO_STREAM_WS_URL || import.meta.env.VITE_WS_URL

    if (wsBaseUrl) {
      return `${wsBaseUrl}/audio-stream?sessionKey=${sessionKey}`
    }

    // Production: Auto-detect from page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/audio-stream?sessionKey=${sessionKey}`
  }
}

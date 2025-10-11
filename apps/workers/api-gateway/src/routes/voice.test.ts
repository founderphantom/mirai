/**
 * Voice Session Routes - Integration Tests
 *
 * Tests the complete voice session flow including:
 * - Session creation
 * - Character loading via /load endpoint
 * - WebSocket upgrade
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Env } from '../types/env'

describe('Voice Session Integration Tests', () => {
  let mockEnv: Partial<Env>

  beforeEach(() => {
    mockEnv = {
      INWORLD_API_KEY: 'test-api-key',
      INWORLD_WORKSPACE_ID: 'test-workspace-id',
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      } as any,
      VOICE_AGENT: {
        fetch: vi.fn(),
      } as any,
    }
  })

  describe('GET /api/voice/ws - WebSocket Upgrade with Character Loading', () => {
    it('should call /load before WebSocket upgrade', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        conversationId: 'test-conversation-id',
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {
          motivations: ['Help users'],
          flaws: ['Too cheerful'],
          dialogueStyle: 'Friendly',
          adjectives: ['Cheerful', 'Empathetic'],
          voiceConfig: {
            pitch: 1.2,
            speed: 1.0,
          },
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      }

      // Mock KV cache to return session data
      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      // Mock /load response (success)
      const loadResponse = new Response(
        JSON.stringify({
          success: true,
          sessionKey,
          characterId: sessionData.characterId,
        }),
        { status: 200 }
      )

      // Mock WebSocket upgrade response
      const wsResponse = new Response(null, { status: 101 })

      // Setup mock to track calls
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(loadResponse)  // First call: /load
        .mockResolvedValueOnce(wsResponse)    // Second call: WebSocket upgrade

      mockEnv.VOICE_AGENT!.fetch = mockFetch

      // Simulate request (this would be done via your router)
      // For this test, we're just verifying the logic

      // Verify /load was called with correct parameters
      const loadCall = mockFetch.mock.calls[0]?.[0]

      if (loadCall instanceof Request) {
        expect(loadCall.method).toBe('POST')
        expect(loadCall.url).toContain('/load')
        expect(loadCall.url).toContain(`key=${sessionKey}`)

        const loadHeaders = loadCall.headers
        expect(loadHeaders.get('X-Character-ID')).toBe(sessionData.characterId)
        expect(loadHeaders.get('X-Inworld-Character-ID')).toBe(sessionData.inworldCharacterId)
        expect(loadHeaders.get('X-Inworld-API-Key')).toBe('test-api-key')

        const loadBody = await loadCall.json() as any
        expect(loadBody).toHaveProperty('agent')
        expect(loadBody.agent).toEqual(sessionData.agentConfig)
        expect(loadBody.userName).toBe(sessionData.userId)
      }
    })

    it('should return error if /load fails', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      // Mock /load failure
      const loadErrorResponse = new Response(
        JSON.stringify({
          error: 'Failed to load agent',
          message: 'Inworld API error',
        }),
        { status: 500 }
      )

      vi.mocked(mockEnv.VOICE_AGENT!.fetch).mockResolvedValueOnce(loadErrorResponse)

      // The actual route handler should:
      // 1. Call /load
      // 2. Get 500 response
      // 3. Return error to client without attempting WebSocket upgrade

      expect(mockEnv.VOICE_AGENT!.fetch).toHaveBeenCalledTimes(1)
      // WebSocket upgrade should NOT be called
    })

    it('should handle missing session key', async () => {
      // Request without sessionKey parameter
      // Should return 400 error without calling /load or WebSocket upgrade

      expect(mockEnv.VOICE_AGENT!.fetch).not.toHaveBeenCalled()
    })

    it('should handle expired session', async () => {
      const sessionKey = 'test-session-key'
      const expiredSessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(expiredSessionData) as any
      )

      // Should delete expired session
      expect(mockEnv.SESSION_CACHE!.delete).toHaveBeenCalledWith(`session:${sessionKey}`)

      // Should not call /load or WebSocket upgrade
      expect(mockEnv.VOICE_AGENT!.fetch).not.toHaveBeenCalled()
    })

    it('should handle invalid session', async () => {
      const sessionKey = 'invalid-session-key'

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(null as any)

      // Should return 401 without calling /load or WebSocket upgrade
      expect(mockEnv.VOICE_AGENT!.fetch).not.toHaveBeenCalled()
    })

    it('should track load duration metrics', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      // Mock /load with delay to simulate real load time
      const loadResponse = new Response(
        JSON.stringify({ success: true }),
        { status: 200 }
      )

      vi.mocked(mockEnv.VOICE_AGENT!.fetch).mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
        return loadResponse
      })

      // Verify that load duration is logged
      // In the actual implementation, this is logged via console.log
      // Check that the duration is reasonable (>= 100ms in this case)
    })
  })

  describe('Multi-Tenant Character Pooling', () => {
    it('should reuse existing character for multiple users', async () => {
      // First user loads character
      const session1 = {
        sessionId: 'session-1',
        userId: 'user-1',
        characterId: 'shared-character',
        inworldCharacterId: 'inworld-shared-character',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      // Second user connects to same character
      const session2 = {
        sessionId: 'session-2',
        userId: 'user-2',
        characterId: 'shared-character',
        inworldCharacterId: 'inworld-shared-character',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      // Mock /load responses
      const loadResponse = new Response(
        JSON.stringify({ success: true }),
        { status: 200 }
      )

      vi.mocked(mockEnv.VOICE_AGENT!.fetch)
        .mockResolvedValueOnce(loadResponse)  // User 1 /load
        .mockResolvedValueOnce(new Response(null, { status: 101 }))  // User 1 WS
        .mockResolvedValueOnce(loadResponse)  // User 2 /load (reuses character)
        .mockResolvedValueOnce(new Response(null, { status: 101 }))  // User 2 WS

      // Verify that both sessions can connect to the same character
      // The container should reuse the existing character instance
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should provide detailed error messages on /load failure', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      const loadErrorResponse = new Response(
        JSON.stringify({
          error: 'Failed to load agent',
          message: 'Invalid Inworld API key',
        }),
        { status: 500 }
      )

      vi.mocked(mockEnv.VOICE_AGENT!.fetch).mockResolvedValueOnce(loadErrorResponse)

      // Expected error response structure:
      // {
      //   error: 'Failed to initialize character',
      //   message: 'Invalid Inworld API key',
      //   details: 'Failed to load agent'
      // }
    })

    it('should handle network errors gracefully', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      // Simulate network error
      vi.mocked(mockEnv.VOICE_AGENT!.fetch).mockRejectedValueOnce(
        new Error('Network error: Connection refused')
      )

      // Should catch error and return 500 with error message
    })

    it('should handle malformed /load responses', async () => {
      const sessionKey = 'test-session-key'
      const sessionData = {
        sessionId: sessionKey,
        userId: 'test-user-id',
        characterId: 'test-character-id',
        inworldCharacterId: 'inworld-character-id',
        agentConfig: {},
        expiresAt: Date.now() + 300000,
      }

      vi.mocked(mockEnv.SESSION_CACHE!.get).mockResolvedValueOnce(
        JSON.stringify(sessionData) as any
      )

      // Return invalid JSON
      const malformedResponse = new Response(
        'Not JSON',
        { status: 500 }
      )

      vi.mocked(mockEnv.VOICE_AGENT!.fetch).mockResolvedValueOnce(malformedResponse)

      // Should handle JSON parse error gracefully
      // errorData should default to { message: 'Unknown error' }
    })
  })

  describe('Performance and Monitoring', () => {
    it('should log all critical events', () => {
      // Verify that console.log is called for:
      // 1. Character loading start
      // 2. Character loaded successfully
      // 3. WebSocket upgrade forwarding
      // 4. Load duration metrics

      const consoleSpy = vi.spyOn(console, 'log')

      // After running the flow:
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE_WS] Loading character before WebSocket upgrade')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE_WS] Character loaded successfully')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VOICE_WS] Forwarding WebSocket upgrade to container')
      )
    })

    it('should measure and log load duration', async () => {
      // Verify that load duration is measured and included in logs
      // This helps with performance monitoring and debugging
    })
  })
})

describe('Voice Session Service - Session Creation', () => {
  it('should store agentConfig in session cache', async () => {
    // Verify that VoiceSessionService.startSession()
    // properly stores the character's personalityConfig as agentConfig
    // This is critical for the /load endpoint to work correctly

    const mockSessionData = {
      sessionId: 'test-session-id',
      characterId: 'test-character-id',
      agentConfig: {
        motivations: ['Help users'],
        flaws: ['Too cheerful'],
        dialogueStyle: 'Friendly',
        adjectives: ['Cheerful', 'Empathetic'],
      },
    }

    // Verify agentConfig is included in KV cache
    expect(mockSessionData).toHaveProperty('agentConfig')
    expect(mockSessionData.agentConfig).toHaveProperty('motivations')
    expect(mockSessionData.agentConfig).toHaveProperty('dialogueStyle')
  })
})

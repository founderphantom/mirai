/**
 * Audio Streaming Routes with Workers AI
 *
 * Handles WebSocket connections for audio streaming with:
 * - Real-time VAD using Workers AI (smart-turn-v2)
 * - Real-time STT using Workers AI (Deepgram Flux)
 * - Real-time subtitle streaming to client
 * - Text input to voice agent container when speech completes
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'
import type { VoiceSessionData } from '../types/session'
import { AudioStreamService } from '../services/audio-stream'

const audioStreamRoutes = new Hono<HonoEnv>()

/**
 * GET /api/audio/stream?sessionKey=xxx
 * WebSocket endpoint for audio streaming with Workers AI VAD/STT
 *
 * Message Protocol:
 *   Client -> Server:
 *     - Binary: Raw PCM audio data (16kHz, 16-bit)
 *     - Text: { "type": "ping" } for keepalive
 *
 *   Server -> Client:
 *     - Text: { "type": "subtitle", "text": "...", "is_partial": true/false }
 *     - Text: { "type": "vad", "is_complete": true/false, "probability": 0-1 }
 *     - Text: { "type": "agent_response", "data": {...} } (from voice agent)
 */
audioStreamRoutes.get('/stream', async (c) => {
  try {
    // 1. Get and validate session key
    const sessionKey = c.req.query('sessionKey')

    if (!sessionKey) {
      console.error('[AUDIO_STREAM] Missing session key')
      return c.json({ error: 'Missing session key' }, 400)
    }

    // 2. Validate session from KV cache
    const sessionData = await c.env.SESSION_CACHE.get<VoiceSessionData>(
      `session:${sessionKey}`,
      { type: 'json' }
    )

    if (!sessionData) {
      console.error('[AUDIO_STREAM] Invalid or expired session:', sessionKey)
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    // 3. Check expiration
    if (Date.now() > sessionData.expiresAt) {
      console.error('[AUDIO_STREAM] Session expired:', sessionKey)
      await c.env.SESSION_CACHE.delete(`session:${sessionKey}`)
      return c.json({ error: 'Session expired' }, 401)
    }

    // 4. Check if WebSocket upgrade
    const upgradeHeader = c.req.header('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return c.json({ error: 'Expected WebSocket upgrade' }, 426)
    }

    console.log('[AUDIO_STREAM] WebSocket connection initiated:', {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
    })

    // 5. Create WebSocket pair
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // 6. Accept WebSocket connection
    server.accept()

    // 7. Set up audio streaming service
    const audioService = new AudioStreamService(c.env, {
      sessionKey,
      userId: sessionData.userId,
      characterId: sessionData.characterId,
    })

    // 8. Handle WebSocket messages
    server.addEventListener('message', async (event) => {
      try {
        // Handle binary audio data
        if (event.data instanceof ArrayBuffer) {
          const audioData = new Uint8Array(event.data)

          // Process audio chunk
          const result = await audioService.processAudioChunk(audioData)

          // Send partial transcription for real-time subtitles
          if (result.transcription) {
            server.send(JSON.stringify({
              type: 'subtitle',
              text: result.transcription.text,
              is_partial: result.transcription.is_partial,
              timestamp: Date.now(),
            }))
          }

          // Send VAD status
          if (result.vadResult) {
            server.send(JSON.stringify({
              type: 'vad',
              is_complete: result.vadResult.is_complete,
              probability: result.vadResult.probability,
              timestamp: Date.now(),
            }))
          }

          // If speech is complete, send to voice agent
          if (result.shouldSendToAgent && result.transcription) {
            const success = await audioService.sendToVoiceAgent(
              result.transcription.text
            )

            if (!success) {
              server.send(JSON.stringify({
                type: 'error',
                message: 'Failed to send transcription to voice agent',
                timestamp: Date.now(),
              }))
            }
          }
        }
        // Handle text messages (control messages, ping, etc.)
        else if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data)

            // Handle ping
            if (message.type === 'ping') {
              server.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now(),
              }))
            }
            // Handle debug/status requests
            else if (message.type === 'status') {
              server.send(JSON.stringify({
                type: 'status',
                buffer: audioService.getBufferState(),
                timestamp: Date.now(),
              }))
            }
          } catch (error) {
            console.error('[AUDIO_STREAM] Invalid text message:', error)
          }
        }
      } catch (error) {
        console.error('[AUDIO_STREAM] Message processing error:', error)
        server.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        }))
      }
    })

    // 9. Handle WebSocket close
    server.addEventListener('close', () => {
      console.log('[AUDIO_STREAM] WebSocket closed:', {
        sessionKey,
        userId: sessionData.userId,
      })
    })

    // 10. Handle WebSocket errors
    server.addEventListener('error', (error) => {
      console.error('[AUDIO_STREAM] WebSocket error:', {
        sessionKey,
        error,
      })
    })

    // 11. Return WebSocket upgrade response
    return new Response(null, {
      status: 101,
      webSocket: client,
    })

  } catch (error) {
    console.error('[AUDIO_STREAM] WebSocket setup error:', error)
    return c.json(
      {
        error: 'Failed to establish WebSocket connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

export default audioStreamRoutes

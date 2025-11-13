/**
 * Audio Streaming Service with Workers AI
 *
 * Handles real-time audio processing using Workers AI models:
 * - @cf/pipecat-ai/smart-turn-v2 for Voice Activity Detection (VAD)
 * - @cf/deepgram/flux for Speech-to-Text (STT) via WebSocket streaming
 *
 * Flux is specifically designed for real-time conversational AI and provides:
 * - Native 16-bit PCM support (no conversion needed)
 * - Streaming transcription with partial updates
 * - Automatic end-of-turn detection
 * - Low latency for conversational experiences
 */

export interface AudioStreamConfig {
  sessionKey: string
  userId: string
  characterId: string
}

export interface VADResult {
  is_complete: boolean
  probability: number
}

export interface STTResult {
  text: string
  is_partial: boolean
}

// Flux WebSocket event types
export interface FluxUpdateEvent {
  type: 'Update'
  transcript: string
  confidence: number
}

export interface FluxEndOfTurnEvent {
  type: 'EndOfTurn'
  transcript: string
  confidence: number
}

export interface FluxStartOfTurnEvent {
  type: 'StartOfTurn'
}

export interface FluxEagerEndOfTurnEvent {
  type: 'EagerEndOfTurn'
  transcript: string
  confidence: number
}

export type FluxEvent = FluxUpdateEvent | FluxEndOfTurnEvent | FluxStartOfTurnEvent | FluxEagerEndOfTurnEvent

export interface VoiceSessionData {
  sessionKey: string
  userId: string
  characterId: string
  conversationId: string
  inworldCharacterId: string
  inworldApiKey: string // Inworld API key for voice agent requests
  createdAt: number
  expiresAt: number
}

export class AudioStreamService {
  private env: {
    AI: Ai
    SESSION_CACHE: KVNamespace
    VOICE_AGENT: Fetcher
  }
  private config: AudioStreamConfig

  // Audio processing configuration
  private readonly SAMPLE_RATE = 16000 // Hz
  private readonly VAD_THRESHOLD = 0.8 // Confidence threshold for speech detection

  // Flux WebSocket for real-time STT
  private fluxWebSocket: WebSocket | null = null
  private fluxReady: boolean = false

  // Current transcription state
  private currentTranscript: string = ''
  private lastTranscriptUpdate: number = Date.now()

  // VAD state (for UI feedback only, Flux handles turn detection)
  private speechStartTime: number | null = null
  private lastVADCheck: number = Date.now()

  // Callback for sending transcription updates to client
  private onTranscriptionUpdate: ((result: STTResult) => void) | null = null
  private onTranscriptionComplete: ((text: string) => Promise<void>) | null = null

  constructor(
    env: { AI: Ai; SESSION_CACHE: KVNamespace; VOICE_AGENT: Fetcher },
    config: AudioStreamConfig,
  ) {
    this.env = env
    this.config = config
  }

  /**
   * Initialize Flux WebSocket connection for real-time STT
   * Must be called before processing audio
   */
  async initializeFluxConnection(
    onTranscriptionUpdate: (result: STTResult) => void,
    onTranscriptionComplete: (text: string) => Promise<void>,
  ): Promise<void> {
    this.onTranscriptionUpdate = onTranscriptionUpdate
    this.onTranscriptionComplete = onTranscriptionComplete

    try {
      console.log('[AUDIO_STREAM] Initializing Flux WebSocket connection')

      // Establish WebSocket connection to Flux
      // @ts-expect-error - Workers AI WebSocket API
      const response = await this.env.AI.run(
        '@cf/deepgram/flux',
        {
          encoding: 'linear16', // 16-bit PCM
          sample_rate: '16000', // 16kHz
        },
        {
          websocket: true,
        },
      )

      // Get WebSocket from response
      // @ts-expect-error - Workers AI WebSocket response type
      this.fluxWebSocket = response.webSocket
      this.fluxReady = false

      // Set up event handlers
      this.fluxWebSocket.addEventListener('open', () => {
        this.fluxReady = true
        console.log('[AUDIO_STREAM] Flux WebSocket connected')
      })

      this.fluxWebSocket.addEventListener('message', (event) => {
        this.handleFluxEvent(event.data)
      })

      this.fluxWebSocket.addEventListener('error', (error) => {
        console.error('[AUDIO_STREAM] Flux WebSocket error:', error)
        this.fluxReady = false
      })

      this.fluxWebSocket.addEventListener('close', () => {
        console.log('[AUDIO_STREAM] Flux WebSocket closed')
        this.fluxReady = false
      })

      // Accept the WebSocket connection
      this.fluxWebSocket.accept()

      console.log('[AUDIO_STREAM] Flux WebSocket initialized')
    } catch (error) {
      console.error('[AUDIO_STREAM] Failed to initialize Flux WebSocket:', error)
      throw error
    }
  }

  /**
   * Handle Flux WebSocket events
   */
  private async handleFluxEvent(data: string | ArrayBuffer): Promise<void> {
    try {
      if (typeof data !== 'string') {
        return
      }

      const event = JSON.parse(data) as FluxEvent

      console.log('[AUDIO_STREAM] Flux event:', {
        type: event.type,
        sessionKey: this.config.sessionKey,
      })

      switch (event.type) {
        case 'StartOfTurn':
          console.log('[AUDIO_STREAM] Flux: User started speaking')
          this.currentTranscript = ''
          break

        case 'Update':
          // Partial transcription - send to frontend for real-time subtitles
          console.log('[AUDIO_STREAM] Flux partial transcription:', event.transcript)
          this.currentTranscript = event.transcript
          this.lastTranscriptUpdate = Date.now()

          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate({
              text: event.transcript,
              is_partial: true,
            })
          }
          break

        case 'EagerEndOfTurn':
          // Quick turn detection - send partial result
          console.log('[AUDIO_STREAM] Flux eager end of turn:', event.transcript)
          this.currentTranscript = event.transcript

          if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate({
              text: event.transcript,
              is_partial: false,
            })
          }
          break

        case 'EndOfTurn':
          // Final transcription - send to voice agent
          console.log('[AUDIO_STREAM] Flux end of turn (final):', event.transcript)
          const finalText = event.transcript || this.currentTranscript

          if (finalText && this.onTranscriptionComplete) {
            await this.onTranscriptionComplete(finalText)
          }

          // Reset state
          this.currentTranscript = ''
          break
      }
    } catch (error) {
      console.error('[AUDIO_STREAM] Error handling Flux event:', error)
    }
  }

  /**
   * Process audio chunk with VAD and stream to Flux
   * VAD is used for UI feedback, Flux handles turn detection and transcription
   */
  async processAudioChunk(audioData: Uint8Array): Promise<{
    vadResult?: VADResult
  }> {
    // Stream audio to Flux WebSocket immediately (no buffering)
    if (this.fluxReady && this.fluxWebSocket) {
      try {
        // Send raw PCM audio directly to Flux
        this.fluxWebSocket.send(audioData.buffer)
      } catch (error) {
        console.error('[AUDIO_STREAM] Failed to send audio to Flux:', error)
      }
    }

    // Run VAD for UI feedback (every 300ms)
    const now = Date.now()
    if (now - this.lastVADCheck < 300) {
      return {}
    }

    this.lastVADCheck = now

    // Run VAD to detect if user is speaking (for UI feedback only)
    const vadResult = await this.runVAD(audioData)

    // Track speech start time for UI
    if (vadResult.probability > this.VAD_THRESHOLD && !this.speechStartTime) {
      this.speechStartTime = now
      console.log('[AUDIO_STREAM] Speech started (VAD):', {
        sessionKey: this.config.sessionKey,
        probability: vadResult.probability,
      })
    }

    // Reset speech start time when VAD indicates silence
    if (vadResult.probability < this.VAD_THRESHOLD && this.speechStartTime) {
      this.speechStartTime = null
      console.log('[AUDIO_STREAM] Speech stopped (VAD):', {
        sessionKey: this.config.sessionKey,
      })
    }

    return {
      vadResult,
    }
  }

  /**
   * Run Voice Activity Detection using smart-turn-v2
   */
  private async runVAD(audioData: Uint8Array): Promise<VADResult> {
    try {
      // Convert Uint8Array to base64 for Workers AI
      const base64Audio = this.arrayBufferToBase64(audioData.buffer)

      const response = (await this.env.AI.run('@cf/pipecat-ai/smart-turn-v2', {
        audio: base64Audio,
        dtype: 'uint8', // PCM data format (uint8, float32, or float64)
      })) as VADResult

      return response
    } catch (error) {
      console.error('[AUDIO_STREAM] VAD error:', error)

      // Return safe defaults on error
      return {
        is_complete: false,
        probability: 0,
      }
    }
  }


  /**
   * Send final transcription to voice agent container via HTTP POST to /text endpoint
   * The voice agent will process the text through Inworld Runtime (LLM + TTS)
   * and stream the response back via the existing WebSocket connection
   */
  async sendToVoiceAgent(text: string): Promise<boolean> {
    try {
      console.log('[AUDIO_STREAM] Sending transcription to voice agent:', {
        sessionKey: this.config.sessionKey,
        textLength: text.length,
        text: text.substring(0, 100), // Log first 100 chars
      })

      // Get session data from cache
      const sessionData = await this.env.SESSION_CACHE.get<VoiceSessionData>(
        `session:${this.config.sessionKey}`,
        { type: 'json' },
      )

      if (!sessionData) {
        console.error('[AUDIO_STREAM] Session not found:', this.config.sessionKey)
        return false
      }

      // Send text to voice agent container via service binding
      // The container worker expects:
      // - Headers: X-User-ID, X-Inworld-API-Key (for authentication)
      // - Headers: X-Session-Key, X-Character-ID, X-Inworld-Character-ID (for routing)
      // - Body: { text: string }
      const response = await this.env.VOICE_AGENT.fetch(
        new Request('http://voice-agent/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Authentication headers (required by container worker)
            'X-User-ID': this.config.userId,
            'X-Inworld-API-Key': sessionData.inworldApiKey,
            // Session/routing headers (required by container server)
            'X-Session-Key': this.config.sessionKey,
            'X-Character-ID': this.config.characterId,
            'X-Inworld-Character-ID': sessionData.inworldCharacterId,
          },
          body: JSON.stringify({ text }),
        }),
      )

      if (!response.ok) {
        const error = await response.text()
        console.error('[AUDIO_STREAM] Failed to send to voice agent:', {
          status: response.status,
          error,
        })
        return false
      }

      const result = await response.json()
      console.log('[AUDIO_STREAM] Voice agent response:', result)

      return true
    } catch (error) {
      console.error('[AUDIO_STREAM] Error sending to voice agent:', error)
      return false
    }
  }


  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Cleanup and close Flux WebSocket
   */
  cleanup(): void {
    if (this.fluxWebSocket) {
      try {
        this.fluxWebSocket.close()
      } catch (error) {
        console.error('[AUDIO_STREAM] Error closing Flux WebSocket:', error)
      }
      this.fluxWebSocket = null
      this.fluxReady = false
    }

    this.currentTranscript = ''
    this.speechStartTime = null

    console.log('[AUDIO_STREAM] Cleanup complete')
  }

  /**
   * Get current state (for debugging)
   */
  getState(): {
    fluxReady: boolean
    currentTranscript: string
    speechStartTime: number | null
    hasSpeech: boolean
  } {
    return {
      fluxReady: this.fluxReady,
      currentTranscript: this.currentTranscript,
      speechStartTime: this.speechStartTime,
      hasSpeech: this.speechStartTime !== null,
    }
  }
}

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
// Note: Flux sends 'event' field, not 'type' field
export interface FluxUpdateEvent {
  event: 'Update'
  transcript: string
  confidence: number
}

export interface FluxEndOfTurnEvent {
  event: 'EndOfTurn'
  transcript: string
  confidence: number
}

export interface FluxStartOfTurnEvent {
  event: 'StartOfTurn'
}

export interface FluxEagerEndOfTurnEvent {
  event: 'EagerEndOfTurn'
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

  // VAD state (for UI feedback)
  private speechStartTime: number | null = null
  private lastVADCheck: number = Date.now()

  // Callback for handling transcription from client (client connects directly to Flux)
  private onTranscriptionFromClient: ((text: string) => Promise<void>) | null = null

  constructor(
    env: { AI: Ai; SESSION_CACHE: KVNamespace; VOICE_AGENT: Fetcher },
    config: AudioStreamConfig,
  ) {
    this.env = env
    this.config = config
  }

  /**
   * Set callback for handling transcription from client
   * Client now connects directly to Flux and forwards final transcriptions here
   */
  setTranscriptionCallback(onTranscriptionFromClient: (text: string) => Promise<void>): void {
    this.onTranscriptionFromClient = onTranscriptionFromClient
  }

  /**
   * Handle transcription received from client (via Flux WebSocket)
   * Client connects directly to /flux-stt and sends final transcriptions here
   */
  async handleTranscriptionFromClient(text: string): Promise<void> {
    if (this.onTranscriptionFromClient) {
      await this.onTranscriptionFromClient(text)
    }
  }

  /**
   * Process audio chunk with VAD for UI feedback
   * Note: Audio is also sent directly to Flux via client's separate WebSocket connection
   */
  async processAudioChunk(audioData: Uint8Array): Promise<{
    vadResult?: VADResult
  }> {
    // Run VAD for UI feedback (every 300ms to reduce load)
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
   * Cleanup resources
   */
  cleanup(): void {
    this.speechStartTime = null
    this.onTranscriptionFromClient = null
    console.log('[AUDIO_STREAM] Cleanup complete')
  }

  /**
   * Get current state (for debugging)
   */
  getState(): {
    speechStartTime: number | null
    hasSpeech: boolean
  } {
    return {
      speechStartTime: this.speechStartTime,
      hasSpeech: this.speechStartTime !== null,
    }
  }
}

/**
 * Audio Streaming Service with Workers AI
 *
 * Handles real-time audio processing using Workers AI models:
 * - smart-turn-v2 for Voice Activity Detection (VAD)
 * - Deepgram Flux for Speech-to-Text (STT)
 *
 * This processes audio at the edge closest to the user for minimal latency.
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
    VOICE_AGENT: Fetcher // Re-enabled for voice agent integration
  }
  private config: AudioStreamConfig

  // Audio processing configuration
  private readonly SAMPLE_RATE = 16000 // Hz
  private readonly CHUNK_SIZE = 1024 // samples per chunk
  private readonly VAD_THRESHOLD = 0.8 // Confidence threshold for speech detection
  private readonly MIN_SPEECH_DURATION_MS = 500 // Minimum speech duration to process (increased from 200ms)
  private readonly MIN_AUDIO_BYTES = 8000 // Minimum bytes for STT (0.25s at 16kHz 16-bit = 8000 bytes)

  // Buffering
  private audioBuffer: Uint8Array[] = []
  private speechStartTime: number | null = null
  private lastVADCheck: number = Date.now()

  constructor(
    env: { AI: Ai; SESSION_CACHE: KVNamespace; VOICE_AGENT: Fetcher },
    config: AudioStreamConfig,
  ) {
    this.env = env
    this.config = config
  }

  /**
   * Process audio chunk with VAD and STT
   * Returns partial transcription for real-time subtitles
   */
  async processAudioChunk(audioData: Uint8Array): Promise<{
    transcription?: STTResult
    vadResult?: VADResult
    shouldSendToAgent: boolean
  }> {
    // Add to buffer
    this.audioBuffer.push(audioData)

    // Check if enough time has passed for VAD check (every 300ms)
    const now = Date.now()
    if (now - this.lastVADCheck < 300) {
      return { shouldSendToAgent: false }
    }

    this.lastVADCheck = now

    // Run VAD to detect if user is speaking
    const vadResult = await this.runVAD(audioData)

    // Track speech start time
    if (vadResult.probability > this.VAD_THRESHOLD && !this.speechStartTime) {
      this.speechStartTime = now
      console.log('[AUDIO_STREAM] Speech started:', {
        sessionKey: this.config.sessionKey,
        probability: vadResult.probability,
      })
    }

    // If we have accumulated speech data, run STT
    let transcription: STTResult | undefined
    if (this.speechStartTime && this.audioBuffer.length > 0) {
      const speechDuration = now - this.speechStartTime
      const combinedAudio = this.combineBufferedAudio()

      // Only transcribe if minimum speech duration AND minimum audio bytes met
      if (
        speechDuration >= this.MIN_SPEECH_DURATION_MS &&
        combinedAudio.length >= this.MIN_AUDIO_BYTES
      ) {
        console.log('[AUDIO_STREAM] Running partial STT:', {
          sessionKey: this.config.sessionKey,
          bufferChunks: this.audioBuffer.length,
          audioBytes: combinedAudio.length,
          speechDuration,
        })
        transcription = await this.runSTT(combinedAudio, false)
      } else {
        console.log('[AUDIO_STREAM] Skipping partial STT (insufficient audio):', {
          sessionKey: this.config.sessionKey,
          speechDuration,
          audioBytes: combinedAudio.length,
          required: this.MIN_AUDIO_BYTES,
        })
      }
    }

    // Check if speech is complete
    const isComplete =
      vadResult.is_complete ||
      (vadResult.probability < this.VAD_THRESHOLD && this.speechStartTime !== null)

    if (isComplete && this.speechStartTime) {
      const speechDuration = now - this.speechStartTime

      console.log('[AUDIO_STREAM] Speech completed:', {
        sessionKey: this.config.sessionKey,
        duration: speechDuration,
        bufferSize: this.audioBuffer.length,
      })

      // Get final transcription
      if (this.audioBuffer.length > 0) {
        const combinedAudio = this.combineBufferedAudio()

        console.log('[AUDIO_STREAM] Running final STT:', {
          sessionKey: this.config.sessionKey,
          bufferChunks: this.audioBuffer.length,
          audioBytes: combinedAudio.length,
          speechDuration,
        })

        // Only run STT if we have enough audio data
        if (combinedAudio.length >= this.MIN_AUDIO_BYTES) {
          transcription = await this.runSTT(combinedAudio, true)
        } else {
          console.log('[AUDIO_STREAM] Skipping final STT (insufficient audio):', {
            sessionKey: this.config.sessionKey,
            audioBytes: combinedAudio.length,
            required: this.MIN_AUDIO_BYTES,
          })
        }
      } else {
        console.log('[AUDIO_STREAM] No audio buffer for final transcription:', {
          sessionKey: this.config.sessionKey,
        })
      }

      // Reset state
      this.clearBuffer()
      this.speechStartTime = null

      return {
        transcription,
        vadResult,
        shouldSendToAgent: true,
      }
    }

    return {
      transcription,
      vadResult,
      shouldSendToAgent: false,
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
   * Run Speech-to-Text using Deepgram Flux
   */
  private async runSTT(audioData: Uint8Array, isFinal: boolean): Promise<STTResult> {
    try {
      // Log audio data details
      const audioLength = audioData.length
      const durationSeconds = audioLength / (this.SAMPLE_RATE * 2) // 16-bit = 2 bytes per sample

      console.log('[AUDIO_STREAM] STT input:', {
        sessionKey: this.config.sessionKey,
        audioLength,
        durationSeconds: durationSeconds.toFixed(2),
        isFinal,
      })

      // Convert audio to base64
      const base64Audio = this.arrayBufferToBase64(audioData.buffer)

      console.log('[AUDIO_STREAM] STT base64 length:', base64Audio.length)

      // Run Deepgram Flux STT model with correct parameters
      const response = (await this.env.AI.run('@cf/deepgram/flux', {
        audio: base64Audio,
        encoding: 'linear16', // Linear16 (raw signed little-endian 16-bit PCM)
        sample_rate: '16000', // 16kHz sample rate (as string per API requirements)
      })) as { text: string }

      console.log('[AUDIO_STREAM] STT response:', {
        sessionKey: this.config.sessionKey,
        text: response.text,
        textLength: response.text?.length || 0,
        isFinal,
        fullResponse: JSON.stringify(response), // Log full response to see if there are other fields
      })

      return {
        text: response.text || '',
        is_partial: !isFinal,
      }
    } catch (error) {
      console.error('[AUDIO_STREAM] STT error:', error)

      return {
        text: '',
        is_partial: !isFinal,
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
   * Combine buffered audio chunks into single Uint8Array
   */
  private combineBufferedAudio(): Uint8Array {
    const totalLength = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of this.audioBuffer) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    return combined
  }

  /**
   * Clear audio buffer
   */
  private clearBuffer(): void {
    this.audioBuffer = []
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
   * Get current buffer state (for debugging)
   */
  getBufferState(): {
    bufferSize: number
    speechStartTime: number | null
    hasSpeech: boolean
  } {
    return {
      bufferSize: this.audioBuffer.length,
      speechStartTime: this.speechStartTime,
      hasSpeech: this.speechStartTime !== null,
    }
  }
}

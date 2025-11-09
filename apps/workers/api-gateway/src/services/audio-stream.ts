/**
 * Audio Streaming Service with Workers AI
 *
 * Handles real-time audio processing using Workers AI models:
 * - smart-turn-v2 for Voice Activity Detection (VAD)
 * - Deepgram Flux for Speech-to-Text (STT)
 *
 * This replaces the container-based VAD/STT for better performance
 * and real-time subtitle support.
 */

import type { Env } from '../types/env'

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

export class AudioStreamService {
  private env: Env
  private config: AudioStreamConfig

  // Audio processing configuration
  private readonly SAMPLE_RATE = 16000 // Hz
  private readonly CHUNK_SIZE = 1024 // samples per chunk
  private readonly VAD_THRESHOLD = 0.8 // Confidence threshold for speech detection
  private readonly MIN_SPEECH_DURATION_MS = 200 // Minimum speech duration to process

  // Buffering
  private audioBuffer: Uint8Array[] = []
  private speechStartTime: number | null = null
  private lastVADCheck: number = Date.now()

  constructor(env: Env, config: AudioStreamConfig) {
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

      // Only transcribe if minimum speech duration met
      if (speechDuration >= this.MIN_SPEECH_DURATION_MS) {
        transcription = await this.runSTT(this.combineBufferedAudio(), false)
      }
    }

    // Check if speech is complete
    const isComplete = vadResult.is_complete ||
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
        transcription = await this.runSTT(this.combineBufferedAudio(), true)
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

      const response = await this.env.AI.run('@cf/pipecat-ai/smart-turn-v2', {
        audio: base64Audio,
      }) as VADResult

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
      // Convert audio to base64
      const base64Audio = this.arrayBufferToBase64(audioData.buffer)

      // Run Deepgram Flux STT model
      const response = await this.env.AI.run('@cf/deepgram/flux', {
        audio: base64Audio,
        // Flux-specific parameters for conversational AI
        smart_format: true, // Enable smart formatting for conversational text
        punctuate: true, // Add punctuation
        utterances: true, // Split into utterances
      }) as { text: string }

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
   * Send final transcription to voice agent container
   */
  async sendToVoiceAgent(text: string): Promise<boolean> {
    try {
      console.log('[AUDIO_STREAM] Sending transcription to voice agent:', {
        sessionKey: this.config.sessionKey,
        textLength: text.length,
        text: text.substring(0, 100), // Log first 100 chars
      })

      // Get session data from cache
      const sessionData = await this.env.SESSION_CACHE.get(
        `session:${this.config.sessionKey}`,
        { type: 'json' }
      )

      if (!sessionData) {
        console.error('[AUDIO_STREAM] Session not found:', this.config.sessionKey)
        return false
      }

      // Send text to voice agent container via service binding
      const response = await this.env.VOICE_AGENT.fetch(
        new Request('http://voice-agent/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Key': this.config.sessionKey,
            'X-User-ID': this.config.userId,
            'X-Character-ID': this.config.characterId,
          },
          body: JSON.stringify({ text }),
        })
      )

      if (!response.ok) {
        const error = await response.text()
        console.error('[AUDIO_STREAM] Failed to send to voice agent:', error)
        return false
      }

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

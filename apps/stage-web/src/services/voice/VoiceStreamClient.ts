/**
 * Voice Stream Client
 *
 * Handles WebSocket communication for real-time voice streaming
 * - Captures microphone audio and sends to server
 * - Receives and plays TTS audio from server
 * - Manages transcript and emotion events
 */

export interface TranscriptMessage {
  type: 'transcript'
  text: string
  speaker: 'USER' | 'CHARACTER'
  timestamp: number
}

export interface EmotionMessage {
  type: 'emotion'
  emotion: string
  intensity: number
  timestamp: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
  code: string
  timestamp: number
}

export type VoiceMessage = TranscriptMessage | EmotionMessage | ErrorMessage

export interface VoiceStreamCallbacks {
  onTranscript?: (text: string, speaker: string) => void
  onEmotion?: (emotion: string, intensity: number) => void
  onAudio?: (audioData: ArrayBuffer) => void
  onError?: (error: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export class VoiceStreamClient {
  private ws: WebSocket | null = null
  private captureAudioContext: AudioContext | null = null // For microphone capture (16kHz)
  private playbackAudioContext: AudioContext | null = null // For TTS playback (24kHz)
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isMuted = false
  private startTime: number = 0
  private audioPlayedSeconds = 0

  // Audio buffering for interval-based sending (Inworld template pattern)
  private audioBuffer: Float32Array[] = []
  private sendInterval: NodeJS.Timeout | null = null

  // Audio playback queue to prevent overlapping
  private audioQueue: ArrayBuffer[] = []
  private isPlayingAudio = false

  // Track if character is currently speaking to block user input
  private isCharacterSpeaking = false

  // Gapless playback with crossfade (Inworld template pattern)
  private nextStartTime = 0
  private fadeTime = 0.005 // 5ms crossfade to eliminate clicks
  private gainNode: GainNode | null = null
  private currentSources: AudioBufferSourceNode[] = []

  constructor(private callbacks: VoiceStreamCallbacks) {}

  /**
   * Connect to voice stream WebSocket
   */
  async connect(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[VoiceStream] Connecting to:', websocketUrl)
        this.ws = new WebSocket(websocketUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[VoiceStream] WebSocket connected successfully')
          this.startTime = Date.now()
          this.callbacks.onOpen?.()
          resolve()
        }

        this.ws.onerror = (error) => {
          console.error('[VoiceStream] WebSocket error:', error)
          const errorMsg = 'Failed to connect to voice service'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.ws.onclose = (event) => {
          console.log('[VoiceStream] WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })
          this.callbacks.onClose?.()
          this.cleanup()
        }

        this.ws.onmessage = async (event) => {
          await this.handleMessage(event.data)
        }
      } catch (error) {
        console.error('[VoiceStream] Connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Start capturing microphone audio
   */
  async startAudioCapture(): Promise<void> {
    try {
      console.log('[VoiceStream] Requesting microphone access...')

      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      })

      console.log('[VoiceStream] Microphone access granted')

      // Verify WebSocket is still open
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('[VoiceStream] WebSocket not open, state:', this.ws?.readyState)
        throw new Error('WebSocket connection lost')
      }

      // Create audio context for capture (16kHz for voice input)
      this.captureAudioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.captureAudioContext.createMediaStreamSource(this.mediaStream)

      console.log('[VoiceStream] Capture audio context created, sample rate:', this.captureAudioContext.sampleRate)

      // Create audio processor
      this.scriptProcessor = this.captureAudioContext.createScriptProcessor(4096, 1, 1)

      // Buffer audio chunks instead of sending immediately (Inworld template pattern)
      this.scriptProcessor.onaudioprocess = (e) => {
        // Block audio input if muted, WebSocket not ready, OR character is currently speaking
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.isCharacterSpeaking) {
          return
        }

        const audioData = e.inputBuffer.getChannelData(0)
        // Buffer Float32Array chunks (no conversion needed)
        this.audioBuffer.push(new Float32Array(audioData))
      }

      source.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.captureAudioContext.destination)

      // Send batched audio every 100ms (10 times/sec) - matches Inworld template
      let audioChunksSent = 0
      this.sendInterval = setInterval(() => {
        if (this.audioBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          try {
            const message = JSON.stringify({
              type: 'audio',
              audio: this.audioBuffer  // Send array of Float32Array chunks
            })

            this.ws.send(message)
            audioChunksSent++

            // Log first few batches for debugging
            if (audioChunksSent <= 3) {
              console.log(`[VoiceStream] Sent audio batch ${audioChunksSent}, chunks: ${this.audioBuffer.length}`)
            }

            // Clear buffer after sending
            this.audioBuffer = []
          } catch (error) {
            console.error('[VoiceStream] Failed to send audio batch:', error)
          }
        }
      }, 100)

      console.log('[VoiceStream] Audio capture started successfully with interval-based batching')
    } catch (error) {
      console.error('[VoiceStream] Failed to start audio capture:', error)
      throw new Error('Microphone access denied or WebSocket closed')
    }
  }

  /**
   * Stop capturing microphone audio
   */
  stopAudioCapture(): void {
    // Clear the send interval
    if (this.sendInterval) {
      clearInterval(this.sendInterval)
      this.sendInterval = null
    }

    // Send audioSessionEnd signal to backend (Inworld template pattern)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'audioSessionEnd' }))
        console.log('[VoiceStream] Sent audioSessionEnd signal')
      } catch (error) {
        console.error('[VoiceStream] Failed to send audioSessionEnd:', error)
      }
    }

    // Clear audio buffer
    this.audioBuffer = []

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    // Close capture audio context
    if (this.captureAudioContext && this.captureAudioContext.state !== 'closed') {
      this.captureAudioContext.close()
      this.captureAudioContext = null
    }

    // Note: Don't close the playback audio context here
    // It's used for TTS audio and needs to persist across capture sessions

    console.log('[VoiceStream] Audio capture stopped')
  }

  /**
   * Mute/unmute microphone
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted
    console.log(`[VoiceStream] Microphone ${muted ? 'muted' : 'unmuted'}`)
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear send interval if active
    if (this.sendInterval) {
      clearInterval(this.sendInterval)
      this.sendInterval = null
    }

    // Stop all playing audio sources
    this.currentSources.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        console.debug('[VoiceStream] Source already stopped', e)
      }
    })
    this.currentSources = []

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.stopAudioCapture()

    // Close playback audio context on full disconnect
    if (this.playbackAudioContext && this.playbackAudioContext.state !== 'closed') {
      this.playbackAudioContext.close()
      this.playbackAudioContext = null
    }
    this.gainNode = null

    // Clear audio buffers and reset state
    this.audioBuffer = []
    this.audioQueue = []
    this.isPlayingAudio = false
    this.isCharacterSpeaking = false
    this.nextStartTime = 0
  }

  /**
   * Get session metrics
   */
  getMetrics(): { durationSeconds: number; audioSeconds: number } {
    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)
    return {
      durationSeconds,
      audioSeconds: Math.floor(this.audioPlayedSeconds),
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: ArrayBuffer | string): Promise<void> {
    // Binary data = audio from TTS (direct ArrayBuffer)
    if (data instanceof ArrayBuffer) {
      await this.playAudio(data)
      return
    }

    // Text data = JSON message
    try {
      const message: any = JSON.parse(data)
      const messageType = (message.type || '').toLowerCase().trim()

      // Debug: Log all message types for troubleshooting
      if (messageType && !['audio', 'text', 'new_interaction', 'interaction_end'].includes(messageType)) {
        console.log('[VoiceStream] Received message type:', messageType, message)
      }

      switch (messageType) {
        case 'transcript':
          this.callbacks.onTranscript?.(message.text, message.speaker)
          break

        case 'emotion':
          this.callbacks.onEmotion?.(message.emotion, message.intensity)
          break

        case 'error':
          // Handle both lowercase 'error' and uppercase 'ERROR' from backend
          const errorMsg = message.message || message.error || 'Unknown error'
          console.error('[VoiceStream] Error from backend:', errorMsg)
          this.callbacks.onError?.(errorMsg)
          break

        case 'text':
          // Handle TEXT messages from Inworld (both user transcripts and character responses)
          if (message.text?.text) {
            // Check routing.source to distinguish user vs character messages
            const isUser = message.routing?.source?.isUser === true
            const isCharacter = message.routing?.source?.isAgent === true

            // Determine speaker based on routing flags
            const speaker = isUser ? 'USER' : 'CHARACTER'

            console.log(`[VoiceStream] ${speaker} message:`, message.text.text)

            // Only block user input when character is speaking (not for user's own messages)
            if (isCharacter) {
              this.isCharacterSpeaking = true
            }

            this.callbacks.onTranscript?.(message.text.text, speaker)
          }
          break

        case 'new_interaction':
          // Handle NEW_INTERACTION messages from Inworld (new conversation turn)
          // Clear audio queue to allow interruption (user started speaking again)
          if (this.audioQueue.length > 0) {
            console.log('[VoiceStream] New interaction started - clearing audio queue for interruption')
            this.audioQueue = []
            this.nextStartTime = 0 // Reset timing for new interaction
          } else {
            console.log('[VoiceStream] New interaction started')
          }
          break

        case 'interaction_end':
          // Handle INTERACTION_END messages from Inworld (conversation turn completed)
          console.log('[VoiceStream] Interaction ended - re-enabling user input')
          this.isCharacterSpeaking = false // Re-enable user input after character finishes
          break

        case 'audio':
          // Handle AUDIO messages from Inworld (TTS audio chunks)
          if (message.audio?.chunk) {
            try {
              this.isCharacterSpeaking = true // Block user input while character is speaking
              // Decode base64 WAV audio to ArrayBuffer
              const audioBuffer = this.base64ToArrayBuffer(message.audio.chunk)
              await this.playAudio(audioBuffer)
            } catch (error) {
              console.error('[VoiceStream] Failed to decode/play TTS audio:', error)
              console.error('[VoiceStream] Audio message structure:', {
                hasAudio: !!message.audio,
                hasChunk: !!message.audio?.chunk,
                chunkLength: message.audio?.chunk?.length || 0,
              })
            }
          } else {
            console.warn('[VoiceStream] AUDIO message missing audio.chunk:', message)
          }
          break

        default:
          // Only warn for truly unknown message types (not empty or whitespace)
          if (messageType) {
            console.warn('[VoiceStream] Unknown message type:', messageType, message)
          }
      }
    } catch (error) {
      console.error('[VoiceStream] Failed to parse message:', error, 'Raw data:', data)
    }
  }

  /**
   * Play audio received from TTS
   * Uses a queue to prevent overlapping audio chunks
   */
  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    // Add audio to queue
    this.audioQueue.push(arrayBuffer)

    // If not currently playing, start processing the queue
    if (!this.isPlayingAudio) {
      await this.processAudioQueue()
    }
  }

  /**
   * Process audio queue sequentially to prevent overlapping
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio || this.audioQueue.length === 0) {
      return
    }

    this.isPlayingAudio = true

    while (this.audioQueue.length > 0) {
      const arrayBuffer = this.audioQueue.shift()!

      try {
        await this.playAudioChunk(arrayBuffer)
      } catch (error) {
        console.error('[VoiceStream] Failed to play audio chunk:', error)
        // Continue processing queue even if one chunk fails
      }
    }

    this.isPlayingAudio = false
  }

  /**
   * Play a single audio chunk with gapless playback and crossfade (Inworld template pattern)
   */
  private async playAudioChunk(arrayBuffer: ArrayBuffer): Promise<void> {
    // Initialize playback audio context and gain node if needed (24kHz for TTS output)
    if (!this.playbackAudioContext) {
      this.playbackAudioContext = new AudioContext({ sampleRate: 24000 })
      this.gainNode = this.playbackAudioContext.createGain()
      this.gainNode.connect(this.playbackAudioContext.destination)
      this.nextStartTime = 0 // Reset timing on first playback
    }

    return new Promise(async (resolve, reject) => {
      try {
        const audioBuffer = await this.playbackAudioContext!.decodeAudioData(arrayBuffer)
        const source = this.playbackAudioContext!.createBufferSource()
        source.buffer = audioBuffer

        // Create fade gain node for crossfade
        const fadeGain = this.playbackAudioContext!.createGain()
        fadeGain.connect(this.gainNode!)
        source.connect(fadeGain)

        // Calculate timing for gapless playback
        const currentTime = this.playbackAudioContext!.currentTime
        const startTime = Math.max(currentTime, this.nextStartTime)

        // Apply fade-in at the start (eliminates clicks)
        fadeGain.gain.setValueAtTime(0, startTime)
        fadeGain.gain.linearRampToValueAtTime(1, startTime + this.fadeTime)

        // Apply fade-out at the end (eliminates clicks)
        const endTime = startTime + audioBuffer.duration
        fadeGain.gain.setValueAtTime(1, endTime - this.fadeTime)
        fadeGain.gain.linearRampToValueAtTime(0, endTime)

        // Schedule playback with precise timing
        source.start(startTime)
        source.stop(endTime)

        // Track source for cleanup
        this.currentSources.push(source)

        // Clean up when finished
        source.onended = () => {
          const index = this.currentSources.indexOf(source)
          if (index > -1) {
            this.currentSources.splice(index, 1)
          }
          console.log('[VoiceStream] Audio chunk finished playing')
          resolve()
        }

        // Update next start time for seamless chaining
        this.nextStartTime = endTime

        // Track audio duration for metrics
        this.audioPlayedSeconds += audioBuffer.duration

        this.callbacks.onAudio?.(arrayBuffer)
      } catch (error) {
        console.error('[VoiceStream] Failed to decode/play audio:', error)
        reject(error)
      }
    })
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopAudioCapture()
    this.ws = null
  }
}

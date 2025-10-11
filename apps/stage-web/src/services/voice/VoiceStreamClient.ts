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
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isMuted = false
  private startTime: number = 0
  private audioPlayedSeconds = 0

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

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      console.log('[VoiceStream] Audio context created, sample rate:', this.audioContext.sampleRate)

      // Create audio processor
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)

      let audioChunksSent = 0
      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return
        }

        const audioData = e.inputBuffer.getChannelData(0)
        const int16Array = this.float32ToInt16(audioData)

        try {
          // Convert Int16Array to regular array for JSON serialization
          const audioArray = Array.from(int16Array)

          const message = JSON.stringify({
            type: 'audio',  // lowercase to match EVENT_TYPE enum
            audio: [audioArray],  // Wrap in array as expected by backend
            sampleRate: 16000
          })

          this.ws.send(message)
          audioChunksSent++

          // Log first few chunks for debugging
          if (audioChunksSent <= 3) {
            console.log(`[VoiceStream] Sent audio chunk ${audioChunksSent}, samples: ${audioArray.length}`)
          }
        } catch (error) {
          console.error('[VoiceStream] Failed to send audio:', error)
        }
      }

      source.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      console.log('[VoiceStream] Audio capture started successfully')
    } catch (error) {
      console.error('[VoiceStream] Failed to start audio capture:', error)
      throw new Error('Microphone access denied or WebSocket closed')
    }
  }

  /**
   * Stop capturing microphone audio
   */
  stopAudioCapture(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

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
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.stopAudioCapture()
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
    // Binary data = audio from TTS
    if (data instanceof ArrayBuffer) {
      await this.playAudio(data)
      return
    }

    // Text data = JSON message
    try {
      const message: any = JSON.parse(data)
      const messageType = message.type?.toLowerCase() || ''

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
          // Handle TEXT messages from Inworld (character responses)
          if (message.text?.text) {
            console.log('[VoiceStream] Character response:', message.text.text)
            this.callbacks.onTranscript?.(message.text.text, 'CHARACTER')
          }
          break

        case 'new_interaction':
          // Handle NEW_INTERACTION messages from Inworld (new conversation turn)
          console.log('[VoiceStream] New interaction started')
          break

        default:
          console.warn('[VoiceStream] Unknown message type:', message)
      }
    } catch (error) {
      console.error('[VoiceStream] Failed to parse message:', error)
    }
  }

  /**
   * Play audio received from TTS
   */
  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 })
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start(0)

      // Track audio duration for metrics
      this.audioPlayedSeconds += audioBuffer.duration

      this.callbacks.onAudio?.(arrayBuffer)
    } catch (error) {
      console.error('[VoiceStream] Failed to play audio:', error)
    }
  }

  /**
   * Convert Float32Array to Int16Array for WebSocket transmission
   */
  private float32ToInt16(buffer: Float32Array): Int16Array {
    const int16 = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopAudioCapture()
    this.ws = null
  }
}

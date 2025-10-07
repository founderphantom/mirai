/**
 * Voice Stream Client
 * Handles WebSocket connection, audio streaming, and real-time communication
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
        this.ws = new WebSocket(websocketUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[VoiceStream] Connected')
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

        this.ws.onclose = () => {
          console.log('[VoiceStream] Disconnected')
          this.callbacks.onClose?.()
          this.cleanup()
        }

        this.ws.onmessage = async (event) => {
          await this.handleMessage(event.data)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Start capturing microphone audio
   */
  async startAudioCapture(): Promise<void> {
    try {
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

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create audio processor
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return
        }

        const audioData = e.inputBuffer.getChannelData(0)
        const int16Array = this.float32ToInt16(audioData)
        this.ws.send(int16Array.buffer)
      }

      source.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      console.log('[VoiceStream] Audio capture started')
    } catch (error) {
      console.error('[VoiceStream] Failed to start audio capture:', error)
      throw new Error('Microphone access denied')
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
      const message: VoiceMessage = JSON.parse(data)

      switch (message.type) {
        case 'transcript':
          this.callbacks.onTranscript?.(message.text, message.speaker)
          break

        case 'emotion':
          this.callbacks.onEmotion?.(message.emotion, message.intensity)
          break

        case 'error':
          this.callbacks.onError?.(message.message)
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
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopAudioCapture()
    this.ws = null
  }
}

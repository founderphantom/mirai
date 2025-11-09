/**
 * Workers AI Voice Stream Client
 *
 * Handles WebSocket communication for real-time voice streaming with Workers AI:
 * - Sends PCM audio to Workers AI for VAD/STT processing
 * - Receives real-time subtitles (partial and final transcriptions)
 * - Receives VAD status updates
 * - Receives character responses from voice agent container
 */

export interface SubtitleMessage {
  type: 'subtitle'
  text: string
  is_partial: boolean
  timestamp: number
}

export interface VADMessage {
  type: 'vad'
  is_complete: boolean
  probability: number
  timestamp: number
}

export interface AgentResponseMessage {
  type: 'agent_response'
  data: any
  timestamp: number
}

export interface StatusMessage {
  type: 'status'
  buffer: {
    bufferSize: number
    speechStartTime: number | null
    hasSpeech: boolean
  }
  timestamp: number
}

export interface PongMessage {
  type: 'pong'
  timestamp: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
  timestamp: number
}

export type WorkersAIMessage =
  | SubtitleMessage
  | VADMessage
  | AgentResponseMessage
  | StatusMessage
  | PongMessage
  | ErrorMessage

export interface WorkersAIStreamCallbacks {
  onSubtitle?: (text: string, isPartial: boolean) => void
  onVADUpdate?: (isComplete: boolean, probability: number) => void
  onAgentResponse?: (data: any) => void
  onAudio?: (audioData: ArrayBuffer) => void
  onError?: (error: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export class WorkersAIStreamClient {
  private ws: WebSocket | null = null
  private captureAudioContext: AudioContext | null = null // For microphone capture (16kHz)
  private playbackAudioContext: AudioContext | null = null // For TTS playback (24kHz)
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isMuted = false
  private startTime: number = 0
  private audioPlayedSeconds = 0

  // Audio buffering for real-time streaming
  private audioBuffer: Uint8Array[] = []
  private sendInterval: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null

  // Audio playback queue to prevent overlapping
  private audioQueue: ArrayBuffer[] = []
  private isPlayingAudio = false

  // Gapless playback with crossfade
  private nextStartTime = 0
  private fadeTime = 0.005 // 5ms crossfade to eliminate clicks
  private gainNode: GainNode | null = null
  private currentSources: AudioBufferSourceNode[] = []

  // Current subtitle state
  private currentSubtitle = ''
  private isPartialSubtitle = false

  constructor(private callbacks: WorkersAIStreamCallbacks) {}

  /**
   * Connect to Workers AI audio stream WebSocket
   */
  async connect(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[WorkersAI] Connecting to:', websocketUrl)
        this.ws = new WebSocket(websocketUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[WorkersAI] WebSocket connected successfully')
          this.startTime = Date.now()
          this.startPingInterval()
          this.callbacks.onOpen?.()
          resolve()
        }

        this.ws.onerror = (error) => {
          console.error('[WorkersAI] WebSocket error:', error)
          const errorMsg = 'Failed to connect to voice service'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.ws.onclose = (event) => {
          console.log('[WorkersAI] WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })
          this.stopPingInterval()
          this.callbacks.onClose?.()
          this.cleanup()
        }

        this.ws.onmessage = async (event) => {
          await this.handleMessage(event.data)
        }
      } catch (error) {
        console.error('[WorkersAI] Connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Start capturing microphone audio
   */
  async startAudioCapture(): Promise<void> {
    try {
      console.log('[WorkersAI] Requesting microphone access...')

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

      console.log('[WorkersAI] Microphone access granted')

      // Verify WebSocket is still open
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('[WorkersAI] WebSocket not open, state:', this.ws?.readyState)
        throw new Error('WebSocket connection lost')
      }

      // Create audio context for capture (16kHz for voice input)
      this.captureAudioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.captureAudioContext.createMediaStreamSource(this.mediaStream)

      console.log('[WorkersAI] Capture audio context created, sample rate:', this.captureAudioContext.sampleRate)

      // Create audio processor
      this.scriptProcessor = this.captureAudioContext.createScriptProcessor(1024, 1, 1) // 1024 samples per chunk

      // Process audio chunks
      this.scriptProcessor.onaudioprocess = (e) => {
        // Block audio input if muted or WebSocket not ready
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return
        }

        const audioData = e.inputBuffer.getChannelData(0) // Float32Array [-1, 1]

        // Convert Float32Array to 16-bit PCM (Uint8Array)
        const pcm = this.float32ToPCM16(audioData)
        this.audioBuffer.push(pcm)
      }

      source.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.captureAudioContext.destination)

      // Send audio chunks immediately (real-time streaming)
      // Workers AI needs continuous audio stream for VAD to work properly
      let audioChunksSent = 0
      this.sendInterval = setInterval(() => {
        if (this.audioBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          try {
            // Send each buffered chunk
            for (const chunk of this.audioBuffer) {
              this.ws.send(chunk.buffer)
              audioChunksSent++
            }

            // Log first few chunks for debugging
            if (audioChunksSent <= 5) {
              console.log(`[WorkersAI] Sent ${this.audioBuffer.length} audio chunks (total: ${audioChunksSent})`)
            }

            // Clear buffer after sending
            this.audioBuffer = []
          } catch (error) {
            console.error('[WorkersAI] Failed to send audio:', error)
          }
        }
      }, 50) // Send every 50ms for real-time processing

      console.log('[WorkersAI] Audio capture started successfully')
    } catch (error) {
      console.error('[WorkersAI] Failed to start audio capture:', error)
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

    console.log('[WorkersAI] Audio capture stopped')
  }

  /**
   * Mute/unmute microphone
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted
    console.log(`[WorkersAI] Microphone ${muted ? 'muted' : 'unmuted'}`)
  }

  /**
   * Get current subtitle
   */
  getCurrentSubtitle(): { text: string; isPartial: boolean } {
    return {
      text: this.currentSubtitle,
      isPartial: this.isPartialSubtitle,
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear intervals
    if (this.sendInterval) {
      clearInterval(this.sendInterval)
      this.sendInterval = null
    }
    this.stopPingInterval()

    // Stop all playing audio sources
    this.currentSources.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        console.debug('[WorkersAI] Source already stopped', e)
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
    this.nextStartTime = 0
    this.currentSubtitle = ''
    this.isPartialSubtitle = false
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
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        } catch (error) {
          console.error('[WorkersAI] Failed to send ping:', error)
        }
      }
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
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
      const message: WorkersAIMessage = JSON.parse(data)

      console.log('[WorkersAI] Received message:', message.type)

      switch (message.type) {
        case 'subtitle':
          // Update current subtitle
          this.currentSubtitle = message.text
          this.isPartialSubtitle = message.is_partial

          // Log final transcriptions
          if (!message.is_partial) {
            console.log('[WorkersAI] Final transcription:', message.text)
          }

          this.callbacks.onSubtitle?.(message.text, message.is_partial)
          break

        case 'vad':
          console.log('[WorkersAI] VAD status:', {
            complete: message.is_complete,
            probability: message.probability,
          })
          this.callbacks.onVADUpdate?.(message.is_complete, message.probability)
          break

        case 'agent_response':
          console.log('[WorkersAI] Agent response received')
          this.callbacks.onAgentResponse?.(message.data)
          break

        case 'pong':
          // Ping/pong handled silently
          break

        case 'status':
          console.log('[WorkersAI] Buffer status:', message.buffer)
          break

        case 'error':
          console.error('[WorkersAI] Error from backend:', message.message)
          this.callbacks.onError?.(message.message)
          break

        default:
          console.warn('[WorkersAI] Unknown message type:', message)
      }
    } catch (error) {
      console.error('[WorkersAI] Failed to parse message:', error, 'Raw data:', data)
    }
  }

  /**
   * Play audio received from TTS
   */
  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    this.audioQueue.push(arrayBuffer)

    if (!this.isPlayingAudio) {
      await this.processAudioQueue()
    }
  }

  /**
   * Process audio queue sequentially
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
        console.error('[WorkersAI] Failed to play audio chunk:', error)
      }
    }

    this.isPlayingAudio = false
  }

  /**
   * Play a single audio chunk with gapless playback
   */
  private async playAudioChunk(arrayBuffer: ArrayBuffer): Promise<void> {
    // Initialize playback audio context if needed
    if (!this.playbackAudioContext) {
      this.playbackAudioContext = new AudioContext({ sampleRate: 24000 })
      this.gainNode = this.playbackAudioContext.createGain()
      this.gainNode.connect(this.playbackAudioContext.destination)
      this.nextStartTime = 0
    }

    return new Promise(async (resolve, reject) => {
      try {
        const audioBuffer = await this.playbackAudioContext!.decodeAudioData(arrayBuffer)
        const source = this.playbackAudioContext!.createBufferSource()
        source.buffer = audioBuffer

        // Create fade gain node
        const fadeGain = this.playbackAudioContext!.createGain()
        fadeGain.connect(this.gainNode!)
        source.connect(fadeGain)

        // Calculate timing
        const currentTime = this.playbackAudioContext!.currentTime
        const startTime = Math.max(currentTime, this.nextStartTime)

        // Apply fade-in
        fadeGain.gain.setValueAtTime(0, startTime)
        fadeGain.gain.linearRampToValueAtTime(1, startTime + this.fadeTime)

        // Apply fade-out
        const endTime = startTime + audioBuffer.duration
        fadeGain.gain.setValueAtTime(1, endTime - this.fadeTime)
        fadeGain.gain.linearRampToValueAtTime(0, endTime)

        // Schedule playback
        source.start(startTime)
        source.stop(endTime)

        // Track source
        this.currentSources.push(source)

        // Cleanup when finished
        source.onended = () => {
          const index = this.currentSources.indexOf(source)
          if (index > -1) {
            this.currentSources.splice(index, 1)
          }
          resolve()
        }

        // Update next start time
        this.nextStartTime = endTime

        // Track duration
        this.audioPlayedSeconds += audioBuffer.duration

        this.callbacks.onAudio?.(arrayBuffer)
      } catch (error) {
        console.error('[WorkersAI] Failed to decode/play audio:', error)
        reject(error)
      }
    })
  }

  /**
   * Convert Float32Array to 16-bit PCM Uint8Array
   */
  private float32ToPCM16(float32Array: Float32Array): Uint8Array {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1]
      const sample = Math.max(-1, Math.min(1, float32Array[i]))
      // Convert to 16-bit PCM
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(i * 2, pcm, true) // true = little-endian
    }

    return new Uint8Array(buffer)
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopAudioCapture()
    this.ws = null
  }
}

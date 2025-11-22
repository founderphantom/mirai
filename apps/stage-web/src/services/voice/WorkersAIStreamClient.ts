/**
 * Workers AI Voice Stream Client
 *
 * Handles WebSocket communication for real-time voice streaming with Workers AI:
 * - Connects to 3 WebSockets:
 *   1. /audio-stream - VAD status updates
 *   2. /flux-stt - Direct Flux STT connection for real-time transcription
 *   3. /ws - Voice agent responses (TTS, emotions)
 * - Sends PCM audio to both /audio-stream and /flux-stt
 * - Receives VAD updates from /audio-stream
 * - Receives transcriptions from /flux-stt (Flux events)
 * - Receives character responses from /ws (voice agent)
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

export interface TranscriptionCompleteMessage {
  type: 'transcription_complete'
  text: string
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
  | TranscriptionCompleteMessage
  | AgentResponseMessage
  | StatusMessage
  | PongMessage
  | ErrorMessage

export interface WorkersAIStreamCallbacks {
  // VoiceStreamClient compatible callbacks (for drop-in replacement)
  onTranscript?: (text: string, speaker: string) => void
  onEmotion?: (emotion: string, intensity: number) => void
  onAudio?: (audioData: ArrayBuffer) => void
  onError?: (error: string) => void
  onOpen?: () => void
  onClose?: () => void

  // Workers AI specific callbacks (optional, for advanced usage)
  onSubtitle?: (text: string, isPartial: boolean) => void
  onVADUpdate?: (isComplete: boolean, probability: number) => void
  onTranscriptionComplete?: (text: string) => void
  onAgentResponse?: (data: any) => void
  onLipSync?: (mouthOpenSize: number) => void
}

// Flux WebSocket event types (Flux uses 'event' field, not 'type')
export interface FluxEvent {
  event: 'StartOfTurn' | 'Update' | 'EagerEndOfTurn' | 'EndOfTurn'
  transcript?: string
  confidence?: number
}

export class WorkersAIStreamClient {
  // Triple WebSocket architecture
  private audioStreamWs: WebSocket | null = null // Workers AI WebSocket (/audio-stream) for VAD
  private fluxWs: WebSocket | null = null // Flux STT WebSocket (/flux-stt) for transcription
  private agentWs: WebSocket | null = null // Voice Agent WebSocket (/ws) for responses

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
  private audioChunksSent = 0

  // Audio playback queue to prevent overlapping
  private audioQueue: ArrayBuffer[] = []

  // Character message accumulation (for streaming TTS text chunks)
  private currentCharacterInteraction: string | null = null
  private currentCharacterMessage: string = ''
  private isPlayingAudio = false

  // Gapless playback with crossfade
  private nextStartTime = 0
  private fadeTime = 0.005 // 5ms crossfade to eliminate clicks
  private gainNode: GainNode | null = null
  private currentSources: AudioBufferSourceNode[] = []

  // Current subtitle state
  private currentSubtitle = ''
  private isPartialSubtitle = false

  // Lip sync analysis
  private lipSyncAnalyser: AnalyserNode | null = null
  private lipSyncAnimationId: number | null = null

  constructor(private callbacks: WorkersAIStreamCallbacks) {}

  /**
   * Connect to all three WebSocket endpoints
   * @param audioStreamUrl - Workers AI endpoint (/audio-stream) for VAD
   * @param fluxUrl - Flux STT endpoint (/flux-stt) for direct STT connection
   * @param agentUrl - Voice Agent endpoint (/ws) for character responses
   */
  async connect(audioStreamUrl: string, fluxUrl: string, agentUrl: string): Promise<void> {
    try {
      // Connect to Workers AI WebSocket first (for VAD)
      await this.connectAudioStream(audioStreamUrl)
      console.log('[WorkersAI] Audio stream connected (VAD)')

      // Connect to Flux WebSocket (for direct STT)
      await this.connectFlux(fluxUrl)
      console.log('[WorkersAI] Flux connected (STT)')

      // Then connect to Voice Agent WebSocket (for character responses)
      await this.connectAgent(agentUrl)
      console.log('[WorkersAI] Agent connected (TTS/LLM)')

      this.startTime = Date.now()
      this.callbacks.onOpen?.()
    } catch (error) {
      console.error('[WorkersAI] Connection error:', error)
      this.disconnect()
      throw error
    }
  }

  /**
   * Connect to Workers AI audio stream WebSocket (/audio-stream)
   * Handles: VAD status updates
   */
  private async connectAudioStream(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[WorkersAI] Connecting to audio stream:', websocketUrl)
        this.audioStreamWs = new WebSocket(websocketUrl)
        this.audioStreamWs.binaryType = 'arraybuffer'

        this.audioStreamWs.onopen = () => {
          console.log('[WorkersAI] Audio stream WebSocket connected')
          this.startPingInterval()
          resolve()
        }

        this.audioStreamWs.onerror = (error) => {
          console.error('[WorkersAI] Audio stream WebSocket error:', error)
          const errorMsg = 'Failed to connect to audio stream'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.audioStreamWs.onclose = (event) => {
          console.log('[WorkersAI] Audio stream WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })
          this.stopPingInterval()
          this.callbacks.onClose?.()
          this.cleanup()
        }

        this.audioStreamWs.onmessage = async (event) => {
          await this.handleAudioStreamMessage(event.data)
        }
      } catch (error) {
        console.error('[WorkersAI] Audio stream connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Connect to Flux STT WebSocket (/flux-stt)
   * Handles: Direct real-time speech-to-text transcription
   */
  private async connectFlux(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[WorkersAI] Connecting to Flux STT:', websocketUrl)
        this.fluxWs = new WebSocket(websocketUrl)
        this.fluxWs.binaryType = 'arraybuffer'

        this.fluxWs.onopen = () => {
          console.log('[WorkersAI] Flux STT WebSocket connected')
          resolve()
        }

        this.fluxWs.onerror = (error) => {
          console.error('[WorkersAI] Flux WebSocket error:', error)
          const errorMsg = 'Failed to connect to Flux STT'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.fluxWs.onclose = (event) => {
          console.log('[WorkersAI] Flux WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })
        }

        this.fluxWs.onmessage = async (event) => {
          await this.handleFluxMessage(event.data)
        }
      } catch (error) {
        console.error('[WorkersAI] Flux connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Connect to Voice Agent WebSocket (/ws)
   * Handles: Character responses (text, audio, emotions)
   */
  private async connectAgent(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[WorkersAI] Connecting to agent:', websocketUrl)
        this.agentWs = new WebSocket(websocketUrl)
        this.agentWs.binaryType = 'arraybuffer'

        this.agentWs.onopen = () => {
          console.log('[WorkersAI] Agent WebSocket connected')
          resolve()
        }

        this.agentWs.onerror = (error) => {
          console.error('[WorkersAI] Agent WebSocket error:', error)
          const errorMsg = 'Failed to connect to voice agent'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.agentWs.onclose = (event) => {
          console.log('[WorkersAI] Agent WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          })
        }

        this.agentWs.onmessage = async (event) => {
          await this.handleAgentMessage(event.data)
        }
      } catch (error) {
        console.error('[WorkersAI] Agent connection error:', error)
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

      // Verify audio stream WebSocket is still open
      if (!this.audioStreamWs || this.audioStreamWs.readyState !== WebSocket.OPEN) {
        console.error('[WorkersAI] Audio stream WebSocket not open, state:', this.audioStreamWs?.readyState)
        throw new Error('Audio stream connection lost')
      }

      // Create audio context for capture (16kHz for voice input)
      this.captureAudioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.captureAudioContext.createMediaStreamSource(this.mediaStream)

      console.log('[WorkersAI] Capture audio context created, sample rate:', this.captureAudioContext.sampleRate)

      // Create audio processor
      this.scriptProcessor = this.captureAudioContext.createScriptProcessor(1024, 1, 1) // 1024 samples per chunk

      // Process audio chunks
      this.scriptProcessor.onaudioprocess = (e) => {
        // Block audio input if muted or WebSockets not ready
        if (this.isMuted ||
            !this.audioStreamWs || this.audioStreamWs.readyState !== WebSocket.OPEN ||
            !this.fluxWs || this.fluxWs.readyState !== WebSocket.OPEN) {
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
      // Send to BOTH audio-stream (VAD) AND flux (STT)
      this.sendInterval = setInterval(() => {
        if (this.audioBuffer.length > 0 &&
            this.audioStreamWs?.readyState === WebSocket.OPEN &&
            this.fluxWs?.readyState === WebSocket.OPEN) {
          try {
            // Send each buffered chunk to BOTH WebSockets
            for (const chunk of this.audioBuffer) {
              this.audioStreamWs.send(chunk.buffer) // VAD processing
              this.fluxWs.send(chunk.buffer) // STT processing
              this.audioChunksSent++
            }

            // Clear buffer after sending (no logging to reduce console noise)
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
   * Disconnect and cleanup both WebSockets
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

    // Close all three WebSocket connections
    if (this.audioStreamWs) {
      this.audioStreamWs.close()
      this.audioStreamWs = null
    }
    if (this.fluxWs) {
      this.fluxWs.close()
      this.fluxWs = null
    }
    if (this.agentWs) {
      this.agentWs.close()
      this.agentWs = null
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
   * Start ping interval to keep audio stream connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.audioStreamWs?.readyState === WebSocket.OPEN) {
        try {
          this.audioStreamWs.send(JSON.stringify({ type: 'ping' }))
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
   * Handle incoming messages from Flux WebSocket (/flux-stt)
   * Handles: Real-time transcription events from Flux
   */
  private async handleFluxMessage(data: ArrayBuffer | string): Promise<void> {
    // Flux only sends JSON messages
    if (data instanceof ArrayBuffer) {
      console.warn('[WorkersAI] Received unexpected binary data from Flux')
      return
    }

    try {
      const event: FluxEvent = JSON.parse(data)

      // Check if event field exists
      if (!event.event) {
        console.warn('[WorkersAI] Flux message missing event field:', data)
        return
      }

      // Only log significant events (not every Update event)
      if (event.event !== 'Update') {
        console.log('[WorkersAI] Flux event:', event.event, event.transcript?.substring(0, 50))
      }

      switch (event.event) {
        case 'StartOfTurn':
          console.log('[WorkersAI] Flux: User started speaking')
          // Clear current subtitle
          this.currentSubtitle = ''
          this.isPartialSubtitle = true
          break

        case 'Update':
          // Partial transcription - update subtitle in real-time (don't log every update)
          if (event.transcript) {
            this.currentSubtitle = event.transcript
            this.isPartialSubtitle = true
            this.callbacks.onSubtitle?.(event.transcript, true)
          }
          break

        case 'EagerEndOfTurn':
          // Quick end-of-turn detection - send partial result
          if (event.transcript) {
            console.log('[WorkersAI] Flux eager end of turn:', event.transcript)
            this.currentSubtitle = event.transcript
            this.isPartialSubtitle = false
            this.callbacks.onSubtitle?.(event.transcript, false)
          }
          break

        case 'EndOfTurn':
          // Final transcription - send to voice agent via audio-stream WebSocket
          if (event.transcript) {
            console.log('[WorkersAI] Flux final transcription:', event.transcript)

            // Clear subtitle and send final transcription to UI
            this.currentSubtitle = ''
            this.isPartialSubtitle = false

            // Call onSubtitle with final transcription to clean up partial messages
            this.callbacks.onSubtitle?.(event.transcript, false)

            // Forward to audio-stream WebSocket so worker can send to voice agent
            if (this.audioStreamWs && this.audioStreamWs.readyState === WebSocket.OPEN) {
              this.audioStreamWs.send(JSON.stringify({
                type: 'transcription',
                text: event.transcript,
              }))
            }

            this.callbacks.onTranscriptionComplete?.(event.transcript)
          }
          break

        default:
          console.warn('[WorkersAI] Unknown Flux event:', event.event)
      }
    } catch (error) {
      console.error('[WorkersAI] Failed to parse Flux message:', error, 'Raw data:', data)
    }
  }

  /**
   * Handle incoming messages from audio stream WebSocket (/audio-stream)
   * Handles: VAD status updates
   */
  private async handleAudioStreamMessage(data: ArrayBuffer | string): Promise<void> {
    // Should only receive JSON messages from audio stream
    if (data instanceof ArrayBuffer) {
      console.warn('[WorkersAI] Received unexpected binary data from audio stream')
      return
    }

    // Text data = JSON message
    try {
      const message: WorkersAIMessage = JSON.parse(data)

      // Only log non-VAD messages to reduce console noise
      if (message.type !== 'vad') {
        console.log('[WorkersAI] Audio stream message:', message.type)
      }

      switch (message.type) {
        case 'vad':
          // VAD status updates happen very frequently - don't log them
          this.callbacks.onVADUpdate?.(message.is_complete, message.probability)
          break

        case 'pong':
          // Ping/pong handled silently
          break

        case 'status':
          console.log('[WorkersAI] Buffer status:', message.buffer)
          break

        case 'error':
          console.error('[WorkersAI] Error from audio stream:', message.message)
          this.callbacks.onError?.(message.message)
          break

        default:
          console.warn('[WorkersAI] Unknown audio stream message type:', message)
      }
    } catch (error) {
      console.error('[WorkersAI] Failed to parse audio stream message:', error, 'Raw data:', data)
    }
  }

  /**
   * Handle incoming messages from voice agent WebSocket (/ws)
   * Handles: Character responses (text, emotions, TTS audio)
   */
  private async handleAgentMessage(data: ArrayBuffer | string): Promise<void> {
    // Binary data = audio from TTS
    if (data instanceof ArrayBuffer) {
      // Don't log every audio chunk received (too noisy)
      await this.playAudio(data)
      return
    }

    // Text data = JSON message from Inworld Runtime
    try {
      const message = JSON.parse(data)

      // Only log significant message types (not TEXT/AUDIO which are very frequent)
      if (message.type !== 'TEXT' && message.type !== 'AUDIO') {
        console.log('[WorkersAI] Agent message:', message.type || 'unknown')
      }

      // Handle different Inworld Runtime message types
      switch (message.type) {
        case 'TEXT':
          // Handle TEXT messages from voice agent (character responses only)
          // NOTE: User transcripts are handled by Flux STT (handleFluxMessage)
          // The agent echoes back user messages, but we ignore them to prevent duplicates
          if (message.text) {
            // Check routing.source to distinguish user vs character messages
            const isUser = message.routing?.source?.isUser === true

            if (!isUser) {
              // Accumulate CHARACTER message chunks for the same interaction
              const interactionId = message.packetId?.interactionId

              if (interactionId) {
                // Check if this is a new interaction
                if (this.currentCharacterInteraction !== interactionId) {
                  // Flush previous interaction if exists
                  if (this.currentCharacterMessage) {
                    console.log('[WorkersAI] Final CHARACTER message:', this.currentCharacterMessage)
                    this.callbacks.onTranscript?.(this.currentCharacterMessage, 'CHARACTER')
                  }

                  // Start new interaction
                  this.currentCharacterInteraction = interactionId
                  this.currentCharacterMessage = message.text
                } else {
                  // Accumulate text for current interaction (don't log each chunk)
                  this.currentCharacterMessage += message.text
                }
              } else {
                // Fallback if no interactionId - send immediately
                console.log('[WorkersAI] CHARACTER message (no interactionId):', message.text)
                this.callbacks.onTranscript?.(message.text, 'CHARACTER')
              }
            } else {
              // Log but don't display user messages (already shown by Flux STT)
              console.log('[WorkersAI] Ignoring echoed USER message from agent:', message.text)
            }
          }
          break

        case 'AUDIO':
          // Handle AUDIO messages from voice agent (TTS audio chunks)
          if (message.audio?.chunk) {
            try {
              // Decode base64 WAV audio to ArrayBuffer (don't log each chunk)
              const audioBuffer = this.base64ToArrayBuffer(message.audio.chunk)
              await this.playAudio(audioBuffer)
            } catch (error) {
              console.error('[WorkersAI] Failed to decode/play TTS audio:', error)
            }
          } else {
            console.warn('[WorkersAI] AUDIO message missing audio.chunk:', message)
          }
          break

        case 'EMOTION':
          // Character emotion update
          if (message.emotion) {
            console.log('[WorkersAI] Character emotion:', message.emotion)
            this.callbacks.onEmotion?.(message.emotion.behavior, message.emotion.strength || 1.0)
          }
          break

        case 'INTERACTION_END':
          // Flush accumulated CHARACTER message (don't log interaction end)
          if (this.currentCharacterMessage) {
            console.log('[WorkersAI] Final CHARACTER message:', this.currentCharacterMessage)
            this.callbacks.onTranscript?.(this.currentCharacterMessage, 'CHARACTER')
            this.currentCharacterMessage = ''
            this.currentCharacterInteraction = null
          }
          break

        case 'NEW_INTERACTION':
          console.log('[WorkersAI] New interaction:', message.interactionId)
          break

        case 'ERROR':
          console.error('[WorkersAI] Agent error:', message.error)
          this.callbacks.onError?.(message.error || 'Agent error')
          break

        default:
          // Log other message types for debugging
          console.log('[WorkersAI] Other agent message:', message.type)
          this.callbacks.onAgentResponse?.(message)
      }
    } catch (error) {
      console.error('[WorkersAI] Failed to parse agent message:', error, 'Raw data:', data)
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
    this.audioStreamWs = null
    this.fluxWs = null
    this.agentWs = null
  }
}

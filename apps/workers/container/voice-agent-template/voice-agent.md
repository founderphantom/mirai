# Voice Agent Container - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Deployment Model](#deployment-model)
4. [Multi-Tenant Design](#multi-tenant-design)
5. [Key Components](#key-components)
6. [Request Flow](#request-flow)
7. [Voice Processing Pipeline](#voice-processing-pipeline)
8. [Session Management](#session-management)
9. [Character Pooling](#character-pooling)
10. [Configuration](#configuration)
11. [API Endpoints](#api-endpoints)
12. [WebSocket Protocol](#websocket-protocol)
13. [Monitoring & Health Checks](#monitoring--health-checks)
14. [Security Model](#security-model)
15. [Performance & Scaling](#performance--scaling)
16. [File Structure](#file-structure)
17. [Integration Points](#integration-points)
18. [Troubleshooting](#troubleshooting)

---

## Overview

The Voice Agent Container is a **real-time conversational AI system** deployed on **Cloudflare Containers** (beta). It enables voice and text-based conversations with AI characters using the **Inworld Runtime SDK**.

### Key Features
- **Real-time voice conversations** with ultra-low latency (~50-200ms)
- **Multi-tenant architecture** - one container serves 100+ concurrent users
- **Character-based pooling** - multiple users can share the same character instance
- **Automatic session management** with idle cleanup
- **Voice Activity Detection (VAD)** using Silero model
- **Streaming TTS/STT** with chunked audio processing
- **Graph-based processing pipeline** using Inworld Runtime
- **Direct WebSocket connections** bypassing API Gateway for reduced latency
- **Service binding integration** with API Gateway for authentication

### Technology Stack
- **Platform**: Cloudflare Containers (Durable Objects)
- **Runtime**: Node.js 20 (in Docker container)
- **Framework**: Inworld Runtime SDK
- **WebSocket**: ws library
- **HTTP Server**: Express.js
- **Voice Models**:
  - VAD: Silero (local ONNX model)
  - STT: Deepgram (remote)
  - TTS: Inworld TTS-1 (remote)
  - LLM: Mistral ministral-8b-latest (remote)

---

## Architecture

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                               │
│                    WebSocket + Audio Streaming                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Edge Network                             │
│                    Custom Domain: voice.miraichat.app                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
    ┌──────────────────────────┐     ┌──────────────────────────┐
    │   Voice Agent Worker     │     │     API Gateway Worker   │
    │  (src/worker.ts)         │◄────│  (service binding call)  │
    │                          │     │                          │
    │  - Session validation    │     │  - JWT validation        │
    │  - KV cache lookup       │     │  - Secret management     │
    │  - Character loading     │     │  - Usage tracking        │
    │  - WebSocket upgrade     │     └──────────────────────────┘
    └──────────────────────────┘
                    │
                    ↓
    ┌──────────────────────────────────────────────────────────┐
    │         Voice Agent Container (Durable Object)            │
    │              Node.js 20 + Express + WebSocket             │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │      CharacterPoolManager (Singleton)              │  │
    │  │  - Character-based pooling                         │  │
    │  │  - Max 100 concurrent sessions                     │  │
    │  │  - Automatic idle cleanup (2 min timeout)          │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │  Character Instance (shared across users)          │  │
    │  │  - InworldApp                                      │  │
    │  │  - Graph (text input + audio input)                │  │
    │  │  - VAD Client (Silero)                             │  │
    │  │  - Session connections map                         │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │         Message Handler (per WebSocket)            │  │
    │  │  - AudioHandler (VAD + speech capture)             │  │
    │  │  - Processing queue (sequential execution)         │  │
    │  │  - Graph execution                                 │  │
    │  └────────────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │   Deepgram   │  │  Inworld TTS │  │   Mistral    │
        │     STT      │  │     (TTS)    │  │     LLM      │
        └──────────────┘  └──────────────┘  └──────────────┘
```

### Component Interaction Flow
```
1. Client connects → Worker validates session (KV) → Worker calls /load → Container initializes character
2. Worker upgrades WebSocket → Container accepts connection → MessageHandler created
3. Client sends audio → AudioHandler processes with VAD → Speech captured → Graph execution
4. Graph: Audio → STT → Text → LLM → Text chunks → TTS → Audio chunks
5. Container sends audio chunks → Client plays audio
```

---

## Deployment Model

### Cloudflare Containers (Beta)

The voice agent uses **Cloudflare Containers** - a new feature that allows running containerized applications on Cloudflare's edge network using Durable Objects.

#### How It Works
1. **Docker Image**: Built from `Dockerfile` with multi-stage build
2. **Durable Object**: Container runs as a Durable Object class (`VoiceAgentContainer`)
3. **Worker Proxy**: `src/worker.ts` proxies requests to the container
4. **Port 4000**: Container listens on port 4000 (defined in Dockerfile and wrangler.toml)
5. **Automatic Scaling**: Cloudflare manages container lifecycle and scaling

#### Configuration (wrangler.toml)
```toml
[[containers]]
name = "voice-agent"
class_name = "VoiceAgentContainer"
image = "./Dockerfile"
max_instances = 10

[[durable_objects.bindings]]
name = "VOICE_AGENT"
class_name = "VoiceAgentContainer"
```

#### Container Lifecycle
- **Cold Start**: ~2-5 seconds (first request to container)
- **Warm**: Reuses existing container instance
- **Sleep**: After 5 minutes of inactivity (configurable)
- **Scale to Zero**: Container hibernates when not in use

---

## Multi-Tenant Design

### Character-Based Pooling

Instead of creating one Inworld app per user, the system uses **character-based pooling**:

```
Character A (Inworld App)
  ├─ User 1 (Session 1) → WebSocket connection
  ├─ User 2 (Session 2) → WebSocket connection
  └─ User 5 (Session 3) → WebSocket connection

Character B (Inworld App)
  ├─ User 3 (Session 4) → WebSocket connection
  └─ User 7 (Session 5) → WebSocket connection
```

### Benefits
1. **Resource Efficiency**: One character instance shared by multiple users
2. **Fast Character Loading**: Reuse existing character instead of initializing new one
3. **Reduced API Calls**: Character configuration only loaded once
4. **Memory Optimization**: 100+ sessions with only a few character instances

### Capacity Limits
- **Max Sessions per Container**: 100 concurrent sessions
- **Max Character Instances**: No hard limit (scales based on usage)
- **Character Idle Timeout**: 2 minutes (reduced from 10 to prevent gRPC buildup)
- **Cleanup Interval**: 30 seconds

---

## Key Components

### 1. Worker Layer (`src/worker.ts`)

**Role**: Cloudflare Worker that handles routing and session validation

**Responsibilities**:
- Validate session keys from KV cache
- Call `/load` endpoint to initialize character
- Upgrade WebSocket connections
- Forward requests to container via Durable Object

**Key Functions**:
```typescript
// Direct WebSocket endpoint - bypasses API Gateway
if (path === '/ws') {
  return handleDirectWebSocket(request, env, startTime)
}

// All other endpoints require headers from api-gateway
const userId = request.headers.get('X-User-ID')
const inworldApiKey = request.headers.get('X-Inworld-API-Key')
```

**Session Validation Flow**:
```typescript
// 1. Get session key from URL
const sessionKey = url.searchParams.get('sessionKey')

// 2. Validate session from KV cache
const sessionData = await env.SESSION_CACHE.get<VoiceSessionData>(
  `session:${sessionKey}`,
  { type: 'json' }
)

// 3. Check expiration
if (Date.now() > sessionData.expiresAt) {
  await env.SESSION_CACHE.delete(`session:${sessionKey}`)
  return new Response(JSON.stringify({ error: 'Session expired' }), {
    status: 401,
  })
}
```

### 2. Multi-Tenant Server (`voice_agent/server/index.multi-tenant.ts`)

**Role**: Main entry point for the container application

**Responsibilities**:
- HTTP/WebSocket server setup (Express + ws)
- Character pool management
- Health checks and metrics
- Graceful shutdown

**Key Features**:
```typescript
// Health check with utilization metrics
app.get('/health', (req, res) => {
  const metrics = characterPool.getMetrics()
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    metrics: {
      totalCharacters: metrics.totalCharacters,
      totalSessions: metrics.totalSessions,
      utilizationPercent: metrics.utilizationPercent,
    },
  })
})

// Readiness probe (ready if below 90% capacity)
app.get('/ready', (req, res) => {
  const metrics = characterPool.getMetrics()
  const isReady = metrics.utilizationPercent < 90
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    utilizationPercent: metrics.utilizationPercent,
  })
})
```

### 3. CharacterPoolManager (`voice_agent/server/middleware/CharacterPoolManager.ts`)

**Role**: Singleton that manages character instances and sessions

**Key Methods**:

```typescript
// Get or create character instance (reuse if exists)
async getOrCreateCharacter(
  characterId: string,
  inworldCharacterId: string,
  config: CharacterConfig
): Promise<InworldApp>

// Add session to character
addSession(characterId: string, sessionData: SessionData): void

// Remove session (triggers cleanup if no sessions remain)
removeSession(characterId: string, sessionKey: string): void

// Cleanup idle characters (runs every 30 seconds)
private async cleanupIdleCharacters(): Promise<void>
```

**Configuration**:
```typescript
private readonly MAX_SESSIONS_PER_CONTAINER = 100
private readonly CHARACTER_IDLE_TIMEOUT = 2 * 60 * 1000 // 2 minutes
private readonly CLEANUP_INTERVAL = 30 * 1000 // 30 seconds
```

### 4. InworldApp (`voice_agent/server/components/app.ts`)

**Role**: Wrapper around Inworld Runtime SDK

**Initialization**:
```typescript
async initialize(
  apiKey?: string,
  voiceConfig?: {
    voiceId?: string
    llmModelName?: string
    llmProvider?: string
    ttsModelId?: string
  }
) {
  // Initialize VAD client (local Silero model)
  this.vadClient = await VADFactory.createLocal({
    modelPath: this.vadModelPath,
  })

  // Create text input graph
  this.graphWithTextInput = await InworldGraphWrapper.create({
    apiKey: this.apiKey,
    llmModelName: this.llmModelName,
    llmProvider: this.llmProvider,
    voiceId: this.voiceId,
    connections: this.connections,
    ttsModelId: this.ttsModelId,
  })

  // Create audio input graph
  this.graphWithAudioInput = await InworldGraphWrapper.create({
    apiKey: this.apiKey,
    llmModelName: this.llmModelName,
    llmProvider: this.llmProvider,
    voiceId: this.voiceId,
    connections: this.connections,
    withAudioInput: true,
    ttsModelId: this.ttsModelId,
  })
}
```

**Character Loading**:
```typescript
async load(req: any, res: any) {
  const agent = {
    ...req.body.agent,
    id: v4(),
  }

  this.connections[req.query.key] = {
    state: {
      messages: [
        {
          role: 'system',
          content: this.createSystemMessage(agent),
          id: v4(),
        },
      ],
      agent,
      userName: req.body.userName,
    },
    ws: null,
  }

  res.end(JSON.stringify({ agent }))
}
```

**System Message Generation** (supports both PersonalityConfig and legacy Agent):
```typescript
private createSystemMessage(agent: Agent | PersonalityConfig): string {
  // Check if this is the new PersonalityConfig format
  if ('dialogueStyle' in agent) {
    const motivations = agent.motivations?.join(', ') || 'Help and engage with users'
    const flaws = agent.flaws?.join(', ') || 'None specified'
    const adjectives = agent.adjectives?.join(', ') || 'Friendly'

    return `Your persona is: "${agent.dialogueStyle}". Your motivations are: ${motivations}. Your flaws are: ${flaws}. Your personality traits: ${adjectives}.`
  }

  // Fallback to legacy Agent format
  return `You are: "${agent.name}". Your persona is: "${agent.description}". Your motivation is: "${agent.motivation}".`
}
```

### 5. InworldGraphWrapper (`voice_agent/server/components/graph.ts`)

**Role**: Graph-based processing pipeline using Inworld Runtime

**Graph Architecture**:

**Text Input Graph**:
```
UpdateStateNode → DialogPromptBuilderNode → RemoteLLMChatNode → TextChunkingNode → RemoteTTSNode
```

**Audio Input Graph**:
```
ProxyNode (audio input)
  ├─ AudioFilterNode → RemoteSTTNode ─┐
  └─────────────────────────────────────┴─→ TextInputNode → UpdateStateNode → ...
```

**Custom Nodes**:

1. **UpdateStateNode**: Adds user message to conversation history
```typescript
class UpdateStateNode extends CustomNode {
  process(_context: ProcessContext, input: TextInput): State {
    const { text, interactionId, key } = input
    connections[key].state.messages.push({
      role: 'user',
      content: text,
      id: interactionId,
    })
    return connections[key].state
  }
}
```

2. **DialogPromptBuilderNode**: Converts state to LLM chat request
```typescript
class DialogPromptBuilderNode extends CustomNode {
  process(_context: ProcessContext, state: State): GraphTypes.LLMChatRequest {
    const conversationMessages = state.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    return new GraphTypes.LLMChatRequest({
      messages: conversationMessages,
    })
  }
}
```

3. **TextInputNode**: Merges STT result with metadata
4. **AudioFilterNode**: Extracts audio data for STT

**Remote Nodes** (Inworld Runtime primitives):
- **RemoteSTTNode**: Speech-to-text (Deepgram)
- **RemoteLLMChatNode**: LLM chat (Mistral)
- **RemoteTTSNode**: Text-to-speech (Inworld TTS)
- **TextChunkingNode**: Chunks text for streaming

### 6. MessageHandler (`voice_agent/server/components/message_handler.ts`)

**Role**: Handles WebSocket messages and orchestrates processing

**Message Types**:
```typescript
enum EVENT_TYPE {
  TEXT = 'text',
  AUDIO = 'audio',
  AUDIO_SESSION_END = 'audioSessionEnd',
  NEW_INTERACTION = 'newInteraction',
}
```

**Processing Queue** (prevents concurrent graph execution):
```typescript
private processingQueue: (() => Promise<void>)[] = []
private isProcessing = false

private addToQueue(task: () => Promise<void>) {
  this.processingQueue.push(task)
  this.processQueue()
}

private async processQueue() {
  if (this.isProcessing) return
  this.isProcessing = true

  while (this.processingQueue.length > 0) {
    const task = this.processingQueue.shift()
    if (task) {
      await task()
    }
  }

  this.isProcessing = false
}
```

**Graph Execution**:
```typescript
private async executeGraph({
  key,
  input,
  interactionId,
  graphWrapper,
}: {
  key: string
  input: TextInput | AudioInput
  interactionId: string
  graphWrapper: InworldGraphWrapper
}) {
  const { outputStream } = graphWrapper.graph.start(input)

  await this.handleResponse(
    outputStream,
    interactionId,
    this.inworldApp.connections[key].state,
  )

  this.send(EventFactory.interactionEnd(interactionId))
  graphWrapper.graph.closeExecution(outputStream)
}
```

**Response Streaming**:
```typescript
private async handleResponse(
  outputStream: GraphOutputStream,
  interactionId: string,
  state: State,
) {
  const result = await outputStream.next()

  await result.processResponse({
    TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
      for await (const chunk of ttsStream) {
        // Convert audio to WAV format
        const audioBuffer = await WavEncoder.encode({
          sampleRate: chunk.audio.sampleRate,
          channelData: [new Float32Array(chunk.audio.data)],
        })

        // Send text packet
        this.send(EventFactory.text(chunk.text, interactionId, {
          isAgent: true,
          name: state.agent.id,
        }))

        // Send audio packet
        this.send(EventFactory.audio(
          Buffer.from(audioBuffer).toString('base64'),
          interactionId,
          textPacket.packetId.utteranceId,
        ))
      }
    },
  })
}
```

### 7. AudioHandler (`voice_agent/server/components/audio_handler.ts`)

**Role**: Voice Activity Detection and speech capture

**VAD Pipeline**:
```
Audio chunks → Buffer accumulation → VAD detection → Speech capture → Normalization
```

**Configuration**:
```typescript
private readonly INPUT_SAMPLE_RATE = 16000 // Hz
private readonly FRAME_PER_BUFFER = 1024 // samples
private readonly PAUSE_DURATION_THRESHOLD_MS = 300 // ms
private readonly MIN_SPEECH_DURATION_MS = 200 // ms
private readonly PRE_ROLL_MS = 500 // ms (prevent clipping onset)
private readonly SPEECH_THRESHOLD = 0.8 // VAD confidence
```

**Speech Capture Algorithm**:
```typescript
async processAudioChunk(message: any, key: string) {
  // 1. Accumulate audio chunks until frame size reached
  this.audioBuffer.push(...message.audio)
  if (this.audioBuffer.length < this.FRAME_PER_BUFFER) return

  // 2. Run VAD on frame
  const vadResult = await this.vadClient.detectVoiceActivity(
    audioChunk,
    SPEECH_THRESHOLD,
  )

  // 3. State machine: IDLE → CAPTURING → PAUSE → CAPTURE_COMPLETE
  if (this.isCapturingSpeech) {
    this.speechBuffer.push(...audioChunk.data)

    if (vadResult === -1) {
      // Voice activity stopped
      this.pauseDuration += (audioChunk.data.length * 1000) / this.INPUT_SAMPLE_RATE

      if (this.pauseDuration > this.PAUSE_DURATION_THRESHOLD_MS) {
        // Pause exceeded threshold - capture complete
        this.isCapturingSpeech = false
        this.callbacks.onSpeechCaptured(key, [...this.speechBuffer])
        this.speechBuffer = []
      }
    } else {
      // Voice activity continues
      this.pauseDuration = 0
    }
  } else {
    if (vadResult !== -1) {
      // Voice activity detected - start capturing with pre-roll
      this.isCapturingSpeech = true
      this.speechBuffer.push(...this.preRollBuffer)
      this.speechBuffer.push(...audioChunk.data)
      this.pauseDuration = 0
    } else {
      // Maintain pre-roll buffer (rolling window)
      this.preRollBuffer.splice(0, audioChunk.data.length)
      this.preRollBuffer.push(...audioChunk.data)
    }
  }
}
```

**Pre-Roll Buffer** (prevents clipping of speech onset):
```typescript
// Keep last 500ms of audio before speech starts
private preRollBuffer: number[]

private initializePreRollWithSilence(): void {
  this.preRollBuffer = new Array(this.PRE_ROLL_MAX_SAMPLES).fill(0)
}
```

**Audio Normalization**:
```typescript
normalizeAudio(audioBuffer: number[]): number[] {
  let maxVal = 0
  for (let i = 0; i < audioBuffer.length; i++) {
    maxVal = Math.max(maxVal, Math.abs(audioBuffer[i]))
  }

  if (maxVal === 0) return audioBuffer

  const normalizedBuffer = []
  for (let i = 0; i < audioBuffer.length; i++) {
    normalizedBuffer.push(audioBuffer[i] / maxVal)
  }

  return normalizedBuffer
}
```

### 8. EventFactory (`voice_agent/server/components/event_factory.ts`)

**Role**: Factory for creating WebSocket event objects

**Event Types**:
```typescript
// Text event (from user or agent)
static text(
  text: string,
  interactionId: string,
  source: { isAgent?: boolean; isUser?: boolean; name?: string }
)

// Audio event (base64-encoded WAV)
static audio(audio: string, interactionId: string, utteranceId: string)

// Interaction end event
static interactionEnd(interactionId: string)

// Error event
static error(error: Error, interactionId: string)

// New interaction event
static newInteraction(interactionId: string, interruptionEnabled: boolean)
```

---

## Request Flow

### Flow 1: Direct WebSocket Connection (Low Latency Path)

```
Client → /ws?sessionKey=xyz → Worker validates session from KV
  ↓
Worker calls /load on container (initialize character)
  ↓
Container loads character (reuse if exists in pool)
  ↓
Worker upgrades WebSocket → Container accepts connection
  ↓
Client sends audio → Container processes with VAD → STT → LLM → TTS
  ↓
Container streams audio chunks back to client
```

**Latency**: ~50-100ms (WebSocket + container processing)

### Flow 2: API Gateway Proxy (Original Path)

```
Client → API Gateway → Validates JWT → Creates session in KV
  ↓
API Gateway → Service Binding call → Worker → Container
  ↓
Container processes request
  ↓
Response → API Gateway → Client
```

**Latency**: ~100-200ms (extra hop through API Gateway)

### Detailed WebSocket Flow

1. **Client Connection**:
```typescript
// Client connects to: wss://voice.miraichat.app/ws?sessionKey=abc123
const ws = new WebSocket('wss://voice.miraichat.app/ws?sessionKey=' + sessionKey)
```

2. **Worker Validation** (`src/worker.ts:handleDirectWebSocket`):
```typescript
// Get session from KV
const sessionData = await env.SESSION_CACHE.get(`session:${sessionKey}`)

// Check expiration
if (Date.now() > sessionData.expiresAt) {
  return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 })
}

// Call /load to initialize character
const loadResponse = await containerInstance.fetch(loadRequest)

// Upgrade WebSocket
return containerInstance.fetch(containerRequest)
```

3. **Container Handling** (`voice_agent/server/index.multi-tenant.ts`):
```typescript
// WebSocket connection event
webSocket.on('connection', (ws, request) => {
  const userId = request.headers['x-user-id']
  const characterId = request.headers['x-character-id']
  const sessionKey = request.headers['x-session-key']

  // Get or create character instance
  const inworldApp = characterPool.getCharacter(characterId)

  // Register session
  characterPool.addSession(characterId, {
    sessionKey,
    userId,
    conversationId,
    websocket: ws,
    createdAt: Date.now(),
  })

  // Create message handler
  const messageHandler = new MessageHandler(inworldApp, (data) => {
    ws.send(JSON.stringify(data))
  })

  // Handle incoming messages
  ws.on('message', (data) => {
    messageHandler.handleMessage(data, sessionKey)
  })
})
```

4. **Message Processing**:
```typescript
// Client sends text message
ws.send(JSON.stringify({
  type: 'TEXT',
  text: 'Hello, how are you?'
}))

// Client sends audio chunks
ws.send(JSON.stringify({
  type: 'AUDIO',
  audio: [audioChunk1, audioChunk2, ...] // Float32Array chunks
}))

// Client signals end of audio session
ws.send(JSON.stringify({
  type: 'AUDIO_SESSION_END'
}))
```

5. **Response Streaming**:
```typescript
// Container sends new interaction
{ type: 'NEW_INTERACTION', packetId: { interactionId: 'uuid' }, interruptionEnabled: false }

// Container sends text chunks
{ type: 'TEXT', text: { text: 'Hello!', final: true }, packetId: { utteranceId: 'uuid', interactionId: 'uuid' }, routing: { source: { isAgent: true } } }

// Container sends audio chunks (base64-encoded WAV)
{ type: 'AUDIO', audio: { chunk: 'base64...' }, packetId: { utteranceId: 'uuid', interactionId: 'uuid' } }

// Container sends interaction end
{ type: 'INTERACTION_END', packetId: { interactionId: 'uuid' } }
```

---

## Voice Processing Pipeline

### Audio Input Pipeline

```
Client Microphone
  ↓ (16kHz PCM)
WebSocket Stream
  ↓
AudioHandler.processAudioChunk()
  ↓ (buffer until 1024 samples)
VAD Detection (Silero)
  ↓ (speech detected?)
Speech Buffer Accumulation
  ↓ (with 500ms pre-roll)
Pause Detection (300ms threshold)
  ↓ (pause > threshold?)
Speech Capture Complete
  ↓
Audio Normalization
  ↓
Inworld Graph (Audio Input)
  ↓
┌────────────────┐
│ RemoteSTTNode  │ → Deepgram STT
└────────────────┘
  ↓ (text)
┌────────────────┐
│ TextInputNode  │ → Merge with metadata
└────────────────┘
  ↓
UpdateStateNode → Add to conversation
  ↓
DialogPromptBuilderNode → Format messages
  ↓
┌────────────────┐
│ RemoteLLMNode  │ → Mistral LLM (streaming)
└────────────────┘
  ↓ (text stream)
TextChunkingNode → Split into sentences
  ↓
┌────────────────┐
│ RemoteTTSNode  │ → Inworld TTS (streaming)
└────────────────┘
  ↓ (audio stream)
WAV Encoding (24kHz)
  ↓
Base64 Encoding
  ↓
WebSocket Stream
  ↓
Client Audio Playback
```

### Text Input Pipeline

```
Client Input
  ↓
WebSocket Message
  ↓
MessageHandler.handleMessage()
  ↓
UpdateStateNode → Add to conversation
  ↓
DialogPromptBuilderNode → Format messages
  ↓
RemoteLLMNode → Mistral LLM (streaming)
  ↓
TextChunkingNode → Split into sentences
  ↓
RemoteTTSNode → Inworld TTS (streaming)
  ↓
WAV Encoding + Base64
  ↓
WebSocket Stream
  ↓
Client Audio Playback
```

### LLM Configuration

```typescript
const TEXT_CONFIG = {
  maxNewTokens: 100, // ~75 words
  maxPromptLength: 1000,
  repetitionPenalty: 1,
  topP: 0.5,
  temperature: 0.1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n\n'],
}
```

**Model**: Mistral ministral-8b-latest
- Fast inference (~100-200ms)
- Good quality for conversational AI
- Cost-effective for high-volume usage

### TTS Configuration

```typescript
const ttsNode = new RemoteTTSNode({
  id: `tts-node${postfix}`,
  speakerId: voiceId, // e.g., 'Pixie', 'Stella', 'Atlas'
  modelId: ttsModelId, // 'inworld-tts-1'
  sampleRate: TTS_SAMPLE_RATE, // 24000 Hz
  temperature: 0.8,
  speakingRate: 1,
})
```

**Model**: Inworld TTS-1
- Streaming support (chunks as LLM generates)
- High-quality neural voices
- 24kHz output sample rate

### VAD Configuration

```typescript
const vadClient = await VADFactory.createLocal({
  modelPath: '/app/models/silero_vad.onnx',
})

const vadResult = await vadClient.detectVoiceActivity(
  audioChunk,
  0.8, // SPEECH_THRESHOLD
)
```

**Model**: Silero VAD (local ONNX)
- Fast inference (~1-2ms per frame)
- No external API calls
- Runs entirely in container

---

## Session Management

### Session Lifecycle

```
1. User initiates chat (frontend)
     ↓
2. API Gateway creates session
   - Generates sessionKey (UUID)
   - Stores in KV cache (15 min TTL)
   - Returns sessionKey to client
     ↓
3. Client connects WebSocket with sessionKey
   - Worker validates from KV
   - Calls /load on container
   - Upgrades WebSocket
     ↓
4. Container creates session state
   - Adds to character pool
   - Creates message handler
   - Initializes conversation history
     ↓
5. Conversation happens
   - Audio/text messages processed
   - State updated in memory
     ↓
6. Session ends
   - WebSocket closes (user leaves)
   - Session removed from pool
   - Character remains if other sessions exist
     ↓
7. Character cleanup
   - After 2 min idle (no sessions)
   - Inworld app shutdown
   - Resources freed
```

### Session Data Structure

**KV Cache** (`SESSION_CACHE`):
```typescript
interface VoiceSessionData {
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
  agentConfig: PersonalityConfig // Character personality
  createdAt: number
  expiresAt: number // 15 minutes from creation
}
```

**Container Memory** (`CharacterPoolManager`):
```typescript
interface CharacterInstance {
  characterId: string
  inworldCharacterId: string
  app: InworldApp // Shared Inworld app instance
  sessions: Map<string, SessionData>
  lastActivity: number
}

interface SessionData {
  sessionKey: string
  userId: string
  conversationId: string
  websocket: WebSocket
  createdAt: number
}
```

**Connection State** (`InworldApp.connections`):
```typescript
this.connections[sessionKey] = {
  state: {
    agent: PersonalityConfig, // Character config
    userName: string, // User's name
    messages: ChatMessage[], // Conversation history
  },
  ws: WebSocket, // WebSocket connection
}
```

### Session Expiration

1. **KV Session**: 15 minutes (API Gateway sets TTL)
2. **WebSocket Timeout**: Client-controlled (typically 5-10 minutes of inactivity)
3. **Character Cleanup**: 2 minutes after last session closes

---

## Character Pooling

### How It Works

```typescript
// User 1 connects to Character A
await characterPool.getOrCreateCharacter('char-A', 'inworld-123', config)
// Creates new InworldApp instance

// User 2 connects to Character A (reuses instance)
await characterPool.getOrCreateCharacter('char-A', 'inworld-123', config)
// Returns existing InworldApp instance

// User 3 connects to Character B (new instance)
await characterPool.getOrCreateCharacter('char-B', 'inworld-456', config)
// Creates new InworldApp instance
```

### Character Instance Sharing

**Shared Resources** (per character):
- Inworld API key
- VAD client (Silero model)
- Text input graph
- Audio input graph
- LLM/TTS/STT configurations

**Per-Session Resources**:
- WebSocket connection
- Conversation history (messages array)
- Session metadata (userId, conversationId)

### Cleanup Process

```typescript
// Every 30 seconds
setInterval(() => {
  this.cleanupIdleCharacters()
}, 30000)

async cleanupIdleCharacters() {
  for (const [characterId, instance] of this.characters.entries()) {
    // Skip if character has active sessions
    if (instance.sessions.size > 0) continue

    // Check if idle for 2+ minutes
    const idleTime = Date.now() - instance.lastActivity
    if (idleTime > 2 * 60 * 1000) {
      // Shutdown Inworld app (closes gRPC connections)
      await instance.app.shutdown()

      // Remove from pool
      this.characters.delete(characterId)
    }
  }
}
```

### Scaling Behavior

**Single Container**:
- Max 100 concurrent sessions
- Unlimited character instances (limited by memory)
- Automatic cleanup of idle characters

**Multiple Containers** (when scaled):
- Each container has its own character pool
- No shared state between containers
- Cloudflare routes based on Durable Object ID

---

## Configuration

### Environment Variables

**Server** (`voice_agent/server/constants.ts`):
```typescript
// Voice model configuration
DEFAULT_VOICE_ID = 'Pixie' // Inworld voice
DEFAULT_LLM_MODEL_NAME = 'ministral-8b-latest'
DEFAULT_PROVIDER = 'mistral'
DEFAULT_TTS_MODEL_ID = 'inworld-tts-1'
DEFAULT_VAD_MODEL_PATH = '../../models/silero_vad.onnx'

// Audio configuration
INPUT_SAMPLE_RATE = 16000 // Hz (client → server)
TTS_SAMPLE_RATE = 24000 // Hz (server → client)

// VAD configuration
PAUSE_DURATION_THRESHOLD_MS = 300 // Increase to reduce interruptions
MIN_SPEECH_DURATION_MS = 200 // Decrease to capture shorter utterances
PRE_ROLL_MS = 500 // Prevents clipping of speech onset
FRAME_PER_BUFFER = 1024 // VAD processing frame size
SPEECH_THRESHOLD = 0.8 // VAD confidence threshold (0-1)

// LLM configuration
TEXT_CONFIG = {
  maxNewTokens: 100, // ~75 words
  maxPromptLength: 1000,
  repetitionPenalty: 1,
  topP: 0.5,
  temperature: 0.1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n\n'],
}

// Server configuration
WS_APP_PORT = 4000
```

**Worker** (`wrangler.toml`):
```toml
[vars]
NODE_ENV = "production"
WS_APP_PORT = "4000"
LOG_LEVEL = "debug"

# Secrets (set with: wrangler secret put SECRET_NAME)
# INWORLD_API_KEY
# INWORLD_WORKSPACE_ID
```

**Dockerfile**:
```dockerfile
ENV NODE_ENV=production
ENV WS_APP_PORT=4000
ENV LOG_LEVEL=info
ENV ALLOWED_ORIGINS=https://miraichat.app,https://app.miraichat.app
ENV VAD_MODEL_PATH=/app/models/silero_vad.onnx
ENV GRAPH_VISUALIZATION_ENABLED=false
```

### Runtime Configuration (Per-Character)

Characters can override default voice settings:

```typescript
interface PersonalityConfig {
  id?: string
  motivations: string[]
  flaws: string[]
  dialogueStyle: string // Full system prompt
  adjectives: string[]
  voiceConfig?: {
    voiceId?: string // 'Pixie', 'Stella', 'Atlas', etc.
    pitch?: number
    speed?: number
    emotionRange?: 'low' | 'medium' | 'high'
  }
}
```

**Example**:
```json
{
  "motivations": ["Help users", "Be friendly"],
  "flaws": ["Too talkative"],
  "dialogueStyle": "You are a friendly AI assistant...",
  "adjectives": ["kind", "patient", "helpful"],
  "voiceConfig": {
    "voiceId": "Stella",
    "emotionRange": "high"
  }
}
```

---

## API Endpoints

### Worker Endpoints (`src/worker.ts`)

#### 1. WebSocket Connection (Direct Client Path)
```
GET /ws?sessionKey={sessionKey}
```

**Headers**: Standard WebSocket upgrade headers

**Flow**:
1. Validate `sessionKey` from KV cache
2. Check session expiration
3. Call `/load` on container (initialize character)
4. Upgrade WebSocket connection
5. Forward to container

**Response**: WebSocket connection

**Error Codes**:
- `400`: Missing session key
- `401`: Invalid or expired session
- `504`: Character initialization timeout (>60s)
- `500`: Internal error

---

### Container Endpoints (`voice_agent/server/index.multi-tenant.ts`)

#### 1. Health Check
```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "timestamp": "2025-01-06T10:30:00.000Z",
  "environment": "production",
  "metrics": {
    "totalCharacters": 3,
    "totalSessions": 15,
    "utilizationPercent": 15
  }
}
```

#### 2. Readiness Probe
```
GET /ready
```

**Response** (200 if ready, 503 if not):
```json
{
  "ready": true,
  "utilizationPercent": 15,
  "totalSessions": 15,
  "maxSessions": 100
}
```

**Ready Condition**: `utilizationPercent < 90`

#### 3. Metrics
```
GET /metrics
```

**Response**:
```json
{
  "pool": {
    "totalCharacters": 3,
    "totalSessions": 15,
    "maxSessions": 100,
    "utilizationPercent": 15,
    "characters": [
      {
        "characterId": "char-A",
        "sessionCount": 5,
        "idleTime": 0
      },
      {
        "characterId": "char-B",
        "sessionCount": 8,
        "idleTime": 0
      },
      {
        "characterId": "char-C",
        "sessionCount": 2,
        "idleTime": 45000
      }
    ]
  },
  "timestamp": "2025-01-06T10:30:00.000Z"
}
```

#### 4. Load Character
```
POST /load?key={sessionKey}
```

**Headers** (from API Gateway or Worker):
- `X-User-ID`: User ID
- `X-Character-ID`: Character ID (internal)
- `X-Inworld-Character-ID`: Inworld character ID
- `X-Inworld-API-Key`: Inworld API key

**Body**:
```json
{
  "agent": {
    "motivations": ["Help users"],
    "flaws": ["Too talkative"],
    "dialogueStyle": "You are a friendly AI assistant...",
    "adjectives": ["kind", "patient"],
    "voiceConfig": {
      "voiceId": "Pixie"
    }
  },
  "userName": "Alice",
  "voiceConfig": {
    "voiceId": "Pixie",
    "llmModelName": "ministral-8b-latest",
    "llmProvider": "mistral",
    "ttsModelId": "inworld-tts-1"
  }
}
```

**Response**:
```json
{
  "agent": {
    "id": "generated-uuid",
    "motivations": [...],
    "flaws": [...],
    "dialogueStyle": "...",
    "adjectives": [...],
    "voiceConfig": {...}
  }
}
```

**Error Codes**:
- `400`: Missing session key or invalid body
- `500`: Failed to load agent

#### 5. Unload Session
```
POST /unload?key={sessionKey}
```

**Headers**:
- `X-Character-ID`: Character ID

**Response**:
```json
{
  "success": true,
  "sessionKey": "abc123",
  "message": "Session unloaded successfully"
}
```

**Error Codes**:
- `400`: Missing session key
- `404`: Character not found
- `500`: Failed to unload session

#### 6. WebSocket Upgrade
```
GET /session
Upgrade: websocket
```

**Headers** (from Worker):
- `X-User-ID`: User ID
- `X-Character-ID`: Character ID
- `X-Session-Key`: Session key
- `X-Conversation-ID`: Conversation ID

**Response**: WebSocket connection

**Close Codes**:
- `4000`: Missing required headers
- `4001`: Character not loaded (call /load first)
- `4002`: Failed to setup session
- `4003`: Session not found

---

## WebSocket Protocol

### Message Format

All messages are JSON-encoded strings.

### Client → Server Messages

#### 1. Text Input
```json
{
  "type": "TEXT",
  "text": "Hello, how are you?"
}
```

#### 2. Audio Input
```json
{
  "type": "AUDIO",
  "audio": [
    { "0": 0.123, "1": 0.456, ... },
    { "0": 0.789, ... }
  ]
}
```

**Format**: Array of objects, each containing Float32Array values

**Sample Rate**: 16kHz PCM

#### 3. Audio Session End
```json
{
  "type": "AUDIO_SESSION_END"
}
```

**Purpose**: Signals end of audio recording, flushes remaining speech buffer

### Server → Client Messages

#### 1. New Interaction
```json
{
  "type": "NEW_INTERACTION",
  "date": "2025-01-06T10:30:00.000Z",
  "packetId": {
    "interactionId": "uuid-1234"
  },
  "interruptionEnabled": false
}
```

**Purpose**: Signals start of new interaction (response)

#### 2. Text Chunk
```json
{
  "type": "TEXT",
  "text": {
    "text": "Hello! I'm doing great, thanks for asking.",
    "final": true
  },
  "date": "2025-01-06T10:30:00.100Z",
  "packetId": {
    "utteranceId": "uuid-5678",
    "interactionId": "uuid-1234"
  },
  "routing": {
    "source": {
      "isAgent": true,
      "name": "char-A"
    }
  }
}
```

**Purpose**: Text response from agent (streamed as LLM generates)

#### 3. Audio Chunk
```json
{
  "type": "AUDIO",
  "audio": {
    "chunk": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA..." // base64-encoded WAV
  },
  "date": "2025-01-06T10:30:00.200Z",
  "packetId": {
    "utteranceId": "uuid-5678",
    "interactionId": "uuid-1234"
  },
  "routing": {
    "source": {
      "isAgent": true
    }
  }
}
```

**Purpose**: Audio chunk corresponding to text chunk

**Format**: Base64-encoded WAV file (24kHz PCM)

#### 4. Interaction End
```json
{
  "type": "INTERACTION_END",
  "date": "2025-01-06T10:30:01.000Z",
  "packetId": {
    "interactionId": "uuid-1234"
  }
}
```

**Purpose**: Signals completion of interaction (response finished)

#### 5. Error
```json
{
  "type": "ERROR",
  "error": "Error message",
  "date": "2025-01-06T10:30:00.500Z",
  "packetId": {
    "interactionId": "uuid-1234"
  }
}
```

**Purpose**: Error occurred during processing

**Note**: Errors like "recognition produced no text" (empty speech) are suppressed

### Interaction Flow Example

```
Client:
  { type: "TEXT", text: "What's the weather?" }

Server:
  { type: "NEW_INTERACTION", packetId: { interactionId: "int-1" } }
  { type: "TEXT", text: { text: "Let me check...", final: true }, packetId: { utteranceId: "utt-1", interactionId: "int-1" } }
  { type: "AUDIO", audio: { chunk: "base64..." }, packetId: { utteranceId: "utt-1", interactionId: "int-1" } }
  { type: "TEXT", text: { text: "It's sunny today!", final: true }, packetId: { utteranceId: "utt-2", interactionId: "int-1" } }
  { type: "AUDIO", audio: { chunk: "base64..." }, packetId: { utteranceId: "utt-2", interactionId: "int-1" } }
  { type: "INTERACTION_END", packetId: { interactionId: "int-1" } }
```

---

## Monitoring & Health Checks

### Health Check Endpoints

#### Container Health (`/health`)
- **Purpose**: Verify container is running
- **Interval**: 30 seconds (Docker HEALTHCHECK)
- **Timeout**: 3 seconds
- **Retries**: 3

**Metrics Included**:
- Uptime
- Total characters
- Total sessions
- Utilization percentage

#### Container Readiness (`/ready`)
- **Purpose**: Verify container can accept new sessions
- **Threshold**: <90% utilization
- **Use Case**: Load balancer routing

**When Not Ready**:
- Utilization ≥90% (90+ concurrent sessions)
- Returns 503 status code

### Metrics Collection

#### Pool Metrics (`/metrics`)
```json
{
  "pool": {
    "totalCharacters": 3,
    "totalSessions": 15,
    "maxSessions": 100,
    "utilizationPercent": 15,
    "characters": [
      {
        "characterId": "char-A",
        "sessionCount": 5,
        "idleTime": 0
      }
    ]
  }
}
```

#### Key Metrics to Monitor

1. **Utilization Percentage**
   - Formula: `(totalSessions / maxSessions) * 100`
   - Alert if >80% (approaching capacity)

2. **Character Count**
   - Indicates diversity of users
   - High count with low sessions = inefficient pooling

3. **Idle Time**
   - Characters with no sessions and high idle time will be cleaned up
   - Expected: <2 minutes before cleanup

4. **Session Distribution**
   - Ideally: Multiple sessions per character
   - Problem: Many characters with 1 session each

### Logging

**Log Levels**:
- `info`: General flow (character loading, session start/end)
- `debug`: Detailed flow (VAD results, graph execution)
- `error`: Errors and warnings

**Key Log Messages**:

```typescript
// Character loading
console.log('[CharacterPool] Creating new instance for character char-A')
console.log('[CharacterPool] Reusing existing character char-A (5 active sessions)')

// Session management
console.log('[CharacterPool] Session abc123 added to character char-A. Active sessions: 5')
console.log('[CharacterPool] Session abc123 removed from character char-A. Remaining sessions: 4')

// Cleanup
console.log('[CharacterPool] Cleaning up idle character char-A (idle for 120s)')
console.log('[CharacterPool] Cleaned up 2 idle characters. Remaining: 3')

// Audio processing
console.log('[AudioHandler] Speech detected! Starting capture with 500 pre-roll samples')
console.log('[AudioHandler] Speech captured! Buffer size: 24000 samples (1.50s)')
console.log('[VAD] Result: 1, Buffer: 0, Capturing: true')

// Graph execution
console.log('[MessageHandler] Starting Inworld graph execution (Interaction: int-1)')
console.log('[MessageHandler] Sending TTS chunk #1: "Hello!" (12000 samples)')
console.log('[MessageHandler] Graph execution completed in 234ms (Interaction: int-1)')

// WebSocket
console.log('[WebSocket] Connection closed for session abc123')

// Worker
console.log('[WORKER_WS] Session validated: { sessionKey: "abc123", userId: "user-1", characterId: "char-A" }')
console.log('[WORKER_WS] Character loaded successfully: { characterId: "char-A", duration: 1234 }')
```

### Error Handling

**Error Types**:

1. **Session Errors** (4xxx close codes):
   - `4000`: Missing required headers
   - `4001`: Character not loaded
   - `4002`: Failed to setup session
   - `4003`: Session not found

2. **HTTP Errors**:
   - `400`: Bad request (missing params)
   - `401`: Unauthorized (invalid session)
   - `404`: Not found (character not found)
   - `500`: Internal server error
   - `503`: Service unavailable (capacity limit)
   - `504`: Gateway timeout (character load timeout)

3. **Processing Errors**:
   - VAD errors (logged, not sent to client)
   - STT errors (sent as ERROR event)
   - LLM errors (sent as ERROR event)
   - TTS errors (sent as ERROR event)

**Error Recovery**:
```typescript
// Graceful error handling in MessageHandler
ws.on('message', (data) => {
  try {
    messageHandler.handleMessage(data, key)
  } catch (error) {
    console.error('[WebSocket] Message handling error:', error)
    ws.send(JSON.stringify({
      type: 'ERROR',
      error: 'Failed to process message',
    }))
  }
})
```

---

## Security Model

### Trust Boundary

```
┌─────────────────────────────────────────────────┐
│              Untrusted Zone                     │
│                                                 │
│  Client (Browser)                               │
│  - Can send any WebSocket message               │
│  - Cannot access API keys                       │
│  - Cannot impersonate other users               │
└─────────────────────────────────────────────────┘
                      ↓
        ┌─────────────────────────┐
        │   Session Validation    │
        │   (KV Cache Lookup)     │
        └─────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Trusted Zone                       │
│                                                 │
│  Worker Layer                                   │
│  - Validates session from KV                    │
│  - Enforces session expiration                  │
│  - Injects secrets from environment             │
│                                                 │
│  Container Layer                                │
│  - Trusts headers from Worker                   │
│  - Isolates sessions in memory                  │
│  - No direct client access to API keys          │
└─────────────────────────────────────────────────┘
```

### Authentication Flow

1. **Initial Auth** (handled by API Gateway):
```
Client → API Gateway
  ↓
JWT validation (Auth.js)
  ↓
User authenticated
  ↓
Session created in KV cache (15 min TTL)
  ↓
sessionKey returned to client
```

2. **WebSocket Auth** (handled by Worker):
```
Client → Worker (/ws?sessionKey=abc123)
  ↓
KV cache lookup
  ↓
Session valid?
  ├─ Yes → Upgrade WebSocket
  └─ No → 401 Unauthorized
```

3. **Container Trust**:
```
Worker → Container
  ↓
Headers:
  - X-User-ID (from session)
  - X-Character-ID (from session)
  - X-Inworld-API-Key (from Worker secrets)
  ↓
Container trusts Worker (internal service binding)
```

### Secret Management

**Secrets** (Cloudflare Secrets, never in code):
- `INWORLD_API_KEY`: Inworld AI API key
- `INWORLD_WORKSPACE_ID`: Inworld workspace ID

**How Secrets Flow**:
```
1. Set via: wrangler secret put INWORLD_API_KEY
2. Stored in: Cloudflare encrypted secrets storage
3. Injected into: Worker environment (env.INWORLD_API_KEY)
4. Passed to: Container via X-Inworld-API-Key header
5. Used by: Inworld Runtime SDK for API calls
```

**Secret Isolation**:
- Secrets NEVER sent to client
- Secrets NEVER logged
- Secrets NEVER in git repository
- Container receives secrets via headers (from Worker only)

### Session Isolation

Each session is isolated:

1. **Memory Isolation**:
   - Separate `connections[sessionKey]` entry
   - Separate conversation history
   - Separate WebSocket connection

2. **State Isolation**:
   - No cross-session data access
   - Character state is read-only (shared prompt)
   - User messages stored per-session

3. **Network Isolation**:
   - WebSocket connections are 1:1
   - No cross-session message leakage

### CORS Configuration

```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200,
}
```

**Production Origins**:
- `https://miraichat.app`
- `https://app.miraichat.app`

**Development**: `*` (wildcard)

### Rate Limiting

**Container Level**:
- Max 100 concurrent sessions per container
- Returns 503 if capacity exceeded

**Cloudflare Level** (configured in dashboard):
- Rate limiting rules per IP
- DDoS protection
- WAF rules

---

## Performance & Scaling

### Latency Targets

**End-to-End Latency** (user speaks → hears response):
- **Target**: <2 seconds
- **Breakdown**:
  - VAD detection: ~500ms (speech capture)
  - STT: ~100-200ms (Deepgram)
  - LLM: ~200-500ms (Mistral, streaming)
  - TTS: ~100-200ms (Inworld TTS, streaming)
  - Network: ~50-100ms (WebSocket roundtrip)

**WebSocket Latency**:
- **Worker → Container**: ~0.5-2ms (service binding)
- **Client → Worker**: ~50-100ms (depends on location)

### Throughput

**Per Container**:
- Max 100 concurrent sessions
- Each session: ~1-5 requests/minute (conversational pace)
- Total: ~100-500 requests/minute per container

**Audio Streaming**:
- Input: 16kHz PCM = ~32 KB/s per session
- Output: 24kHz PCM (WAV) = ~48 KB/s per session
- Total bandwidth: ~80 KB/s per session
- 100 sessions = ~8 MB/s per container

### Memory Usage

**Per Character Instance**:
- Inworld app: ~50-100 MB
- VAD client: ~10 MB
- Graphs: ~20 MB
- Total: ~80-130 MB per character

**Per Session**:
- Conversation history: ~1-5 KB
- WebSocket state: ~1 KB
- Audio buffers: ~100 KB
- Total: ~102-106 KB per session

**Container Total** (worst case):
- 10 characters × 130 MB = 1.3 GB
- 100 sessions × 106 KB = 10.6 MB
- Total: ~1.3 GB

### CPU Usage

**Per Request**:
- VAD: ~1-2ms CPU time
- Audio normalization: ~1ms CPU time
- Graph execution: ~5-10ms CPU time
- JSON parsing/encoding: ~1ms CPU time

**Per Container**:
- Idle: ~5% CPU
- 100 active sessions: ~50-70% CPU

### Scaling Strategy

#### Horizontal Scaling (Multiple Containers)

Cloudflare automatically scales based on demand:

```
1 container → 100 sessions
2 containers → 200 sessions
5 containers → 500 sessions
10 containers (max) → 1000 sessions
```

**Scaling Triggers**:
- Utilization >90% → Spawn new container
- Utilization <10% → Scale down container

**Container Distribution**:
- Durable Objects are distributed globally
- Sticky sessions (same session always goes to same container)

#### Vertical Scaling (Per Container)

Not configurable (Cloudflare manages container resources)

#### Database Scaling

**KV Cache**:
- Eventually consistent (edge replication)
- Low latency reads (<5ms)
- ~1 million operations/day free tier
- Scales automatically

#### Character Pool Optimization

**Current Strategy**:
- Character-based pooling (multiple sessions per character)
- 2-minute idle timeout (aggressive cleanup)
- 30-second cleanup interval

**Optimization Opportunities**:
1. Increase idle timeout to 5-10 minutes (reduce churn)
2. Pre-warm popular characters (cache warm-up)
3. Lazy initialization (defer VAD/graph loading until first use)

### Performance Tuning

#### VAD Configuration
```typescript
// Trade-offs:
PAUSE_DURATION_THRESHOLD_MS = 300 // Lower = faster response, more interruptions
MIN_SPEECH_DURATION_MS = 200 // Lower = capture shorter utterances
PRE_ROLL_MS = 500 // Higher = less clipping, more buffering
SPEECH_THRESHOLD = 0.8 // Higher = less false positives, miss quiet speech
```

#### LLM Configuration
```typescript
// Trade-offs:
maxNewTokens: 100 // Higher = longer responses, slower
temperature: 0.1 // Higher = more creative, less predictable
topP: 0.5 // Higher = more diverse, less coherent
```

#### TTS Configuration
```typescript
// Trade-offs:
temperature: 0.8 // Higher = more expressive, less consistent
speakingRate: 1 // Higher = faster speech, less natural
```

### Monitoring & Alerts

**Key Metrics to Track**:

1. **Utilization** (`/metrics`):
   - Alert if >80% for >5 minutes
   - Action: Scale up or optimize

2. **Session Count** (`/metrics`):
   - Track growth rate
   - Predict capacity needs

3. **Character Count** (`/metrics`):
   - High count = inefficient pooling
   - Optimize by promoting popular characters

4. **Latency** (custom instrumentation):
   - Track end-to-end response time
   - Alert if >3 seconds p95

5. **Error Rate** (logs):
   - Track WebSocket close codes
   - Track processing errors
   - Alert if >5% error rate

### Cold Start Optimization

**Container Cold Start**:
- First request: ~2-5 seconds (Docker image pull + Node.js startup)
- Subsequent requests: <100ms (warm container)

**Optimization Strategies**:
1. Keep containers warm (periodic health checks)
2. Reduce Docker image size (currently ~500 MB)
3. Lazy load heavy dependencies (defer until needed)

**Inworld App Initialization**:
- First character: ~1-2 seconds (VAD model load + graph build)
- Subsequent characters: ~500ms (reuse VAD client)

---

## File Structure

```
apps/workers/container/voice-agent-template/
├── Dockerfile                          # Multi-stage Docker build (prod entry: index.multi-tenant.js)
├── wrangler.toml                       # Cloudflare Container config
├── package.json                        # Root package.json (wrangler, TypeScript)
├── tsconfig.json                       # Root TypeScript config
│
├── src/
│   └── worker.ts                       # Cloudflare Worker (proxy to container)
│                                       # - VoiceAgentContainer class (Durable Object)
│                                       # - handleDirectWebSocket() (session validation)
│                                       # - fetch handler (routing)
│
├── voice_agent/
│   ├── README.md                       # Basic setup instructions
│   ├── constants.ts                    # Shared constants (sample rates, model paths)
│   │
│   ├── server/                         # Main server code (runs in container)
│   │   ├── package.json                # Server dependencies (@inworld/runtime, express, ws)
│   │   ├── tsconfig.json               # Server TypeScript config
│   │   ├── index.ts                    # Single-tenant server (legacy, not used)
│   │   ├── index.multi-tenant.ts       # **PRODUCTION ENTRY POINT**
│   │   │                               # - Multi-tenant Express + WebSocket server
│   │   │                               # - CharacterPoolManager integration
│   │   │                               # - /health, /ready, /metrics, /load, /unload endpoints
│   │   │                               # - WebSocket connection handling
│   │   │                               # - Graceful shutdown
│   │   │
│   │   ├── constants.ts                # Server-specific constants (overrides voice_agent/constants.ts)
│   │   ├── types.ts                    # TypeScript interfaces
│   │   │                               # - PersonalityConfig, Agent, ChatMessage
│   │   │                               # - State, Connection, AudioInput, TextInput
│   │   │                               # - CreateGraphPropsInterface
│   │   │
│   │   ├── factory.ts                  # (Empty placeholder, not used)
│   │   ├── helpers.ts                  # Environment variable parsing
│   │   │                               # - parseEnvironmentVariables()
│   │   │                               # - VAD model path resolution
│   │   │
│   │   ├── components/
│   │   │   ├── app.ts                  # InworldApp class
│   │   │   │                           # - initialize() - VAD + graphs
│   │   │   │                           # - load() - character loading
│   │   │   │                           # - unload() - session cleanup
│   │   │   │                           # - createSystemMessage() - prompt generation
│   │   │   │                           # - shutdown() - graceful cleanup
│   │   │   │
│   │   │   ├── graph.ts                # InworldGraphWrapper class
│   │   │   │                           # - create() - graph builder
│   │   │   │                           # - Custom nodes: UpdateStateNode, DialogPromptBuilderNode
│   │   │   │                           # - Remote nodes: STT, LLM, TTS, TextChunking
│   │   │   │                           # - Audio input vs text input graphs
│   │   │   │
│   │   │   ├── message_handler.ts      # MessageHandler class
│   │   │   │                           # - handleMessage() - message routing
│   │   │   │                           # - executeGraph() - graph execution
│   │   │   │                           # - handleResponse() - response streaming
│   │   │   │                           # - Processing queue (sequential)
│   │   │   │
│   │   │   ├── audio_handler.ts        # AudioHandler class
│   │   │   │                           # - processAudioChunk() - VAD + speech capture
│   │   │   │                           # - endAudioSession() - flush buffer
│   │   │   │                           # - normalizeAudio() - amplitude normalization
│   │   │   │                           # - Pre-roll buffer management
│   │   │   │
│   │   │   └── event_factory.ts        # EventFactory static class
│   │   │                               # - text() - text event
│   │   │                               # - audio() - audio event
│   │   │                               # - interactionEnd() - interaction end
│   │   │                               # - error() - error event
│   │   │                               # - newInteraction() - new interaction
│   │   │
│   │   └── middleware/
│   │       └── CharacterPoolManager.ts # CharacterPoolManager singleton
│   │                                   # - getOrCreateCharacter() - pooling logic
│   │                                   # - addSession() / removeSession()
│   │                                   # - cleanupIdleCharacters() - auto cleanup
│   │                                   # - getMetrics() - monitoring
│   │                                   # - shutdown() - graceful cleanup
│   │
│   └── client/                         # React frontend (not used in production)
│       └── ...                         # (stage-web is the production frontend)
│
├── models/
│   └── silero_vad.onnx                 # VAD model (Silero, local inference)
│
└── cli/                                # Inworld Runtime examples (not used)
    └── ...
```

### Key Files Deep Dive

#### `src/worker.ts` (327 lines)
- **VoiceAgentContainer** class: Durable Object configuration
- **handleDirectWebSocket()**: Session validation from KV, character loading, WebSocket upgrade
- **fetch handler**: Routing (/ws, /health, /ready, /metrics) and API Gateway proxy

#### `voice_agent/server/index.multi-tenant.ts` (417 lines)
- Express app setup with CORS
- CharacterPoolManager singleton
- Health, readiness, metrics endpoints
- /load, /unload endpoints (character management)
- WebSocket connection handler (multi-tenant)
- Graceful shutdown (SIGINT, SIGTERM, SIGUSR2)

#### `voice_agent/server/middleware/CharacterPoolManager.ts` (348 lines)
- Singleton pattern (getInstance())
- Character instance map (Map<characterId, CharacterInstance>)
- Session map per character (Map<sessionKey, SessionData>)
- Cleanup timer (30-second interval)
- Capacity enforcement (max 100 sessions)

#### `voice_agent/server/components/app.ts` (189 lines)
- VAD client initialization (Silero)
- Graph wrappers (text input + audio input)
- Character loading (system message generation)
- Support for PersonalityConfig (new) and Agent (legacy)
- Graceful shutdown (destroy graphs + VAD client)

#### `voice_agent/server/components/graph.ts` (195 lines)
- Custom nodes: UpdateStateNode, DialogPromptBuilderNode, TextInputNode, AudioFilterNode
- Remote nodes: STT, LLM, TTS, TextChunking
- Graph builder pattern
- Visualization support (debug mode)

#### `voice_agent/server/components/message_handler.ts` (272 lines)
- Message type routing (TEXT, AUDIO, AUDIO_SESSION_END)
- Processing queue (sequential graph execution)
- Graph execution orchestration
- TTS streaming (chunk-by-chunk)
- WAV encoding + base64
- Interruption support (optional)

#### `voice_agent/server/components/audio_handler.ts` (176 lines)
- Audio chunk buffering (until 1024 samples)
- VAD detection (Silero)
- Speech capture state machine
- Pre-roll buffer (500ms)
- Pause detection (300ms threshold)
- Audio normalization

---

## Integration Points

### 1. API Gateway Integration

**Service Binding** (`api-gateway` → `voice-agent-container`):

```typescript
// API Gateway worker (apps/workers/api-gateway/src/index.ts)
const voiceAgentResponse = await env.VOICE_AGENT_CONTAINER.fetch(
  new Request(url, {
    method: 'POST',
    headers: {
      'X-User-ID': userId,
      'X-Character-ID': characterId,
      'X-Inworld-Character-ID': inworldCharacterId,
      'X-Inworld-API-Key': env.INWORLD_API_KEY,
      'X-Inworld-Workspace-ID': env.INWORLD_WORKSPACE_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agent, userName, voiceConfig }),
  })
)
```

**Voice Agent receives**:
- Headers with auth context (userId, characterId)
- Secrets injected from API Gateway environment
- Agent personality configuration
- Voice configuration overrides

### 2. KV Cache Integration

**Session Validation** (`SESSION_CACHE` binding):

```typescript
// Voice Agent worker (src/worker.ts)
const sessionData = await env.SESSION_CACHE.get<VoiceSessionData>(
  `session:${sessionKey}`,
  { type: 'json' }
)
```

**Session Data Structure**:
```typescript
{
  sessionId: string
  conversationId: string
  userId: string
  characterId: string
  inworldCharacterId: string
  agentConfig: PersonalityConfig
  createdAt: number
  expiresAt: number // 15 minutes
}
```

**KV Key Pattern**: `session:{sessionKey}`

### 3. Inworld Runtime Integration

**SDK Version**: `@inworld/runtime@latest`

**Key Components Used**:

1. **VADFactory** (`@inworld/runtime/primitives/vad`):
```typescript
this.vadClient = await VADFactory.createLocal({
  modelPath: '/app/models/silero_vad.onnx',
})

const vadResult = await this.vadClient.detectVoiceActivity(audioChunk, 0.8)
```

2. **GraphBuilder** (`@inworld/runtime/graph`):
```typescript
const graphBuilder = new GraphBuilder({
  id: 'voice-agent-with-audio-input',
  apiKey: this.apiKey,
  enableRemoteConfig: false,
})

graphBuilder
  .addNode(sttNode)
  .addNode(llmNode)
  .addNode(ttsNode)
  .addEdge(sttNode, llmNode)
  .addEdge(llmNode, ttsNode)
  .setStartNode(sttNode)
  .setEndNode(ttsNode)

const graph = graphBuilder.build()
```

3. **Remote Nodes** (`@inworld/runtime/graph`):
```typescript
// STT: Deepgram
const sttNode = new RemoteSTTNode()

// LLM: Mistral
const llmNode = new RemoteLLMChatNode({
  provider: 'mistral',
  modelName: 'ministral-8b-latest',
  stream: true,
})

// TTS: Inworld TTS
const ttsNode = new RemoteTTSNode({
  speakerId: 'Pixie',
  modelId: 'inworld-tts-1',
  sampleRate: 24000,
})
```

4. **Graph Execution**:
```typescript
const { outputStream } = graph.start(input)
const result = await outputStream.next()

await result.processResponse({
  TTSOutputStream: async (ttsStream) => {
    for await (const chunk of ttsStream) {
      // chunk.text: string
      // chunk.audio: { data: number[], sampleRate: number }
    }
  },
})

graph.closeExecution(outputStream)
```

### 4. Frontend Integration

**WebSocket Connection** (apps/stage-web):

```typescript
// Client connects to voice agent
const ws = new WebSocket(
  `wss://voice.miraichat.app/ws?sessionKey=${sessionKey}`
)

// Send audio chunks (16kHz PCM)
const audioData = new Float32Array(...)
ws.send(JSON.stringify({
  type: 'AUDIO',
  audio: Array.from(audioData).map((val, i) => ({ [i]: val })),
}))

// Receive audio chunks (24kHz WAV, base64)
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  if (message.type === 'AUDIO') {
    const audioBuffer = base64ToArrayBuffer(message.audio.chunk)
    playAudio(audioBuffer)
  }
}
```

**Session Creation** (via API Gateway):
```typescript
// Client calls API Gateway to create session
const response = await fetch('/api/voice/session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    characterId: 'char-123',
  }),
})

const { sessionKey } = await response.json()
// Use sessionKey to connect WebSocket
```

### 5. Database Integration

**Character Personality** (from `packages/database-schema`):

```typescript
// PersonalityConfig is stored in database and passed to voice agent
interface PersonalityConfig {
  motivations: string[]
  flaws: string[]
  dialogueStyle: string
  adjectives: string[]
  voiceConfig?: {
    voiceId?: string
    pitch?: number
    speed?: number
    emotionRange?: 'low' | 'medium' | 'high'
  }
}
```

**Retrieved by API Gateway**:
```typescript
// API Gateway fetches character from database
const character = await db.characters.get(characterId)
const personalityConfig = character.personalityPreset

// Passed to voice agent via /load endpoint
const response = await env.VOICE_AGENT_CONTAINER.fetch(..., {
  body: JSON.stringify({
    agent: personalityConfig,
    userName: user.name,
  }),
})
```

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Fails (401 Unauthorized)

**Symptom**: Client gets 401 when connecting to `/ws`

**Causes**:
- Invalid session key
- Session expired (>15 minutes)
- Session not created in KV cache

**Debug**:
```typescript
// Check KV cache
const session = await env.SESSION_CACHE.get(`session:${sessionKey}`)
console.log('Session:', session) // null if not found

// Check expiration
if (session && Date.now() > session.expiresAt) {
  console.log('Session expired')
}
```

**Fix**:
- Create session via API Gateway first
- Use fresh session key (< 15 minutes old)
- Check KV cache bindings in wrangler.toml

#### 2. Character Load Timeout (504 Gateway Timeout)

**Symptom**: `/ws` returns 504 after 60 seconds

**Causes**:
- Container cold start (first request)
- VAD model download slow
- Inworld API slow/down
- Network issues

**Debug**:
```typescript
// Check container logs
console.log('[CharacterPool] Initializing Inworld app for character char-A', {
  hasApiKey: !!apiKey,
  apiKeyLength: apiKey?.length,
})

// Check VAD model path
console.log('Loading VAD model from:', this.vadModelPath)
// Expected: /app/models/silero_vad.onnx

// Check model file exists
ls -la /app/models/
```

**Fix**:
- Wait for cold start to complete (first request may take 2-5 seconds)
- Verify VAD model is included in Docker image
- Check Inworld API status
- Increase timeout (currently 60 seconds)

#### 3. No Audio Output

**Symptom**: Client receives text but no audio chunks

**Causes**:
- TTS node not configured
- Audio encoding failed
- WebSocket closed before audio sent

**Debug**:
```typescript
// Check TTS chunks being sent
console.log(`[MessageHandler] Sending TTS chunk #${chunkCount}: "${chunk.text}"`)

// Check audio buffer encoding
const audioBuffer = await WavEncoder.encode({
  sampleRate: chunk.audio.sampleRate,
  channelData: [new Float32Array(chunk.audio.data)],
})
console.log('Encoded audio buffer:', audioBuffer.byteLength, 'bytes')
```

**Fix**:
- Verify TTS node is in graph
- Check TTS model ID (should be 'inworld-tts-1')
- Ensure WebSocket is open (check readyState)

#### 4. VAD Not Detecting Speech

**Symptom**: Client sends audio but no speech captured

**Causes**:
- Audio sample rate mismatch (not 16kHz)
- Audio volume too low (needs normalization)
- VAD threshold too high (>0.8)
- Audio buffer not accumulating

**Debug**:
```typescript
// Check VAD results
console.log(`[VAD] Result: ${vadResult}, Buffer: ${this.audioBuffer.length}, Capturing: ${this.isCapturingSpeech}`)

// Check speech detection
console.log(`[AudioHandler] Speech detected! Starting capture with ${this.PRE_ROLL_MAX_SAMPLES} pre-roll samples`)

// Check final capture
console.log(`[AudioHandler] Speech captured! Buffer size: ${this.speechBuffer.length} samples (${(this.speechBuffer.length / this.INPUT_SAMPLE_RATE).toFixed(2)}s)`)
```

**Fix**:
- Ensure client sends 16kHz PCM audio
- Check audio volume (may need client-side normalization)
- Lower SPEECH_THRESHOLD (try 0.5-0.7)
- Verify FRAME_PER_BUFFER is 1024

#### 5. High Latency (>3 seconds)

**Symptom**: Slow response time from user input to audio output

**Causes**:
- Network latency (client far from edge)
- LLM slow (long responses)
- Multiple graph executions queued
- Container CPU throttled

**Debug**:
```typescript
// Check graph execution time
console.log(`[MessageHandler] Graph execution completed in ${duration}ms (Interaction: ${interactionId})`)

// Check queue size
console.log(`[MessageHandler] Processing queue: ${this.processingQueue.length} tasks`)
```

**Optimize**:
- Use Direct WebSocket path (bypass API Gateway)
- Reduce maxNewTokens (shorter responses)
- Lower temperature (faster inference)
- Check CPU usage (`/metrics`)

#### 6. Container at Max Capacity (503)

**Symptom**: New sessions get 503 error

**Causes**:
- Container has 100+ sessions
- No autoscaling configured
- Character pool not cleaning up idle characters

**Debug**:
```typescript
// Check metrics
const metrics = characterPool.getMetrics()
console.log('Utilization:', metrics.utilizationPercent, '%')
console.log('Total sessions:', metrics.totalSessions, '/', metrics.maxSessions)

// Check character cleanup
console.log('[CharacterPool] Cleaned up', toRemove.length, 'idle characters')
```

**Fix**:
- Enable autoscaling (Cloudflare should handle this)
- Reduce CHARACTER_IDLE_TIMEOUT (more aggressive cleanup)
- Optimize character pooling (encourage reuse)

#### 7. Memory Leak

**Symptom**: Container memory usage grows over time

**Causes**:
- Sessions not cleaned up
- Conversation history not trimmed
- Graphs not destroyed
- VAD client not destroyed

**Debug**:
```typescript
// Check session cleanup
console.log(`[CharacterPool] Session ${sessionKey} removed from character ${characterId}. Remaining sessions: ${charInstance.sessions.size}`)

// Check character cleanup
console.log(`[CharacterPool] Cleaning up idle character ${characterId}`)

// Check app shutdown
console.log('[InworldApp] Destroying text input graph...')
console.log('[InworldApp] Destroying audio input graph...')
console.log('[InworldApp] Destroying VAD client...')
```

**Fix**:
- Ensure WebSocket close event triggers cleanup
- Call `shutdown()` on idle characters
- Limit conversation history (trim to last 10 messages)

#### 8. gRPC Connection Buildup

**Symptom**: Container becomes unresponsive after hours of uptime

**Causes**:
- Inworld Runtime graphs not destroyed
- gRPC connections not closed
- Character pool not cleaning up

**Debug**:
```typescript
// Check character idle timeout
console.log('CHARACTER_IDLE_TIMEOUT:', this.CHARACTER_IDLE_TIMEOUT, 'ms')
// Expected: 120000 (2 minutes)

// Check cleanup interval
console.log('CLEANUP_INTERVAL:', this.CLEANUP_INTERVAL, 'ms')
// Expected: 30000 (30 seconds)
```

**Fix**:
- Ensure CHARACTER_IDLE_TIMEOUT is 2 minutes (not 10 minutes)
- Call `graph.destroy()` on cleanup
- Restart container periodically (Cloudflare handles this)

### Debugging Tools

#### 1. Health Check
```bash
curl https://voice.miraichat.app/health
```

**Expected**:
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "metrics": {
    "totalCharacters": 3,
    "totalSessions": 15,
    "utilizationPercent": 15
  }
}
```

#### 2. Metrics
```bash
curl https://voice.miraichat.app/metrics
```

**Expected**:
```json
{
  "pool": {
    "totalCharacters": 3,
    "totalSessions": 15,
    "maxSessions": 100,
    "utilizationPercent": 15,
    "characters": [...]
  }
}
```

#### 3. Wrangler Logs
```bash
# Tail container logs
wrangler tail --env production

# Search for errors
wrangler tail --env production | grep ERROR

# Search for specific session
wrangler tail --env production | grep abc123
```

#### 4. Docker Logs (Local Testing)
```bash
# Run container locally
docker build -t voice-agent .
docker run -p 4000:4000 --env-file .env voice-agent

# View logs
docker logs -f <container-id>
```

#### 5. Manual WebSocket Test
```javascript
// Browser console
const ws = new WebSocket('wss://voice.miraichat.app/ws?sessionKey=abc123')

ws.onopen = () => console.log('Connected')
ws.onerror = (error) => console.error('Error:', error)
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data))

// Send text message
ws.send(JSON.stringify({ type: 'TEXT', text: 'Hello!' }))
```

---

## Conclusion

The Voice Agent Container is a **production-ready, multi-tenant voice AI system** that demonstrates:

1. **Advanced Architecture**: Character-based pooling, automatic scaling, graceful degradation
2. **Low Latency**: Direct WebSocket connections, streaming audio, edge deployment
3. **Resource Efficiency**: Shared character instances, automatic cleanup, memory optimization
4. **Reliability**: Health checks, error handling, graceful shutdown
5. **Scalability**: Horizontal scaling, capacity enforcement, load balancing

**Key Innovations**:
- Character-based pooling (not user-based)
- Multi-tenant session management
- Graph-based processing pipeline
- Local VAD (no external API)
- Streaming TTS/STT integration

**Production Deployment**:
- Platform: Cloudflare Containers (beta)
- Domain: `voice.miraichat.app`
- Scaling: Up to 10 containers (1000 concurrent sessions)
- Monitoring: Health checks, metrics, logs

This documentation provides a complete reference for understanding, operating, and troubleshooting the voice agent system.

---

**Last Updated**: 2025-01-06
**Version**: 1.0.0
**Author**: Mirai Engineering Team

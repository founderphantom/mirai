# Voice Agent Container - Architecture Deep Dive

**Platform:** Cloudflare Containers (Durable Objects + Docker)
**Runtime:** Node.js 20 + Express.js + Inworld Runtime
**Last Updated:** 2025-10-07

---

## Table of Contents

1. [What are Cloudflare Containers?](#what-are-cloudflare-containers)
2. [Three-Layer Architecture](#three-layer-architecture)
3. [Component Breakdown](#component-breakdown)
4. [Multi-Tenant Architecture](#multi-tenant-architecture)
5. [Request Flow](#request-flow)
6. [Session Management](#session-management)
7. [WebSocket Communication](#websocket-communication)
8. [Container Lifecycle](#container-lifecycle)
9. [Scaling & Performance](#scaling--performance)
10. [Deployment Process](#deployment-process)
11. [Monitoring & Debugging](#monitoring--debugging)

---

## What are Cloudflare Containers?

Cloudflare Containers = **Durable Objects** + **Docker Images**

### Key Concepts:

```
┌─────────────────────────────────────────────────────┐
│ Traditional Containers (Docker, Kubernetes)         │
│  • Long-running processes                           │
│  • Manual scaling                                   │
│  • Complex orchestration                            │
└─────────────────────────────────────────────────────┘

                        VS

┌─────────────────────────────────────────────────────┐
│ Cloudflare Containers                               │
│  • Durable Object manages Docker container          │
│  • Automatic scale-to-zero                          │
│  • Programmable via Worker code                     │
│  • Distributed globally on Cloudflare edge          │
└─────────────────────────────────────────────────────┘
```

### Why Cloudflare Containers?

| Benefit | Description |
|---------|-------------|
| **Serverless** | Pay only for actual usage (scale-to-zero after 5 min idle) |
| **Global** | Deployed to Cloudflare edge locations worldwide |
| **Programmable** | Control containers via JavaScript/TypeScript |
| **Stateful** | Durable Object provides persistent state |
| **Any Language** | Docker = Run any language/runtime (Python, Go, Java, etc.) |

---

## Three-Layer Architecture

The voice agent uses a **three-layer architecture** where each layer has a specific responsibility:

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: Worker (src/worker.ts)                                 │
│                                                                  │
│  Role: Entry point and request router                           │
│  Type: Cloudflare Worker (JavaScript runtime)                   │
│  Responsibilities:                                               │
│    • Validate requests from API Gateway                         │
│    • Health checks                                              │
│    • Route to Durable Object                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
              env.VOICE_AGENT.fetch(request)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: VoiceAgentContainer (Durable Object)                   │
│                                                                  │
│  Role: Container lifecycle manager                              │
│  Type: Durable Object extends Container class                   │
│  Responsibilities:                                               │
│    • Start/stop Docker container                                │
│    • Manage container state                                     │
│    • Scale-to-zero after 5 minutes idle                         │
│    • Handle up to 10 concurrent instances                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
          Runs Docker Container on port 4000
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: Express.js Server (Inside Docker)                      │
│                                                                  │
│  Role: Voice session runtime                                    │
│  Type: Node.js 20 + Express.js + Inworld Runtime                │
│  Responsibilities:                                               │
│    • HTTP/WebSocket server                                      │
│    • Multi-tenant session management                            │
│    • Inworld Runtime integration (STT → LLM → TTS)              │
│    • Character pooling (100+ concurrent sessions per container) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### Layer 1: Worker (`src/worker.ts`)

**Purpose:** Thin routing layer that validates and forwards requests.

```typescript
export class VoiceAgentContainer extends Container {
  override defaultPort = 4000       // Express.js listens on this port
  override sleepAfter = '5m'        // Auto-shutdown after 5 min idle
}

export default {
  async fetch(request: Request, env: Env) {
    // 1. Validate headers from API Gateway
    const userId = request.headers.get('X-User-ID')
    const inworldApiKey = request.headers.get('X-Inworld-API-Key')

    if (!userId || !inworldApiKey) {
      return new Response('Forbidden', { status: 403 })
    }

    // 2. Forward to container
    return env.VOICE_AGENT.fetch(request)
  }
}
```

**Key Properties:**
- **Stateless** - No persistent state
- **Fast** - ~1ms execution time
- **Security** - Validates incoming requests
- **Simple** - Only routing logic

---

### Layer 2: VoiceAgentContainer (Durable Object)

**Purpose:** Manages Docker container lifecycle as a Durable Object.

```toml
# wrangler.toml configuration
[[containers]]
class_name = "VoiceAgentContainer"
image = "./Dockerfile"
max_instances = 10

[[durable_objects.bindings]]
name = "VOICE_AGENT"
class_name = "VoiceAgentContainer"
```

**Container Lifecycle:**

```
1. First Request
   ├── Durable Object created
   ├── Docker container starts (cold start ~10-30s)
   ├── Express.js server boots on port 4000
   └── Request forwarded to container

2. Subsequent Requests
   ├── Container already running (warm)
   └── Request forwarded immediately (~50-100ms)

3. Idle Timeout (after 5 minutes)
   ├── Container stops automatically
   ├── Durable Object persists (state saved)
   └── Memory released (cost = $0)

4. Next Request (after idle)
   ├── Container restarts (cold start again)
   └── Cycle repeats
```

**Scaling Behavior:**

```
max_instances = 10
├── Up to 10 concurrent Docker containers
├── Each container handles 100+ sessions
└── Total capacity: 1,000+ concurrent voice sessions
```

---

### Layer 3: Express.js Server (Docker Container)

**Purpose:** The actual voice agent runtime running Inworld SDK.

**Dockerfile Structure:**

```dockerfile
# Multi-stage build
FROM node:20-slim AS base
  ├── Install pnpm, Python, make, g++
  └── Install dependencies (@inworld/runtime, express, ws)

FROM base AS build
  ├── Copy server source code
  └── Compile TypeScript → dist/

FROM node:20-slim AS production
  ├── Install runtime dependencies only
  ├── Copy compiled code from build stage
  ├── Create non-root user (nodejs)
  ├── Expose port 4000
  └── CMD: node dist/index.multi-tenant.js
```

**Server Components:**

```typescript
// voice_agent/server/index.multi-tenant.ts

const app = express()
const server = createServer(app)
const webSocket = new WebSocketServer({ noServer: true })

// Character Pool Manager (Multi-tenant)
const characterPool = CharacterPoolManager.getInstance()

// Endpoints
GET  /health            → Health check with metrics
GET  /ready             → Readiness probe (capacity check)
GET  /metrics           → Detailed metrics
POST /load              → Load character for session
WS   /                  → WebSocket for voice streaming
```

---

## Multi-Tenant Architecture

### Why Multi-Tenant?

**Single-Tenant (Bad):**
```
User 1 → Container 1 → Inworld App 1
User 2 → Container 2 → Inworld App 2
User 3 → Container 3 → Inworld App 3
...
100 users → 100 containers → $$$ expensive
```

**Multi-Tenant (Good):**
```
User 1 ┐
User 2 ├→ Container 1 → Character Pool → Inworld Apps (pooled)
User 3 ┘
...
100 users → 1 container → $ cheap
```

### Character Pool Manager

**Concept:** Users talking to the same character share one Inworld app instance.

```typescript
class CharacterPoolManager {
  private characterPool: Map<string, InworldApp> = new Map()

  async getOrCreateCharacter(characterId: string) {
    // Check if character already loaded
    if (this.characterPool.has(characterId)) {
      return this.characterPool.get(characterId)
    }

    // Create new Inworld app for this character
    const inworldApp = await InworldGraphWrapper.create({
      llmModelName: 'gpt-4o-mini',
      voiceId: 'en-US-Neural2-J',
      // ... character config
    })

    this.characterPool.set(characterId, inworldApp)
    return inworldApp
  }
}
```

**Example Scenario:**

```
Character "Luna" (ID: char-123)
├── Session 1 (User Alice) ┐
├── Session 2 (User Bob)   ├─→ ONE Inworld App Instance
└── Session 3 (User Carol) ┘

Character "Kai" (ID: char-456)
├── Session 4 (User Dave)  ┐
└── Session 5 (User Eve)   ├─→ DIFFERENT Inworld App Instance
                           ┘
```

**Benefits:**
- 💰 Lower costs (shared resources)
- ⚡ Faster session start (character pre-loaded)
- 📈 Higher capacity (100+ sessions per container)
- 🧠 Shared context (if implementing character memory)

---

## Request Flow

### Complete Request Path

```
1. Client (Browser)
      ↓ WebSocket
   https://api.miraichat.app/api/voice/ws

2. API Gateway Worker (mirai-api-gateway)
      ├── Authenticate user (Better-Auth)
      ├── Create VoiceSession (Durable Object)
      ├── Add headers:
      │   • X-User-ID: user-123
      │   • X-Inworld-API-Key: sk-xxx
      │   • X-Character-ID: char-123
      │   • X-Session-Key: sess-abc
      └── Forward via Service Binding
            ↓
   env.VOICE_AGENT.fetch(request)

3. Voice Agent Worker (voice-agent-container)
      ├── Validate headers
      └── Forward to container
            ↓
   env.VOICE_AGENT.fetch(request)

4. VoiceAgentContainer (Durable Object)
      ├── Start container if not running
      └── Proxy to Express.js on port 4000
            ↓
   http://localhost:4000

5. Express.js Server (Inside Docker)
      ├── WebSocket upgrade
      ├── Load character from pool
      ├── Initialize Inworld connection
      └── Stream audio/text
            ↓
   Inworld Platform API
      ├── STT (Speech-to-Text)
      ├── LLM (Language Model)
      └── TTS (Text-to-Speech)
```

### Data Flow Diagram

```
┌──────────┐
│ Client   │ Microphone audio (16kHz, PCM)
└──────────┘
      ↓
┌──────────┐
│ API GW   │ WebSocket proxy
└──────────┘
      ↓
┌──────────┐
│ Worker   │ Validate & route
└──────────┘
      ↓
┌──────────┐
│ Durable  │ Manage container
│ Object   │
└──────────┘
      ↓
┌──────────┐
│ Express  │ Inworld Runtime
│ Server   │ ├── Receive audio
│          │ ├── Send to Inworld
│          │ ├── Get TTS audio back
│          │ └── Send to client
└──────────┘
      ↓
┌──────────┐
│ Inworld  │ STT → LLM → TTS
│ Platform │
└──────────┘
```

---

## Session Management

### Three Types of Session State

| Layer | Session Type | Stored Where | Purpose |
|-------|-------------|--------------|---------|
| **API Gateway** | VoiceSession (Durable Object) | Durable Object storage | Client WebSocket connection, metadata |
| **Express.js** | inworldApp.connections[sessionKey] | In-memory (Map) | Inworld Runtime connection state |
| **Database** | voice_sessions table | D1 Database | Persistent records for billing/analytics |

### Session Lifecycle

```typescript
// 1. Start Session (API Gateway)
POST /api/voice/session/start
  ├── Create conversation in D1
  ├── Create VoiceSession Durable Object
  ├── Generate sessionKey
  └── Return WebSocket URL

// 2. Connect WebSocket (Client → API Gateway)
WS /api/voice/ws?sessionKey=xxx
  ├── Upgrade to WebSocket
  ├── Forward to voice agent worker
  └── Proxy to Express.js container

// 3. Load Character (Express.js)
POST /load?key=sess-abc
  ├── Get/create character from pool
  ├── Initialize inworldApp.connections[sessionKey]
  └── Ready for audio streaming

// 4. Stream Audio (Bidirectional)
WS /
  ├── Client → Express → Inworld (microphone audio)
  └── Inworld → Express → Client (TTS audio)

// 5. End Session (API Gateway)
POST /api/voice/session/:id/end
  ├── Close WebSocket
  ├── Clean up container session
  ├── Update D1 with metrics
  └── Release resources
```

---

## WebSocket Communication

### Connection Upgrade Flow

```typescript
// 1. Client requests WebSocket upgrade
GET /api/voice/ws HTTP/1.1
Upgrade: websocket
Connection: Upgrade

// 2. API Gateway VoiceSession handles upgrade
const pair = new WebSocketPair()
const [client, server] = Object.values(pair)
this.state.acceptWebSocket(server)  // Durable Object manages connection
return new Response(null, { status: 101, webSocket: client })

// 3. Express.js WebSocket server accepts connection
webSocket.on('connection', (ws, request) => {
  const sessionKey = request.headers['x-session-key']

  // Get character instance
  const inworldApp = await characterPool.getOrCreateCharacter(characterId)

  // Store WebSocket in session
  inworldApp.connections[sessionKey].ws = ws

  // Handle messages
  ws.on('message', async (data: RawData) => {
    // Forward audio to Inworld Runtime
    await messageHandler.send(data)
  })
})
```

### Message Types

```typescript
// Client → Server
{
  "type": "AUDIO",
  "data": ArrayBuffer  // PCM audio, 16kHz, 16-bit
}

{
  "type": "TEXT",
  "text": "Hello, how are you?"
}

// Server → Client
{
  "type": "TRANSCRIPT",
  "text": "I'm doing great, thanks!",
  "speaker": "CHARACTER"
}

{
  "type": "AUDIO",
  "data": ArrayBuffer  // TTS audio from Inworld
}

{
  "type": "EMOTION",
  "emotion": "JOY",
  "intensity": 0.8
}

{
  "type": "ERROR",
  "error": "Connection failed",
  "code": "INWORLD_ERROR"
}
```

---

## Container Lifecycle

### Cold Start (First Request)

```
Time: 0s
├── Worker receives request
├── Durable Object created
└── Docker container start initiated

Time: 5s
├── Base image pulled (cached after first time)
└── Node.js process starts

Time: 10s
├── Express.js server boots
├── Inworld SDK initializes
└── VAD model loads

Time: 15s
├── Server listening on port 4000
└── Health check passes

Time: 20s
└── Request forwarded to container
    └── Response returned to client

Total cold start: ~20 seconds (first deployment)
Total warm start: ~50-100ms (subsequent requests)
```

### Warm State (Active Container)

```
Request arrives
  ├── Worker validates (1ms)
  ├── Durable Object routes (5ms)
  ├── Container processes (50ms)
  └── Response sent (56ms total)
```

### Scale-to-Zero

```
Last request at: 10:00:00 AM
├── Container active
└── Serving requests

No requests received for 5 minutes...

Timeout at: 10:05:00 AM
├── Container stops
├── Process terminated
├── Memory released
└── Cost drops to $0

Next request at: 10:10:00 AM
├── Cold start triggered
└── ~20s startup time
```

### Multiple Instances

```
Request load: 150 concurrent sessions

Cloudflare automatically scales:
├── Instance 1: 100 sessions (at capacity)
├── Instance 2: 50 sessions
└── Total: 2 containers running

max_instances = 10 (can scale up to 10 if needed)

Each instance is independent:
├── Own Durable Object
├── Own Docker container
├── Own character pool
└── Own memory/CPU allocation
```

---

## Scaling & Performance

### Capacity Planning

| Metric | Value | Notes |
|--------|-------|-------|
| **Max sessions per container** | 100 | Configured in CharacterPoolManager |
| **Max container instances** | 10 | Configured in wrangler.toml |
| **Total capacity** | 1,000 sessions | 10 instances × 100 sessions |
| **Cold start time** | ~20s | First deployment only |
| **Warm start time** | ~50ms | Subsequent requests |
| **Idle timeout** | 5 minutes | Auto scale-to-zero |
| **Memory per instance** | ~512MB | Node.js + Inworld SDK |

### Performance Optimization

**1. Character Pooling**
```typescript
// BAD: New Inworld app per session
async function handleSession(sessionKey, characterId) {
  const inworldApp = new InworldApp()  // Slow! ~5s initialization
  await inworldApp.initialize()
}

// GOOD: Shared Inworld app per character
const characterPool = new Map<string, InworldApp>()
async function handleSession(sessionKey, characterId) {
  let inworldApp = characterPool.get(characterId)
  if (!inworldApp) {
    inworldApp = await InworldApp.create()  // Only once per character
    characterPool.set(characterId, inworldApp)
  }
  return inworldApp  // Instant for subsequent sessions!
}
```

**2. Connection Reuse**
```typescript
// Each character maintains persistent Inworld connection
inworldApp.connections[sessionKey] = {
  state: { messages: [] },
  ws: clientWebSocket
}

// Benefit: No reconnection overhead
// Inworld connection stays alive across multiple sessions
```

**3. Docker Layer Caching**
```dockerfile
# Copy dependencies first (cached layer)
COPY package.json ./
RUN pnpm install

# Copy source code last (changes frequently)
COPY . ./
RUN pnpm build

# Benefit: Faster rebuilds (only recompile changed code)
```

### Monitoring Metrics

```typescript
GET /metrics
{
  "totalCharacters": 5,        // Unique characters loaded
  "totalSessions": 45,          // Active voice sessions
  "utilizationPercent": 45,     // 45% of 100 max capacity
  "characterBreakdown": {
    "char-123": {
      "name": "Luna",
      "sessions": 20
    },
    "char-456": {
      "name": "Kai",
      "sessions": 25
    }
  }
}
```

---

## Deployment Process

### How Wrangler Builds and Deploys

```bash
wrangler deploy

# Step 1: Bundle Worker Code
├── Compiles src/worker.ts → JavaScript
├── Bundles dependencies
└── Output: ~50KB worker bundle

# Step 2: Build Docker Image
├── Reads ./Dockerfile
├── Runs multi-stage build:
│   ├── Stage: base (install deps)
│   ├── Stage: build (compile TypeScript)
│   └── Stage: production (copy compiled code)
├── Output: ~500MB Docker image

# Step 3: Upload to Cloudflare
├── Pushes Docker image to Cloudflare registry
├── Deploys Worker code
└── Creates/updates Durable Object class

# Step 4: Apply Migrations
├── Runs [[migrations]] from wrangler.toml
└── Creates VoiceAgentContainer Durable Object

# Step 5: Deploy Complete
└── URL: https://voice-agent-container.founder-968.workers.dev
```

### wrangler.toml Configuration

```toml
name = "voice-agent-container"
main = "src/worker.ts"
compatibility_date = "2025-01-01"
workers_dev = true

# Container configuration
[[containers]]
class_name = "VoiceAgentContainer"    # Must match exported class
image = "./Dockerfile"                # Path to Dockerfile
max_instances = 10                    # Max concurrent containers

# Durable Object binding
[[durable_objects.bindings]]
name = "VOICE_AGENT"                  # Used as env.VOICE_AGENT
class_name = "VoiceAgentContainer"    # Same as above

# Migrations (first deployment)
[[migrations]]
tag = "v1"
new_sqlite_classes = ["VoiceAgentContainer"]

# Environment variables (passed to container)
[vars]
NODE_ENV = "production"
WS_APP_PORT = "4000"
LOG_LEVEL = "info"
```

### Secrets Management

```bash
# Set secrets (encrypted, not in wrangler.toml)
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID

# Secrets are injected into container via environment variables
# Access in Express.js:
const apiKey = process.env.INWORLD_API_KEY
```

---

## Monitoring & Debugging

### Health Checks

```bash
# Worker health (bypasses container)
curl https://voice-agent-container.founder-968.workers.dev/health
# Response: { "status": "healthy", "environment": "production" }

# Container health (from Express.js)
curl https://voice-agent-container.founder-968.workers.dev/health \
  -H "X-User-ID: user-123" \
  -H "X-Inworld-API-Key: sk-xxx"
# Response: {
#   "status": "healthy",
#   "uptime": 1234,
#   "metrics": { "totalSessions": 45 }
# }

# Readiness check (capacity)
curl https://voice-agent-container.founder-968.workers.dev/ready \
  -H "X-User-ID: user-123" \
  -H "X-Inworld-API-Key: sk-xxx"
# Response: { "ready": true, "utilizationPercent": 45 }
```

### Logs

```bash
# Stream real-time logs
wrangler tail voice-agent-container

# Filter by status
wrangler tail voice-agent-container --status error

# Sample log output:
# [WebSocket] Connected - Session: sess-abc, Character: char-123
# [Load] Character Luna loaded for session sess-abc
# [WebSocket] Disconnected - Session: sess-abc
```

### Common Issues

#### 1. Cold Start Timeout
```
Error: Container start timeout (>30s)

Causes:
├── Large Docker image (>1GB)
├── Slow dependency installation
└── Heavy initialization (VAD model loading)

Solutions:
├── Optimize Dockerfile (multi-stage build)
├── Cache dependencies
└── Lazy-load heavy models
```

#### 2. Out of Memory
```
Error: Container killed (OOM)

Causes:
├── Too many sessions per container
├── Memory leak in Inworld SDK
└── Large audio buffers

Solutions:
├── Reduce max sessions (100 → 50)
├── Implement session cleanup
└── Stream audio instead of buffering
```

#### 3. WebSocket Disconnect
```
Error: WebSocket closed unexpectedly

Causes:
├── Container scaled to zero during session
├── Inworld API error
└── Client network issue

Solutions:
├── Increase sleepAfter (5m → 15m)
├── Implement automatic reconnection
└── Add heartbeat/ping messages
```

---

## Summary

### Key Takeaways

1. **Three-Layer Design**
   - Worker (routing) → Durable Object (lifecycle) → Docker (runtime)
   - Each layer has a single responsibility

2. **Multi-Tenant Efficiency**
   - 100+ sessions per container via character pooling
   - Shared Inworld apps reduce costs and latency

3. **Automatic Scaling**
   - Scale-to-zero after 5 minutes idle
   - Auto-scale up to 10 instances under load

4. **Stateful + Serverless**
   - Durable Objects provide persistent state
   - Pay only for active usage

5. **Production-Ready**
   - Health checks, metrics, logging
   - Graceful shutdown and error handling

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [INTEGRATIONS.md](./INTEGRATIONS.md) - Inworld Runtime integration details
- [SETUP.md](./SETUP.md) - Local development setup
- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [Inworld Runtime Docs](https://docs.inworld.ai/docs/node/templates/voice-agent)

---

**Maintained by:** Phantom Systems Inc
**Last Updated:** 2025-10-07

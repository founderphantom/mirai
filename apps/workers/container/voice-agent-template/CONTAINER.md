# Voice Agent Container - Implementation Guide

This document provides technical details about the Cloudflare Container implementation for the Inworld Runtime Voice Agent.

## Overview

The voice agent container is a Docker-based service that runs on Cloudflare's Container platform, providing:

- **WebSocket server** for real-time voice communication
- **HTTP API** for agent loading and session management
- **Inworld Runtime integration** for STT/LLM/TTS pipeline
- **Health checks** and status hooks for monitoring
- **Auto-scaling** with scale-to-zero capability

---

## Container Architecture

### Dockerfile Structure

The multi-stage Dockerfile optimizes for:
1. **Build efficiency** (layer caching)
2. **Production size** (minimal dependencies)
3. **Security** (non-root user, tini init)
4. **Performance** (native builds, production deps only)

**Stages:**

```dockerfile
FROM node:20-alpine AS base        # Base with build tools
FROM base AS development           # Development stage
FROM base AS build                 # Build TypeScript
FROM node:20-alpine AS production  # Final production image
```

### Container Entry Point

```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

**Why tini?**
- Proper signal handling (SIGTERM, SIGINT)
- Zombie process reaping
- Graceful shutdown support

---

## Worker Integration

### Container Class Definition

```typescript
export class VoiceAgentContainer extends Container {
  defaultPort = 4000              // Container listening port
  sleepAfter = '5m'               // Idle timeout
  maxInstances = 10               // Max concurrent instances
}
```

### Request Flow

```
┌─────────────┐
│  Client     │
└──────┬──────┘
       │ HTTPS/WSS
       ↓
┌─────────────────────────┐
│  Cloudflare Worker      │
│  (worker.ts)            │
│  ┌───────────────────┐  │
│  │ Authentication    │  │
│  │ Session Mgmt      │  │
│  │ Rate Limiting     │  │
│  └───────────────────┘  │
└──────┬──────────────────┘
       │ Container.fetch()
       ↓
┌─────────────────────────┐
│  Container Instance     │
│  (Express.js)           │
│  ┌───────────────────┐  │
│  │ WebSocket Server  │  │
│  │ Inworld Runtime   │  │
│  │ STT/LLM/TTS       │  │
│  └───────────────────┘  │
└──────┬──────────────────┘
       │ HTTPS/API
       ↓
┌─────────────────────────┐
│  Inworld Platform       │
└─────────────────────────┘
```

---

## API Endpoints

### Worker Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/health` | GET | Health check | No |
| `/api/voice-agent/create-session` | POST | Create voice session | Yes |
| `/api/voice-agent/end-session` | POST | End voice session | Yes |

### Container Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/health` | GET | Container health | No |
| `/ready` | GET | Readiness probe | No |
| `/metrics` | GET | Metrics (dev only) | No |
| `/load` | POST | Load agent | Yes |
| `/unload` | POST | Unload agent | Yes |
| `/session` | WebSocket | Voice session | Yes |

---

## Session Management

### Session Creation Flow

```typescript
// 1. Client requests session
POST /api/voice-agent/create-session
{
  "characterId": "char-uuid",
  "agentConfig": {
    "name": "Agent Name",
    "description": "Agent description",
    "motivation": "Agent motivation"
  }
}

// 2. Worker creates session
const sessionKey = crypto.randomUUID()
const sessionData = {
  sessionId,
  conversationId,
  userId,
  characterId,
  agentConfig,
  createdAt: Date.now(),
  expiresAt: Date.now() + 300000, // 5 min
}

// 3. Store in KV cache
await env.SESSION_CACHE.put(
  `session:${sessionKey}`,
  JSON.stringify(sessionData),
  { expirationTtl: 300 }
)

// 4. Return WebSocket URL
return {
  sessionKey,
  websocketUrl: `wss://domain/session?key=${sessionKey}`
}
```

### WebSocket Connection

```typescript
// 1. Client connects
const ws = new WebSocket(websocketUrl)

// 2. Worker validates session
const sessionData = await env.SESSION_CACHE.get(`session:${key}`, 'json')

if (!sessionData) {
  return new Response('Invalid session', { status: 401 })
}

// 3. Forward to container
const container = getContainer(env.VOICE_AGENT)
return container.fetch(request)

// 4. Container handles connection
webSocket.on('connection', (ws, request) => {
  // Initialize Inworld app
  // Handle messages
  // Stream audio
})
```

---

## Inworld Runtime Integration

### Graph Builder Configuration

The voice agent uses Inworld's GraphBuilder for STT → LLM → TTS pipeline:

```typescript
const graph = new GraphBuilder({
  id: 'voice-agent-graph',
  apiKey: process.env.INWORLD_API_KEY,
})
  .addNode(sttNode)
  .addNode(llmNode)
  .addNode(ttsNode)
  .setStartNode(sttNode)
  .setEndNode(ttsNode)
  .build()
```

### Node Configuration

**STT Node:**
```typescript
const sttNode = new RemoteSTTNode({
  id: 'stt_node',
  provider: 'google',
  modelName: 'chirp-2',
  sampleRate: 16000,
  language: 'en-US',
})
```

**LLM Node:**
```typescript
const llmNode = new RemoteLLMChatNode({
  id: 'llm_node',
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  stream: true,
  temperature: 0.7,
  maxTokens: 500,
})
```

**TTS Node:**
```typescript
const ttsNode = new RemoteTTSNode({
  id: 'tts_node',
  provider: 'google',
  voiceId: 'en-US-Neural2-F',
  sampleRate: 24000,
})
```

---

## Message Handling

### Message Types

```typescript
enum EVENT_TYPE {
  TEXT = 'text',
  AUDIO = 'audio',
  AUDIO_SESSION_END = 'audioSessionEnd',
  NEW_INTERACTION = 'newInteraction',
}
```

### Audio Flow

```
┌────────────┐
│  Client    │
│  (Browser) │
└─────┬──────┘
      │ 1. Audio chunks (WebSocket)
      ↓
┌─────────────────┐
│  Container      │
│  MessageHandler │
└─────┬───────────┘
      │ 2. Forward to STT
      ↓
┌─────────────────┐
│  Inworld STT    │
│  (Chirp)        │
└─────┬───────────┘
      │ 3. Transcribed text
      ↓
┌─────────────────┐
│  Inworld LLM    │
│  (GPT-4o-mini)  │
└─────┬───────────┘
      │ 4. Response text
      ↓
┌─────────────────┐
│  Inworld TTS    │
│  (Google)       │
└─────┬───────────┘
      │ 5. Audio chunks
      ↓
┌─────────────────┐
│  Container      │
│  WebSocket      │
└─────┬───────────┘
      │ 6. Stream to client
      ↓
┌────────────┐
│  Client    │
│  (Browser) │
└────────────┘
```

---

## Database Integration

### Session Tracking

```sql
-- Voice sessions table
CREATE TABLE voice_sessions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'paused', 'ended'
  websocket_url TEXT,
  total_audio_seconds INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);
```

### Usage Tracking

```sql
-- Usage events table
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'voice_minutes'
  quantity INTEGER NOT NULL,
  metadata JSON,
  created_at INTEGER NOT NULL,
  polar_synced BOOLEAN DEFAULT FALSE
);
```

### Query Examples

```typescript
// Create voice session
await env.DB.prepare(`
  INSERT INTO voice_sessions (
    id, conversation_id, user_id, character_id,
    status, started_at
  ) VALUES (?, ?, ?, ?, 'active', ?)
`).bind(sessionId, conversationId, userId, characterId, Date.now()).run()

// End session and track usage
await env.DB.prepare(`
  UPDATE voice_sessions
  SET status = 'ended', ended_at = ?, total_audio_seconds = ?
  WHERE id = ?
`).bind(endedAt, durationSeconds, sessionId).run()

await env.DB.prepare(`
  INSERT INTO usage_events (
    id, user_id, event_type, quantity, metadata
  ) VALUES (?, ?, 'voice_minutes', ?, ?)
`).bind(
  crypto.randomUUID(),
  userId,
  Math.ceil(durationSeconds / 60),
  JSON.stringify({ sessionId })
).run()
```

---

## Performance Optimization

### Container Scaling

**Scale-to-Zero:**
- Containers sleep after 5 minutes of inactivity
- Wake up on next request (~500ms cold start)
- Reduces costs by ~80% for low traffic

**Auto-Scaling:**
- Cloudflare automatically scales based on demand
- Max 10 instances (configurable)
- Load balanced across instances

### Caching Strategy

**KV Cache:**
- Session data (5 min TTL)
- User profiles (1 hour TTL)
- Character configs (24 hour TTL)

**Example:**
```typescript
// Cache character config
const character = await env.SESSION_CACHE.get(
  `character:${characterId}`,
  { type: 'json' }
)

if (!character) {
  const result = await env.DB.prepare(
    'SELECT * FROM characters WHERE id = ?'
  ).bind(characterId).first()

  await env.SESSION_CACHE.put(
    `character:${characterId}`,
    JSON.stringify(result),
    { expirationTtl: 86400 } // 24 hours
  )
}
```

### Memory Management

**Audio Buffering:**
```typescript
// Stream audio instead of buffering entire file
const audioStream = createReadStream(audioPath, {
  highWaterMark: 4096 // 4KB chunks
})

for await (const chunk of audioStream) {
  ws.send(chunk)
}
```

**Connection Cleanup:**
```typescript
ws.on('close', () => {
  // Clean up resources
  if (connections[key]) {
    connections[key].ws = null
    delete connections[key]
  }
})
```

---

## Security

### Authentication

**JWT Verification:**
```typescript
async function verifyToken(token: string, secret: string): Promise<string | null> {
  const [header, payload, signature] = token.split('.')

  // Verify signature (production: use proper JWT library)
  // Check expiration
  // Extract user ID

  return userId
}
```

### Input Validation

```typescript
// Validate session key
if (!key || !/^[a-f0-9-]{36}$/i.test(key)) {
  return new Response('Invalid session key', { status: 400 })
}

// Sanitize text input
const sanitizedText = text.replace(/[^\w\s.,!?'-]/g, '')
```

### Rate Limiting

```typescript
// Per-user rate limiting
const rateLimitKey = `ratelimit:${userId}:${path}`
const count = await env.SESSION_CACHE.get(rateLimitKey)

if (parseInt(count || '0') > 100) {
  return new Response('Rate limit exceeded', { status: 429 })
}

await env.SESSION_CACHE.put(rateLimitKey, (parseInt(count || '0') + 1).toString(), {
  expirationTtl: 60
})
```

---

## Monitoring

### Health Checks

```typescript
// Liveness probe
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// Readiness probe
app.get('/ready', (req, res) => {
  if (inworldApp.isInitialized) {
    res.status(200).json({ status: 'ready' })
  } else {
    res.status(503).json({ status: 'not_ready' })
  }
})
```

### Metrics

```typescript
// Track key metrics
env.ANALYTICS?.writeDataPoint({
  blobs: ['websocket_connection'],
  doubles: [1],
  indexes: [`user:${userId}`, `session:${sessionKey}`],
})

env.ANALYTICS?.writeDataPoint({
  blobs: ['session_duration'],
  doubles: [durationSeconds],
  indexes: [`user:${userId}`],
})
```

---

## Error Handling

### Container Errors

```typescript
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error:', {
      message: err.message,
      context: err.context,
    })
  }
  // Don't exit in production
})

process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught exception:', err)
  process.exit(1) // Exit on uncaught exceptions
})
```

### Worker Errors

```typescript
try {
  return await handleRequest(request, env)
} catch (error) {
  console.error('Worker error:', error)

  return new Response(JSON.stringify({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

## Testing

### Unit Tests

```typescript
// test/worker.test.ts
import { describe, it, expect } from 'vitest'
import worker from '../src/worker'

describe('Worker', () => {
  it('should return health check', async () => {
    const request = new Request('https://example.com/health')
    const response = await worker.fetch(request, mockEnv, mockCtx)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})
```

### Integration Tests

```bash
# Test container locally
docker run -p 4000:4000 --env-file .env voice-agent-runtime:latest &

# Wait for container to start
sleep 5

# Test health endpoint
curl http://localhost:4000/health | jq .

# Test WebSocket
wscat -c ws://localhost:4000/session?key=test-key

# Cleanup
docker stop $(docker ps -q --filter ancestor=voice-agent-runtime:latest)
```

---

## Best Practices

1. **Use environment variables** for configuration
2. **Enable health checks** for all containers
3. **Implement graceful shutdown** for SIGTERM/SIGINT
4. **Cache frequently accessed data** in KV
5. **Stream large data** instead of buffering
6. **Clean up resources** on connection close
7. **Log structured data** for better debugging
8. **Use non-root user** in Docker
9. **Minimize Docker image size** for faster cold starts
10. **Test locally** before deploying to production

---

## Additional Resources

- [Cloudflare Containers Best Practices](https://developers.cloudflare.com/containers/best-practices/)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Inworld Runtime SDK](https://docs.inworld.ai/docs/node/overview)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06

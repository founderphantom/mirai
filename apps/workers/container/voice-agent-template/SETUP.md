# Voice Agent Container - Setup & Deployment Guide

**Version:** 2.0 (Multi-Tenant)
**Last Updated:** 2025-10-07
**Integration Status:** ✅ Ready for MVP

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Deployment](#deployment)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Cloudflare Account** with Workers Paid plan ($5/month)
- **Inworld AI Account** with API access
- **pnpm** v8.0+ (for monorepo management)
- **Docker** (for building container images)
- **Node.js** v20+ (for local development)

### Required Cloudflare Resources

You'll need to create these before deployment:

```bash
# 1. Create KV namespace for session cache
wrangler kv:namespace create SESSION_CACHE --env production

# 2. Create R2 bucket for voice recordings (optional for MVP)
wrangler r2 bucket create mirai-voice-recordings

# 3. Create D1 database (if not already created)
wrangler d1 create mirai-production

# Note the IDs returned - you'll need them for wrangler.toml
```

---

## Architecture Overview

### Multi-Tenant Container Design

```
┌─────────────────────────────────────────────────────────────┐
│               Client (Browser/Mobile App)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/WSS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway Worker (Hono)                   │
├─────────────────────────────────────────────────────────────┤
│  • Better-Auth JWT validation                               │
│  • Session creation → KV cache (5 min TTL)                  │
│  • WebSocket proxy → Container                              │
└────────────────────────┬────────────────────────────────────┘
                         │ Container.fetch()
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         Voice Agent Container (Multi-Tenant)                 │
├─────────────────────────────────────────────────────────────┤
│  CharacterPoolManager                                       │
│  ├─ Character A (Inworld App)                               │
│  │  ├─ User 1, User 2, User 5 (sessions)                    │
│  ├─ Character B (Inworld App)                               │
│  │  ├─ User 3, User 7 (sessions)                            │
│  └─ Character C (Inworld App)                               │
│     └─ User 4, User 6, User 8 (sessions)                    │
│                                                             │
│  Max: 100 concurrent sessions per container                │
│  Auto-cleanup: Idle characters after 10 minutes            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS API
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Inworld Platform API                        │
│  • STT (Chirp-2, Whisper)                                   │
│  • LLM (GPT-4o, Claude, Gemini)                             │
│  • TTS (Google, ElevenLabs)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Character-based pooling**: One Inworld app instance per character (not per user)
- **Session multiplexing**: Multiple users share the same character instance
- **Automatic scaling**: Cloudflare scales containers based on load
- **Scale-to-zero**: Containers sleep after 5 min idle, saving costs

---

## Step-by-Step Setup

### 1. Configure Environment Variables

#### API Gateway `.env` (Development only)

```bash
# apps/workers/api-gateway/.env
ENVIRONMENT=development
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=your_secret_here

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Polar
POLAR_ACCESS_TOKEN=your_polar_token
POLAR_ORGANIZATION_ID=your_org_id

# Inworld
INWORLD_API_KEY=your_inworld_api_key
INWORLD_WORKSPACE_ID=your_workspace_id
```

#### Container `.env` (Development only)

```bash
# apps/workers/container/voice-agent-template/.env
NODE_ENV=development
WS_APP_PORT=4000
LOG_LEVEL=debug

# Inworld (passed from api-gateway via headers in production)
INWORLD_API_KEY=your_inworld_api_key
INWORLD_WORKSPACE_ID=your_workspace_id
```

**⚠️ Important:** Secrets are NOT stored in wrangler.toml. Use `wrangler secret put` for production.

### 2. Update wrangler.toml Files

#### API Gateway

The `apps/workers/api-gateway/wrangler.toml` has been updated with:

```toml
# KV namespace for session cache
[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "" # Add your KV namespace ID here

# Container binding
[[containers]]
binding = "VOICE_AGENT_CONTAINER"
image = "voice-agent-runtime:latest"
max_instances = 10
```

**Action required:** Add your `SESSION_CACHE` KV namespace ID.

#### Container Worker

The `apps/workers/container/voice-agent-template/wrangler.toml` is already configured.

### 3. Install Dependencies

```bash
# From monorepo root
cd /mnt/c/Users/Jamaal/Documents/Phantom\ Systems\ Inc/mirai

# Install all dependencies
pnpm install

# Specifically for api-gateway (includes @cloudflare/containers)
cd apps/workers/api-gateway
pnpm install

# For container
cd ../container/voice-agent-template/voice_agent/server
pnpm install
```

### 4. Set Production Secrets

```bash
# From api-gateway directory
cd apps/workers/api-gateway

# Set secrets (never commit these!)
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID

# Verify secrets
wrangler secret list
```

---

## Deployment

### Phase 1: Build and Deploy Container

```bash
cd apps/workers/container/voice-agent-template

# 1. Build Docker image
docker build -t voice-agent-runtime:latest .

# 2. Test locally first
docker run -p 4000:4000 --env-file .env voice-agent-runtime:latest

# In another terminal, test health endpoint
curl http://localhost:4000/health
# Should return: {"status":"healthy", ...}

# 3. Stop local container
docker stop $(docker ps -q --filter ancestor=voice-agent-runtime:latest)

# 4. Push to Cloudflare Container Registry
wrangler container push voice-agent-runtime:latest

# 5. Deploy container worker
wrangler deploy
```

### Phase 2: Deploy API Gateway

```bash
cd apps/workers/api-gateway

# 1. Run type check
pnpm typecheck

# 2. Deploy to Cloudflare
wrangler deploy

# 3. Verify deployment
curl https://YOUR_WORKER_URL/health
# Should return: {"status":"ok", ...}
```

### Phase 3: Run Database Migrations

```bash
# From database-schema package
cd packages/database-schema

# Apply migrations to production D1
wrangler d1 execute mirai-production --file migrations/0001_create_tables.sql
```

---

## Testing

### Local Testing (Development)

#### Test API Gateway Locally

```bash
cd apps/workers/api-gateway

# Start local dev server
pnpm dev

# In another terminal, test endpoints
curl http://localhost:8787/health
```

#### Test Container Locally

```bash
cd apps/workers/container/voice-agent-template

# Start container
docker-compose up
# OR
docker run -p 4000:4000 --env-file .env voice-agent-runtime:latest

# Test health
curl http://localhost:4000/health

# Test metrics
curl http://localhost:4000/metrics
```

### End-to-End Testing

#### 1. Create a test character

```bash
# Using your frontend or API
POST https://YOUR_API_GATEWAY_URL/api/characters
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "displayName": "Test Character",
  "personalityConfig": {
    "motivations": ["Be helpful"],
    "flaws": ["Too polite"],
    "dialogueStyle": "Friendly",
    "adjectives": ["Cheerful", "Helpful"]
  }
}

# Response will include characterId and inworldCharacterId
```

#### 2. Start a voice session

```bash
POST https://YOUR_API_GATEWAY_URL/api/voice/session/start
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "characterId": "YOUR_CHARACTER_UUID"
}

# Response:
{
  "sessionId": "session-uuid",
  "sessionKey": "session-key",
  "websocketUrl": "wss://YOUR_API_GATEWAY_URL/api/voice/ws?sessionKey=session-key",
  "expiresAt": 1234567890000
}
```

#### 3. Connect via WebSocket

```javascript
// Frontend code
const ws = new WebSocket('wss://YOUR_API_GATEWAY_URL/api/voice/ws?sessionKey=YOUR_SESSION_KEY')

ws.onopen = () => {
  console.log('WebSocket connected')
}

ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Audio data from TTS
    playAudio(event.data)
  } else {
    // JSON message (transcript, emotion, error)
    const message = JSON.parse(event.data)
    console.log('Message:', message)
  }
}

// Send audio chunk (from microphone)
ws.send(audioBuffer) // ArrayBuffer

// Send text message
ws.send(JSON.stringify({
  type: 'text',
  text: 'Hello!',
  timestamp: Date.now()
}))
```

### Monitoring

#### Check Container Metrics

```bash
# View container metrics
curl https://YOUR_CONTAINER_URL/metrics

# Example response:
{
  "totalCharacters": 3,
  "totalSessions": 7,
  "maxSessions": 100,
  "utilizationPercent": 7,
  "characters": [
    {
      "characterId": "char-abc-123",
      "sessionCount": 3,
      "idleTime": 1234
    }
  ]
}
```

#### View Worker Logs

```bash
# Real-time logs for api-gateway
wrangler tail mirai-api-gateway

# Real-time logs for container
wrangler tail voice-agent-container
```

---

## Troubleshooting

### Common Issues

#### 1. "Container at max capacity"

**Cause:** Container has reached 100 concurrent sessions.

**Solution:**
- Cloudflare will automatically scale up to 10 instances (1000 total sessions)
- Check metrics: `curl https://YOUR_CONTAINER_URL/metrics`
- Increase `max_instances` in wrangler.toml if needed

#### 2. "Invalid or expired session"

**Cause:** Session key not found in KV cache or expired (5 min TTL).

**Solution:**
- Call `/api/voice/session/start` again to get a new session key
- Ensure client connects to WebSocket within 5 minutes
- Check KV namespace is properly bound

#### 3. "Missing required headers from api-gateway"

**Cause:** Container worker didn't receive authentication headers.

**Solution:**
- Verify api-gateway is forwarding headers correctly
- Check container worker logs: `wrangler tail voice-agent-container`
- Ensure `X-User-ID`, `X-Inworld-API-Key` headers are present

#### 4. WebSocket connection fails

**Causes:**
- JWT token expired
- Session key invalid
- Character not loaded

**Solutions:**
1. Verify JWT token is valid
2. Check session exists in KV: `wrangler kv:key get --binding SESSION_CACHE session:YOUR_KEY`
3. Check container logs for errors

#### 5. "Character not loaded. Call /load first."

**Cause:** Character instance not in CharacterPoolManager.

**Solution:**
- Container expects `/load` to be called before WebSocket connection
- Currently, `/load` happens when WebSocket connects for the first time
- This is expected behavior for multi-tenant architecture

### Debugging Commands

```bash
# Check D1 database
wrangler d1 execute mirai-production --command "SELECT * FROM voice_sessions LIMIT 5"

# Check KV cache
wrangler kv:key list --binding SESSION_CACHE
wrangler kv:key get --binding SESSION_CACHE session:YOUR_KEY

# View container logs
wrangler tail voice-agent-container --format pretty

# View api-gateway logs
wrangler tail mirai-api-gateway --format pretty
```

---

## Next Steps

### MVP Launch Checklist

- [ ] Deploy api-gateway to production
- [ ] Deploy voice-agent container to production
- [ ] Create KV namespace and update wrangler.toml
- [ ] Set all production secrets via `wrangler secret put`
- [ ] Run database migrations
- [ ] Test end-to-end flow with real users
- [ ] Set up monitoring and alerts
- [ ] Configure custom domain (e.g., `api.miraichat.app`)

### Post-MVP Enhancements

- [ ] Implement usage tracking → Polar billing integration
- [ ] Add audio recording to R2 storage
- [ ] Implement conversation history with Inworld Long-Term Memory
- [ ] Add rate limiting per user (not just per container)
- [ ] Implement Durable Objects for multi-user rooms
- [ ] Add analytics dashboard for usage metrics

---

## Additional Resources

- [INTEGRATIONS.md](./INTEGRATIONS.md) - Comprehensive integration guide
- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [Inworld Runtime Docs](https://docs.inworld.ai/docs/node/templates/voice-agent)
- [Better-Auth Docs](https://www.better-auth.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

**Need Help?** Review the INTEGRATIONS.md for detailed architecture and flow diagrams.

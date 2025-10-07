# Voice Agent Container - Cloudflare Deployment Guide

This guide provides step-by-step instructions for deploying the Inworld Runtime Voice Agent to Cloudflare Containers for the Mirai MVP.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [Building the Container](#building-the-container)
5. [Cloudflare Configuration](#cloudflare-configuration)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Monitoring & Debugging](#monitoring--debugging)
9. [Production Considerations](#production-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Node.js** 20+ (LTS recommended)
- **pnpm** 9+ (monorepo package manager)
- **Docker** 24+ (or Colima/alternative)
- **Wrangler** 4+ (Cloudflare CLI)
- **Cloudflare Account** with Workers Paid plan

### Cloudflare Account Setup

1. Sign up for [Cloudflare Workers](https://workers.cloudflare.com/)
2. Upgrade to Workers Paid plan (required for Containers)
3. Create API token with Containers permissions:
   - Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Create token with "Edit Cloudflare Workers" template
   - Save token securely

### Inworld Platform Setup

1. Create account at [Inworld Studio](https://studio.inworld.ai/)
2. Create a workspace
3. Generate API key from workspace settings
4. Save API key securely

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      End User                             │
│                 (Browser/Mobile App)                      │
└──────────────────────────────────────────────────────────┘
                          │
                          ↓ HTTPS/WebSocket
┌──────────────────────────────────────────────────────────┐
│              Cloudflare Worker (worker.ts)                │
│  - Authentication & JWT verification                      │
│  - Session management (KV)                                │
│  - Request routing & proxying                             │
│  - Rate limiting                                          │
│  - Analytics tracking                                     │
└──────────────────────────────────────────────────────────┘
                          │
                          ↓ Container.fetch()
┌──────────────────────────────────────────────────────────┐
│         Cloudflare Container (Docker + Node.js)           │
│  - Express.js HTTP/WebSocket server (port 4000)           │
│  - Inworld Runtime integration                            │
│  - STT → LLM → TTS pipeline (GraphBuilder)                │
│  - Voice session state management                         │
│  - Scale-to-zero when idle (5min)                         │
└──────────────────────────────────────────────────────────┘
                          │
                          ↓ HTTPS/API
┌──────────────────────────────────────────────────────────┐
│                  Inworld Platform                         │
│  - Speech-to-Text (STT)                                   │
│  - Large Language Model (LLM)                             │
│  - Text-to-Speech (TTS)                                   │
│  - Character management                                   │
│  - Long-term memory (Enterprise)                          │
└──────────────────────────────────────────────────────────┘
```

---

## Local Development Setup

### 1. Install Dependencies

From the monorepo root:

```bash
# Install all workspace dependencies
pnpm install

# Navigate to voice-agent-template
cd apps/workers/container/voice-agent-template
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set required values:

```env
# Required
INWORLD_API_KEY=your_inworld_api_key_here
WS_APP_PORT=4000

# Optional (development)
NODE_ENV=development
LOG_LEVEL=debug
ALLOWED_ORIGINS=http://localhost:3000
GRAPH_VISUALIZATION_ENABLED=false
VAD_MODEL_PATH=./models/silero_vad.onnx
```

### 3. Test Locally (without Docker)

```bash
# Install server dependencies
cd voice_agent/server
yarn install

# Start server
yarn start
```

Server should start on `http://localhost:4000`

**Test endpoints:**
- Health: `http://localhost:4000/health`
- Ready: `http://localhost:4000/ready`
- Metrics: `http://localhost:4000/metrics`

### 4. Test with Docker

Build and run the development container:

```bash
# From voice-agent-template directory
pnpm container:build:dev
pnpm container:run:dev
```

Container should start on `http://localhost:4000`

---

## Building the Container

### Production Build

```bash
# Build production container image
pnpm container:build

# Verify image was created
docker images | grep voice-agent-runtime
```

**Expected output:**
```
voice-agent-runtime   latest   <image_id>   <time>   <size>
```

### Multi-Platform Build (for deployment)

Cloudflare Containers require `linux/amd64` architecture:

```bash
# Build for linux/amd64
docker buildx build \
  --platform linux/amd64 \
  -t voice-agent-runtime:latest \
  -f Dockerfile \
  .
```

### Test Production Container Locally

```bash
pnpm container:run
```

**Verify:**
- Container starts without errors
- Health endpoint responds: `curl http://localhost:4000/health`
- WebSocket upgrade works

---

## Cloudflare Configuration

### 1. Authenticate Wrangler

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 2. Configure wrangler.toml

The `wrangler.toml` file is already configured. Review and update:

```toml
name = "voice-agent-container"
main = "src/worker.ts"
compatibility_date = "2025-01-01"

[[containers]]
binding = "VOICE_AGENT"
image = "voice-agent-runtime:latest"
max_instances = 10
```

### 3. Set Secrets

**Required secrets** (never commit to git):

```bash
# Inworld API key
wrangler secret put INWORLD_API_KEY
# Enter your Inworld API key when prompted

# JWT secret (generate with: openssl rand -hex 32)
wrangler secret put JWT_SECRET
# Enter a random secure string
```

### 4. Create D1 Database

```bash
# Create database
wrangler d1 create mirai-production

# Note the database_id from output
# Update wrangler.toml with database_id
```

### 5. Create R2 Bucket

```bash
# Create bucket for voice recordings
wrangler r2 bucket create mirai-voice-recordings
```

### 6. Create KV Namespace

```bash
# Create KV namespace for sessions
wrangler kv:namespace create SESSION_CACHE

# Note the namespace ID
# Update wrangler.toml with namespace id
```

---

## Deployment

### 1. Build and Push Container

```bash
# Build container image
pnpm container:build

# Push to Cloudflare Container Registry
pnpm container:push
```

**Note:** Wrangler will automatically push the container to Cloudflare's registry.

### 2. Deploy Worker

```bash
# Deploy to production
pnpm deploy

# Or deploy to staging first
pnpm deploy:staging
```

**Expected output:**
```
✨ Built successfully
🌍 Published voice-agent-container to Cloudflare
   https://voice-agent-container.<your-subdomain>.workers.dev
```

### 3. Verify Deployment

```bash
# List containers
pnpm container:list

# Check container images
wrangler containers images list
```

### 4. Test Deployed Container

```bash
# Health check
curl https://voice-agent-container.<your-subdomain>.workers.dev/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-01-06T...",
#   "environment": "production"
# }
```

---

## Testing

### Unit Tests (coming soon)

```bash
pnpm test
```

### Integration Tests

Test the full flow from API Gateway → Container → Inworld:

1. **Create Session:**
   ```bash
   curl -X POST https://api.miraichat.app/api/voice-agent/create-session \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "characterId": "character-uuid",
       "agentConfig": {
         "name": "TestAgent",
         "description": "Test description",
         "motivation": "Help users"
       }
     }'
   ```

2. **Connect WebSocket:**
   ```javascript
   const ws = new WebSocket(
     `wss://voice-agent-container.<subdomain>.workers.dev/session?key=<session_key>`
   )

   ws.onopen = () => {
     console.log('Connected!')
   }

   ws.onmessage = (event) => {
     console.log('Message:', JSON.parse(event.data))
   }
   ```

3. **Send Audio/Text:**
   ```javascript
   // Send text message
   ws.send(JSON.stringify({
     type: 'TEXT',
     text: 'Hello, agent!',
     interactionId: crypto.randomUUID()
   }))

   // Send audio chunk
   ws.send(JSON.stringify({
     type: 'AUDIO',
     audio: base64AudioData,
     state: 'ACTIVE'
   }))
   ```

---

## Monitoring & Debugging

### View Logs

```bash
# Real-time logs
wrangler tail

# Container-specific logs
pnpm container:logs

# Filter logs
wrangler tail --grep "ERROR"
wrangler tail --grep "session"
```

### Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Select `voice-agent-container`
4. View:
   - Real-time requests
   - Error rates
   - CPU/Memory usage
   - Container instances

### Analytics

Query analytics data:

```bash
# Get analytics for last 24 hours
wrangler analytics
```

### Debugging Containers

```bash
# Check container status
wrangler containers list

# View container instances
wrangler containers instances list voice-agent-container

# Restart container
wrangler containers restart voice-agent-container
```

---

## Production Considerations

### 1. Scaling Configuration

Update `wrangler.toml` for production load:

```toml
[[containers]]
binding = "VOICE_AGENT"
image = "voice-agent-runtime:latest"
max_instances = 50  # Increase for production
cpu_limit = 2       # CPUs per instance
memory_limit = 4096 # MB per instance
```

### 2. Rate Limiting

Implement rate limiting in the worker:

```typescript
// In worker.ts
const RATE_LIMIT_MAX = 100 // requests per minute
const rateLimiter = new RateLimiter(env.SESSION_CACHE)

if (await rateLimiter.isRateLimited(userId)) {
  return new Response('Rate limit exceeded', { status: 429 })
}
```

### 3. Cost Optimization

- **Reduce `sleepAfter`** to minimize idle container costs
- **Enable `max_instances` cap** to prevent runaway costs
- **Use KV caching** for frequently accessed data
- **Monitor usage** via Cloudflare Analytics

**Estimated Costs (5K MAU):**
- Workers: ~$50/month
- Containers: ~$91/month
- D1: ~$10/month
- R2: ~$1.50/month
- KV: ~$5/month
- **Total: ~$157.50/month**

### 4. Security Hardening

- **Enable CORS restrictions** (set `ALLOWED_ORIGINS` in production)
- **Validate JWT tokens** on all protected routes
- **Use strong secrets** (32+ characters, random)
- **Enable rate limiting** to prevent abuse
- **Sanitize user inputs** in container
- **Review security advisors** regularly

### 5. Monitoring & Alerts

Set up alerts for:
- Container errors > 5%
- Response time > 2 seconds
- Memory usage > 90%
- WebSocket disconnect rate > 10%

**Tools:**
- Cloudflare Analytics
- Sentry (error tracking)
- Datadog (metrics)
- New Relic (APM)

---

## Troubleshooting

### Container Won't Start

**Symptom:** Container fails to initialize

**Solutions:**
1. Check logs: `wrangler tail`
2. Verify `INWORLD_API_KEY` is set correctly
3. Ensure VAD model exists at `./models/silero_vad.onnx`
4. Check Docker build logs for errors

### WebSocket Connection Refused

**Symptom:** Client cannot connect to WebSocket

**Solutions:**
1. Verify session exists in KV cache
2. Check session key is correct
3. Ensure WebSocket path is `/session?key=<key>`
4. Verify CORS headers allow WebSocket upgrade

### High Latency

**Symptom:** Slow response times (>2 seconds)

**Solutions:**
1. Check Inworld API latency
2. Increase container CPU/memory
3. Reduce `sleepAfter` to keep containers warm
4. Enable KV caching for frequently accessed data

### Container Out of Memory

**Symptom:** Container crashes with OOM error

**Solutions:**
1. Increase `memory_limit` in `wrangler.toml`
2. Optimize audio buffer handling
3. Implement stream processing for large audio
4. Review memory leaks in application code

### Database Errors

**Symptom:** D1 query failures

**Solutions:**
1. Verify D1 binding is correct in `wrangler.toml`
2. Check database migrations are applied
3. Ensure database exists: `wrangler d1 list`
4. Review query syntax and bindings

---

## Additional Resources

- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Inworld Runtime Docs](https://docs.inworld.ai/docs/node/templates/voice-agent)
- [Mirai MVP Architecture](../../product-documentation/mvp/mvp-cloudflare-inworld-architecture.md)

---

## Support

For issues and questions:
- **Cloudflare:** [Community Discord](https://discord.cloudflare.com)
- **Inworld:** [Documentation](https://docs.inworld.ai) | [Support](https://inworld.ai/support)
- **Mirai Team:** Internal Slack channel

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Author:** Claude Code for Mirai MVP

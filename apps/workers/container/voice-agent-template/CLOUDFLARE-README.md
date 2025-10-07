# Voice Agent - Cloudflare Container Implementation

Production-ready Cloudflare Container implementation of the Inworld Runtime Voice Agent for the Mirai MVP.

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Inworld API key

# 3. Build container
pnpm container:build

# 4. Deploy to Cloudflare
pnpm deploy
```

## 📦 What's Included

### Core Implementation

- ✅ **Dockerfile** - Multi-stage production build optimized for Cloudflare Containers
- ✅ **Worker (src/worker.ts)** - Cloudflare Worker for routing and session management
- ✅ **Container Server** - Enhanced Express.js server with health checks
- ✅ **wrangler.toml** - Complete Cloudflare configuration
- ✅ **Database Integration** - D1 bindings for session tracking and usage billing
- ✅ **KV Caching** - Session state management with auto-expiration
- ✅ **R2 Storage** - Audio recording storage bindings
- ✅ **Analytics** - Usage tracking and metrics collection

### Documentation

- 📚 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Step-by-step deployment guide
- 📚 **[CONTAINER.md](./CONTAINER.md)** - Technical implementation details
- 📚 **[.env.example](./.env.example)** - Environment variable reference

### Features

| Feature | Status | Description |
|---------|--------|-------------|
| WebSocket Support | ✅ | Real-time voice communication |
| Auto-Scaling | ✅ | Scale-to-zero with 5min idle timeout |
| Health Checks | ✅ | /health, /ready, /metrics endpoints |
| Session Management | ✅ | KV-based session caching |
| Authentication | ✅ | JWT verification and rate limiting |
| Database Integration | ✅ | D1 for conversations and usage |
| Audio Storage | ✅ | R2 for voice recordings |
| Analytics | ✅ | Usage metrics and telemetry |
| Graceful Shutdown | ✅ | Proper signal handling |
| Error Handling | ✅ | Structured error logging |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  Worker (worker.ts)                            │     │
│  │  • Auth & JWT verification                     │     │
│  │  • Session management (KV)                     │     │
│  │  • Rate limiting                               │     │
│  │  • Request routing                             │     │
│  └──────────────┬─────────────────────────────────┘     │
│                 │                                        │
│                 ↓ Container.fetch()                      │
│  ┌────────────────────────────────────────────────┐     │
│  │  Container (Docker + Node.js)                  │     │
│  │  • Express.js server (port 4000)               │     │
│  │  • WebSocket handler                           │     │
│  │  • Inworld Runtime                             │     │
│  │  • STT → LLM → TTS pipeline                    │     │
│  └──────────────┬─────────────────────────────────┘     │
│                 │                                        │
└─────────────────┼────────────────────────────────────────┘
                  │
                  ↓ HTTPS/API
     ┌────────────────────────────┐
     │    Inworld Platform        │
     │    • STT (Chirp)           │
     │    • LLM (GPT-4o-mini)     │
     │    • TTS (Google Neural)   │
     └────────────────────────────┘
```

## 📋 Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 9+ (monorepo package manager)
- **Docker** 24+ (or Colima/alternative)
- **Wrangler** 4+ (Cloudflare CLI: `npm install -g wrangler`)
- **Cloudflare Account** with Workers Paid plan
- **Inworld API Key** from [Inworld Studio](https://studio.inworld.ai/)

## 🛠️ Development

### Local Development (without Docker)

```bash
# Install server dependencies
cd voice_agent/server
yarn install

# Start development server
yarn start

# Server runs on http://localhost:4000
```

**Test endpoints:**
```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl http://localhost:4000/metrics
```

### Local Development (with Docker)

```bash
# Build development container
pnpm container:build:dev

# Run container
pnpm container:run:dev

# Container runs on http://localhost:4000
```

### Hot Reload

The development container uses `nodemon` for auto-reload:

```bash
# Any changes to .ts files will trigger rebuild
# WebSocket connections will be preserved
```

## 📤 Deployment

### Step 1: Configure Secrets

```bash
# Set Inworld API key
wrangler secret put INWORLD_API_KEY

# Set JWT secret
wrangler secret put JWT_SECRET
```

### Step 2: Create Resources

```bash
# Create D1 database
wrangler d1 create mirai-production

# Create R2 bucket
wrangler r2 bucket create mirai-voice-recordings

# Create KV namespace
wrangler kv:namespace create SESSION_CACHE
```

### Step 3: Update wrangler.toml

Update `wrangler.toml` with resource IDs from Step 2:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "<your-database-id>"  # From Step 2

[[r2_buckets]]
binding = "AUDIO_STORAGE"
bucket_name = "mirai-voice-recordings"

[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "<your-kv-id>"  # From Step 2
```

### Step 4: Deploy

```bash
# Build and push container
pnpm container:build
pnpm container:push

# Deploy worker
pnpm deploy

# Or deploy to staging first
pnpm deploy:staging
```

### Step 5: Verify

```bash
# Check deployment
wrangler containers list

# Test health endpoint
curl https://voice-agent-container.<your-subdomain>.workers.dev/health
```

## 🧪 Testing

### Manual Testing

```bash
# 1. Create session
curl -X POST https://api.miraichat.app/api/voice-agent/create-session \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "char-uuid",
    "agentConfig": {
      "name": "Test Agent",
      "description": "Test description",
      "motivation": "Help users"
    }
  }'

# 2. Connect WebSocket (save sessionKey from response)
wscat -c "wss://voice-agent-container.<subdomain>.workers.dev/session?key=<sessionKey>"

# 3. Send test message
> {"type":"TEXT","text":"Hello!","interactionId":"test-123"}
```

### Automated Tests (coming soon)

```bash
pnpm test
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
wrangler tail

# Container logs
pnpm container:logs

# Filter by keyword
wrangler tail --grep "ERROR"
wrangler tail --grep "session"
```

### Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Select `voice-agent-container`
4. View metrics:
   - Requests per second
   - Error rates
   - CPU/Memory usage
   - Container instances
   - WebSocket connections

### Custom Metrics

The worker tracks key metrics in Analytics Engine:

```typescript
// Session creation
env.ANALYTICS?.writeDataPoint({
  blobs: ['session_created'],
  doubles: [1],
  indexes: [`user:${userId}`, `character:${characterId}`]
})

// Session duration
env.ANALYTICS?.writeDataPoint({
  blobs: ['session_duration'],
  doubles: [durationSeconds],
  indexes: [`user:${userId}`]
})
```

## 🔒 Security

### Authentication

All API routes require JWT authentication:

```typescript
// Worker validates JWT
const authHeader = request.headers.get('Authorization')
const token = authHeader.substring(7) // Remove 'Bearer '
const userId = await verifyToken(token, env.JWT_SECRET)

if (!userId) {
  return new Response('Invalid token', { status: 401 })
}
```

### Session Validation

WebSocket connections require valid session keys:

```typescript
// Session must exist in KV cache
const sessionData = await env.SESSION_CACHE.get(`session:${key}`, 'json')

if (!sessionData) {
  return new Response('Invalid or expired session', { status: 401 })
}
```

### Rate Limiting

Per-user rate limits to prevent abuse:

```typescript
// Max 100 requests per minute per user
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 // seconds
```

### CORS Configuration

Production CORS settings:

```env
# Only allow requests from your domain
ALLOWED_ORIGINS=https://app.miraichat.app
```

## 💰 Cost Estimation

**Monthly costs for 5,000 MAU:**

| Service | Usage | Cost |
|---------|-------|------|
| Workers | 150M requests | ~$50 |
| Containers | ~720 hours | ~$91 |
| D1 Database | 5 GB | ~$10 |
| R2 Storage | 100 GB | ~$1.50 |
| KV Namespace | 10M reads | ~$5 |
| **Total** | | **~$157.50** |

**Cost per user:** $0.032/user/month

**Optimization tips:**
- Reduce `sleepAfter` to 2-3 minutes to save on idle costs
- Use KV caching aggressively to reduce D1 queries
- Stream audio instead of buffering to reduce memory
- Set `max_instances` cap to prevent runaway costs

## 🐛 Troubleshooting

### Container Won't Start

**Check:**
1. Logs: `wrangler tail`
2. Inworld API key is valid
3. VAD model exists at `./models/silero_vad.onnx`
4. Docker image built successfully

### WebSocket Connection Refused

**Check:**
1. Session exists in KV cache
2. Session key is correct
3. WebSocket URL path is `/session?key=<key>`
4. CORS headers allow WebSocket upgrade

### High Latency (>2s)

**Solutions:**
1. Check Inworld API response times
2. Increase container CPU/memory in `wrangler.toml`
3. Reduce `sleepAfter` to keep containers warm
4. Enable KV caching for frequently accessed data

### Database Errors

**Check:**
1. D1 binding in `wrangler.toml` is correct
2. Database migrations are applied
3. Database exists: `wrangler d1 list`
4. Query syntax and bindings are correct

## 📚 Additional Resources

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[CONTAINER.md](./CONTAINER.md)** - Technical implementation details
- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [Inworld Runtime Docs](https://docs.inworld.ai/docs/node/templates/voice-agent)
- [Mirai MVP Architecture](../../product-documentation/mvp/mvp-cloudflare-inworld-architecture.md)

## 🤝 Support

- **Cloudflare Issues:** [Discord](https://discord.cloudflare.com)
- **Inworld Issues:** [Documentation](https://docs.inworld.ai)
- **Mirai Team:** Internal Slack

## 📝 License

See [LICENSE](./LICENSE.md) for details.

---

**Project:** Mirai MVP - AI Companion Platform
**Component:** Voice Agent Container (Cloudflare)
**Version:** 1.0.0
**Last Updated:** 2025-01-06
**Maintained by:** Phantom Systems Inc

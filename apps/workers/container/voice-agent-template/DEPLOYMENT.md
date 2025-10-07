# Voice Agent Container - Deployment Guide

**Last Updated:** 2025-10-07
**Target Platform:** Cloudflare Containers (Durable Objects)
**Project:** Mirai MVP

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture](#architecture)
3. [Local Testing](#local-testing)
4. [Production Deployment](#production-deployment)
5. [Post-Deployment Setup](#post-deployment-setup)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- ✅ **Cloudflare Account** with Workers Paid plan (Containers feature)
- ✅ **Inworld Platform Account** with API access

### Required Tools

- Node.js 20+
- pnpm 9+
- Docker 24+ (for local testing only)
- Wrangler 4+

### Authentication

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

Ensure you have `containers (write)` permission in your token.

---

## Architecture

Cloudflare Containers work as **Durable Objects that run Docker containers**:

```
src/worker.ts (Cloudflare Worker)
    ↓
env.VOICE_AGENT (Durable Object binding)
    ↓
VoiceAgentContainer extends Container (Durable Object)
    ↓
Runs Docker container from ./Dockerfile
    ↓
voice_agent/server/ (Express.js + Inworld Runtime)
```

**Key Points:**
- Container is a Durable Object, not a separate service
- Wrangler builds the Docker image automatically during deployment
- Each container instance can handle 100+ concurrent voice sessions
- Containers scale-to-zero after 5 minutes of inactivity

---

## Local Testing

### 1. Set Environment Variables

```bash
cd apps/workers/container/voice-agent-template

# Copy example env file
cp .env.example .env

# Edit .env and set:
INWORLD_API_KEY=your_api_key_here
INWORLD_WORKSPACE_ID=your_workspace_id_here
NODE_ENV=development
WS_APP_PORT=4000
LOG_LEVEL=debug
```

### 2. Test Container Locally with Docker

```bash
# Build and run development container
pnpm test:local

# This runs:
# 1. docker build --target development -t voice-agent-test:dev .
# 2. docker run -p 4000:4000 --env-file .env --rm voice-agent-test:dev

# Test health endpoint
curl http://localhost:4000/health
```

### 3. Test Worker Locally

```bash
# Start Wrangler dev server (simulates Cloudflare environment)
pnpm dev

# Note: Container won't actually run locally in dev mode
# This only tests the Worker code (src/worker.ts)
```

---

## Production Deployment

### Step 1: Set Secrets

Secrets are encrypted and not visible in wrangler.toml:

```bash
# Set Inworld API Key
wrangler secret put INWORLD_API_KEY
# Paste your API key when prompted

# Set Inworld Workspace ID
wrangler secret put INWORLD_WORKSPACE_ID
# Paste your workspace ID when prompted
```

### Step 2: Type Check

```bash
# Ensure no TypeScript errors
pnpm build
```

### Step 3: Deploy

```bash
# Deploy to production
pnpm deploy

# Or deploy to staging environment
pnpm deploy:staging
```

**What happens during deployment:**

1. ✅ Wrangler bundles Worker code (`src/worker.ts`)
2. ✅ Wrangler builds Docker image from `./Dockerfile`
3. ✅ Uploads Worker + Container image to Cloudflare
4. ✅ Creates Durable Objects:
   - `VoiceAgentContainer` (Container Durable Object)
   - `VoiceSession` (Session state management)
5. ✅ Applies migrations (first deployment only)
6. ✅ Deploys to `https://voice-agent-container.<your-subdomain>.workers.dev`

### Step 4: Verify Deployment

```bash
# Test health endpoint
curl https://voice-agent-container.<your-subdomain>.workers.dev/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-07T...",
#   "environment": "production",
#   "container": "voice-agent-runtime"
# }
```

---

## Post-Deployment Setup

### 1. Configure API Gateway

The voice agent should only be called by your API Gateway, not directly by clients.

```bash
# In apps/workers/api-gateway
cd ../api-gateway

# Set voice agent URL as a secret
wrangler secret put VOICE_AGENT_URL

# Enter: https://voice-agent-container.<your-subdomain>.workers.dev
```

### 2. Update API Gateway Code

Ensure your API Gateway forwards requests with required headers:

```typescript
// apps/workers/api-gateway/src/routes/voice.ts
const response = await fetch(
  `${env.VOICE_AGENT_URL}/session`,
  {
    headers: {
      'X-User-ID': user.id,
      'X-Inworld-API-Key': env.INWORLD_API_KEY,
    }
  }
)
```

### 3. Test End-to-End

```bash
# From frontend or API client
curl -X POST https://api.miraichat.app/api/voice/session/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"characterId": "char-123"}'
```

---

## Monitoring

### View Logs

```bash
# Stream real-time logs
wrangler tail voice-agent-container

# Filter by status
wrangler tail voice-agent-container --status ok
wrangler tail voice-agent-container --status error
```

### Check Durable Objects

```bash
# List Durable Objects
wrangler d1 execute <DATABASE_NAME> --command \
  "SELECT * FROM _cf_durable_objects LIMIT 10"
```

### Metrics Dashboard

View metrics in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `voice-agent-container`
3. View Analytics tab

---

## Troubleshooting

### Container Build Fails

**Error:** `Failed to build Docker image`

**Solution:**
```bash
# Test Docker build locally
docker build -t test-build .

# Check Dockerfile syntax
# Ensure COPY paths are correct
# Verify base image exists
```

### Deployment Fails with Migration Error

**Error:** `Durable Object migration failed`

**Solution:**
```bash
# Check wrangler.toml migrations section
# Ensure class names match exported classes:

[[migrations]]
tag = "v1"
new_sqlite_classes = ["VoiceAgentContainer", "VoiceSession"]
```

### Health Check Fails After Deployment

**Error:** 403 or "Invalid request"

**Solution:**
The Worker expects `X-User-ID` and `X-Inworld-API-Key` headers. For health checks, modify `src/worker.ts`:

```typescript
// Bypass auth for health check
if (path === '/health') {
  return new Response(JSON.stringify({ status: 'healthy' }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### Container Not Starting

**Error:** Container times out or doesn't respond

**Check:**
1. Server listens on correct port (4000)
2. HEALTHCHECK in Dockerfile works
3. Container logs: `wrangler tail`
4. Environment variables are set correctly

---

## Environment Configuration

### wrangler.toml Structure

```toml
name = "voice-agent-container"
main = "src/worker.ts"
compatibility_date = "2025-01-01"
workers_dev = true

# Container configuration
[[containers]]
class_name = "VoiceAgentContainer"
image = "./Dockerfile"
max_instances = 10

# Durable Object bindings
[[durable_objects.bindings]]
name = "VOICE_AGENT"
class_name = "VoiceAgentContainer"

# Migrations (first deployment)
[[migrations]]
tag = "v1"
new_sqlite_classes = ["VoiceAgentContainer", "VoiceSession"]

# Non-sensitive environment variables
[vars]
NODE_ENV = "production"
WS_APP_PORT = "4000"
LOG_LEVEL = "info"
```

### Secrets (never commit these!)

Set via `wrangler secret put`:
- `INWORLD_API_KEY`
- `INWORLD_WORKSPACE_ID`

---

## Deployment Checklist

- [ ] Cloudflare account with Workers Paid plan
- [ ] Inworld Platform account with API key
- [ ] Wrangler authenticated (`wrangler login`)
- [ ] Secrets set (`wrangler secret put`)
- [ ] TypeScript compiles (`pnpm build`)
- [ ] Docker build works locally (`pnpm test:local`)
- [ ] Deployed successfully (`pnpm deploy`)
- [ ] Health check passes
- [ ] API Gateway configured with voice agent URL
- [ ] End-to-end test passes

---

## Available Commands

```bash
# Development
pnpm dev              # Local development with Wrangler
pnpm test:local       # Test container with Docker locally

# Type checking
pnpm build            # Compile TypeScript
pnpm typecheck        # Type check without output

# Deployment
pnpm deploy           # Deploy to production
pnpm deploy:staging   # Deploy to staging

# Code quality
pnpm format           # Format code with Prettier
pnpm lint             # Lint code
pnpm test             # Run tests
```

---

## Next Steps

1. **Deploy API Gateway** - Configure to call this voice agent
2. **Deploy Frontend** - Connect to API Gateway
3. **Set up monitoring** - Configure alerts for errors
4. **Load testing** - Test with multiple concurrent sessions
5. **Add custom domain** - Point custom domain to Worker

---

## References

- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [Inworld Runtime Docs](https://docs.inworld.ai/docs/node/templates/voice-agent)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

**Questions or Issues?**

- Internal docs: `apps/workers/container/voice-agent-template/INTEGRATIONS.md`
- Architecture: `product-documentation/mvp/mvp-cloudflare-inworld-architecture.md`
- Setup guide: `apps/workers/container/voice-agent-template/SETUP.md`

**Maintained by:** Phantom Systems Inc
**Last Updated:** 2025-10-07

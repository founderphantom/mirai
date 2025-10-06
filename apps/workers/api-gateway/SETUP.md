# Quick Setup Guide - API Gateway

Follow these steps to get your API Gateway up and running.

## Prerequisites

- Node.js 20+ and pnpm installed
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Wrangler (`wrangler login`)

## Step-by-Step Setup

### 1. Install Dependencies

From the project root:

```bash
pnpm install
```

### 2. Create Cloudflare Resources

```bash
# D1 Database
wrangler d1 create mirai-production
# Copy the database_id and update wrangler.toml

# R2 Bucket
wrangler r2 bucket create mirai-user-assets

# KV Namespace
wrangler kv:namespace create "CACHE"
# Copy the id and update wrangler.toml
```

### 3. Update wrangler.toml

Edit `apps/workers/api-gateway/wrangler.toml` and replace:
- `database_id` with your D1 database ID
- `id` (KV namespace) with your KV namespace ID

### 4. Setup Database Schema

```bash
# Navigate to database package
cd ../../packages/database-schema

# Generate migrations
pnpm db:generate

# Apply migrations to D1
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_initial.sql
```

### 5. Configure Secrets

Create a `.dev.vars` file for local development:

```bash
cd ../../apps/workers/api-gateway
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your actual credentials.

For production, set secrets with Wrangler:

```bash
# Generate Better Auth secret
npx @better-auth/cli secret

# Set the secret
wrangler secret put BETTER_AUTH_SECRET
# Paste the generated secret

# Set OAuth credentials
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET

# Set Polar credentials
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_ORGANIZATION_ID
wrangler secret put POLAR_WEBHOOK_SECRET

# Set Inworld credentials
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID
```

### 6. OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:8787/api/auth/callback/google` (development)
   - `https://api.miraichat.ai/api/auth/callback/google` (production)

#### Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Go to OAuth2 settings
4. Add redirect URIs:
   - `http://localhost:8787/api/auth/callback/discord` (development)
   - `https://api.miraichat.ai/api/auth/callback/discord` (production)

### 7. Polar Setup

1. Sign up at [Polar.sh](https://polar.sh)
2. Create your organization
3. Get your Organization Access Token from settings
4. Create products for your subscription tiers
5. Configure webhook URL: `https://api.miraichat.ai/api/webhooks/polar`

### 8. Inworld Setup

1. Sign up at [Inworld.ai](https://www.inworld.ai/)
2. Create a workspace
3. Get your API key and workspace ID
4. Note: You'll create characters via the API (automated in the character service)

### 9. Start Development Server

```bash
pnpm dev
```

The API will be available at `http://localhost:8787`

### 10. Test the API

```bash
# Health check
curl http://localhost:8787/health

# Try to access protected route (should return 401)
curl http://localhost:8787/api/characters

# Sign up
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

## Deployment

### Deploy to Production

```bash
# Deploy
wrangler deploy --env production

# View logs
wrangler tail --env production
```

### Custom Domain Setup

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to Settings → Triggers → Custom Domains
4. Add domain: `api.miraichat.ai`

## Troubleshooting

### "Module not found" errors
Run `pnpm install` from the project root.

### Database errors
Ensure migrations are applied: `wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_initial.sql`

### "Unauthorized" errors
Check that `BETTER_AUTH_SECRET` is set correctly in `.dev.vars` or as a Wrangler secret.

### OAuth redirect errors
Verify redirect URIs match exactly in OAuth provider settings.

## Next Steps

1. ✅ API Gateway is set up
2. ⏭️ Deploy frontend (`apps/stage-web`)
3. ⏭️ Set up Inworld Runtime container
4. ⏭️ Configure custom domains
5. ⏭️ Set up monitoring and analytics

## Support

- [Better-Auth Docs](https://www.better-auth.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Polar Docs](https://polar.sh/docs)
- [Inworld Docs](https://docs.inworld.ai/)

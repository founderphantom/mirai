# API Gateway - Mirai MVP

Cloudflare Worker serving as the central API gateway for the Mirai AI companion platform.

## Features

- 🔐 **Better-Auth Integration** - Email/password & OAuth authentication
- 🎭 **Character Management** - CRUD operations for AI characters
- 🎤 **Voice Session Management** - WebRTC voice session orchestration
- 📦 **Asset Management** - R2-backed file storage for Live2D models and avatars
- 💳 **Polar Integration** - Payment webhook handling and subscription management
- 🗄️ **D1 Database** - Drizzle ORM with SQLite
- ⚡ **Edge Performance** - Global deployment on Cloudflare's network

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              Cloudflare API Gateway                  │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────┐         │
│  │  Better-Auth    │  │  Character CRUD  │         │
│  │  /api/auth/*    │  │  /api/characters │         │
│  └─────────────────┘  └──────────────────┘         │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────┐         │
│  │  Voice Sessions │  │  Asset Management│         │
│  │  /api/voice/*   │  │  /api/assets/*   │         │
│  └─────────────────┘  └──────────────────┘         │
│                                                      │
│  ┌─────────────────────────────────────────┐       │
│  │  Webhooks (Polar)                        │       │
│  │  /api/webhooks/polar                     │       │
│  └─────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
           │              │              │
           ↓              ↓              ↓
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │   D1    │    │   R2    │    │   KV    │
     │Database │    │ Storage │    │  Cache  │
     └─────────┘    └─────────┘    └─────────┘
```

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Setup Cloudflare Resources

Create required Cloudflare resources:

```bash
# Create D1 database
wrangler d1 create mirai-production

# Create R2 bucket for user assets
wrangler r2 bucket create mirai-user-assets

# Create KV namespace for caching
wrangler kv:namespace create "CACHE"
```

Update `wrangler.toml` with the IDs returned from these commands.

### 4. Apply Database Migrations

Navigate to the database schema package and run migrations:

```bash
cd ../../packages/database-schema
pnpm db:generate
pnpm db:push

# Or use wrangler directly
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_initial.sql
```

### 5. Configure Secrets

Set up sensitive environment variables as Wrangler secrets:

```bash
# Better Auth
wrangler secret put BETTER_AUTH_SECRET

# OAuth Providers
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET

# Polar
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_ORGANIZATION_ID
wrangler secret put POLAR_WEBHOOK_SECRET

# Inworld
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID
```

## Development

Start the development server:

```bash
pnpm dev
```

The API will be available at `http://localhost:8787`

## API Endpoints

### Authentication (`/api/auth/*`)

Powered by Better-Auth. All routes handled automatically:

- `POST /api/auth/sign-in/email` - Email/password sign in
- `POST /api/auth/sign-up/email` - Email/password sign up
- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/discord` - Discord OAuth callback

### Characters (`/api/characters/*`)

- `POST /api/characters` - Create new character
- `GET /api/characters` - List user's characters
- `GET /api/characters/:id` - Get character details
- `PUT /api/characters/:id` - Update character
- `DELETE /api/characters/:id` - Delete character

### Voice Sessions (`/api/voice/*`)

- `POST /api/voice/session/start` - Start voice session
- `GET /api/voice/session/:id` - Get session details
- `POST /api/voice/session/:id/end` - End voice session
- `GET /api/voice/sessions/active` - List active sessions

### Assets (`/api/assets/*`)

- `POST /api/assets/upload` - Upload asset to R2
- `GET /api/assets/:key` - Download asset from R2
- `DELETE /api/assets/:key` - Delete asset from R2

### Webhooks (`/api/webhooks/*`)

- `POST /api/webhooks/polar` - Handle Polar payment events

## Deployment

### Development

Deploy to development environment:

```bash
pnpm deploy
```

### Staging

Deploy to staging environment:

```bash
wrangler deploy --env staging
```

### Production

Deploy to production environment:

```bash
wrangler deploy --env production
```

## Monitoring

View live logs:

```bash
pnpm tail
```

Or for specific environment:

```bash
wrangler tail --env production
```

## Database Management

### View Database

```bash
# Local development
wrangler d1 execute mirai-production --command "SELECT * FROM user LIMIT 10"

# Production
wrangler d1 execute mirai-production --env production --command "SELECT * FROM user LIMIT 10"
```

### Migrations

```bash
# Generate new migration
cd ../../packages/database-schema
pnpm db:generate

# Apply migration
wrangler d1 execute mirai-production --file=./drizzle/migrations/XXXX_migration.sql
```

## Architecture Decisions

### Why Hono?

- Ultra-lightweight (~20KB)
- Optimized for Cloudflare Workers
- TypeScript-first with excellent type inference
- Built-in middleware and routing

### Why Better-Auth?

- Self-hosted authentication (no vendor lock-in)
- Native D1 support via Drizzle adapter
- Built-in Polar integration
- Free (no usage limits)
- Fully customizable

### Why Drizzle ORM?

- Type-safe database queries
- Perfect SQLite/D1 support
- Excellent TypeScript integration
- Minimal bundle size
- Great migration tooling

## Security

- All API routes except `/api/auth/*` and `/api/webhooks/*` require authentication
- User assets are scoped to user IDs (users can only access their own files)
- Rate limiting enabled in production
- CORS configured for specific origins
- Webhook signature verification (TODO: implement)

## Performance

- Session caching in KV (5-minute TTL)
- R2 assets cached with 24-hour TTL
- Edge deployment across 300+ locations
- Minimal cold start (<50ms)

## Related Documentation

- [Better-Auth Documentation](../../product-documentation/mvp/better-auth.md)
- [Polar Documentation](../../product-documentation/mvp/polar.md)
- [MVP Architecture](../../product-documentation/mvp/mvp-cloudflare-inworld-architecture.md)
- [Database Schema](../../packages/database-schema/README.md)

## Troubleshooting

### "Database not found" error

Make sure you've created the D1 database and updated `wrangler.toml` with the correct database ID.

### "Unauthorized" errors

Check that your `BETTER_AUTH_SECRET` is set correctly and matches between deployments.

### OAuth callback errors

Ensure your OAuth redirect URIs are correctly configured in Google/Discord developer consoles:
- Development: `http://localhost:8787/api/auth/callback/google`
- Production: `https://api.miraichat.ai/api/auth/callback/google`

### Webhook not receiving events

1. Verify webhook URL is configured in Polar dashboard
2. Check webhook signature verification is implemented
3. View live logs with `wrangler tail`

## License

MIT

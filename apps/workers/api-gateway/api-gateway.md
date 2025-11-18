# Mirai API Gateway Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Configuration](#configuration)
6. [Authentication & Authorization](#authentication--authorization)
7. [API Routes](#api-routes)
8. [Services & Business Logic](#services--business-logic)
9. [Middleware](#middleware)
10. [Usage Tracking & Quota Enforcement](#usage-tracking--quota-enforcement)
11. [Payment Integration (Polar)](#payment-integration-polar)
12. [Durable Objects](#durable-objects)
13. [Service Bindings](#service-bindings)
14. [Database Integration](#database-integration)
15. [Error Handling](#error-handling)
16. [Deployment](#deployment)

---

## Overview

The Mirai API Gateway is a Cloudflare Workers-based API that serves as the central backend for the Mirai application. It provides:

- **Authentication & Authorization** (Better-Auth with OAuth)
- **Character Management** (CRUD operations for AI characters)
- **Voice Session Management** (WebSocket proxy to Voice Agent Container)
- **Asset Management** (R2 storage for avatars, Live2D models)
- **Payment Processing** (Polar integration for subscriptions)
- **Usage Tracking & Quota Enforcement** (voice minutes, characters)
- **Webhook Handling** (Polar events)
- **Admin Operations** (preset seeding)

The API Gateway is designed for edge computing with ultra-low latency using Cloudflare Workers and service bindings.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (stage-web)                    │
│                   Cloudflare Workers Static Assets           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway (Hono)                       │
│              Cloudflare Workers (Edge Runtime)               │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Auth      │  │   Routes     │  │   Middleware     │   │
│  │ Better-Auth │  │  Characters  │  │   Auth Check     │   │
│  │   + Polar   │  │    Voice     │  │  Tier Check      │   │
│  │             │  │    Assets    │  │  Quota Check     │   │
│  └─────────────┘  │   Payments   │  └──────────────────┘   │
│                   │   Webhooks   │                          │
│                   │    Admin     │                          │
│                   └──────────────┘                          │
└───┬───────────────────┬────────────────────┬────────────────┘
    │                   │                    │
    │ Service Binding   │ D1 SQL             │ R2 Storage
    │ (~0.5-2ms)        │                    │
    ▼                   ▼                    ▼
┌─────────────────┐ ┌──────────────┐  ┌─────────────────┐
│  Voice Agent    │ │ D1 Database  │  │  R2 Buckets     │
│   Container     │ │  (SQLite)    │  │  USER_ASSETS    │
│  Inworld RT     │ │  Drizzle ORM │  │                 │
└─────────────────┘ └──────────────┘  └─────────────────┘
         │
         │ WebSocket
         ▼
┌─────────────────────────────────────┐
│  Inworld Runtime (Multi-tenant)     │
│  - STT (Deepgram)                   │
│  - LLM (OpenAI/Custom)              │
│  - TTS (ElevenLabs)                 │
│  - VAD (Silero)                     │
└─────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Service Binding Architecture**: Ultra-low latency (~0.5-2ms) internal communication between API Gateway and Voice Agent Container
2. **Inworld Runtime Approach**: Characters created on-the-fly from personality config (no pre-created Studio API characters)
3. **Edge-First Design**: All components run on Cloudflare's edge network for global low latency
4. **Stateless API with Durable Objects**: Session state managed via Durable Objects for WebSocket sessions
5. **KV Cache for Session Keys**: Short-lived session keys (5 min TTL) in KV for WebSocket authentication

---

## Technology Stack

### Core Framework
- **Hono** (v4.9.10) - Fast, lightweight web framework for Cloudflare Workers
- **TypeScript** - Type-safe development

### Authentication
- **Better-Auth** (v1.3.27) - Modern authentication framework
- **@polar-sh/better-auth** (v1.1.9) - Polar payment plugin for Better-Auth
- **Drizzle ORM** (v0.44.5) - Type-safe ORM for D1 database

### Payment & Subscriptions
- **@polar-sh/sdk** - Polar API client for subscriptions and webhooks
- **Sandbox Environment** - Using `sandbox-api.polar.sh` for testing

### Storage & Database
- **Cloudflare D1** - Serverless SQLite database
- **Cloudflare R2** - S3-compatible object storage
- **Cloudflare KV** - Key-value cache (CACHE, SESSION_CACHE)

### Validation
- **Zod** - Schema validation for API requests
- **@hono/zod-validator** - Hono integration for Zod

### Email
- **Resend API** - Email delivery for verification and password reset

---

## Project Structure

```
apps/workers/api-gateway/
├── src/
│   ├── index.ts                    # Main entry point, Hono app setup
│   ├── lib/
│   │   ├── auth.ts                 # Better-Auth configuration
│   │   └── middleware.ts           # Auth, tier, quota middleware
│   ├── routes/
│   │   ├── characters.ts           # Character CRUD endpoints
│   │   ├── voice.ts                # Voice session & WebSocket proxy
│   │   ├── assets.ts               # R2 asset management
│   │   ├── payments.ts             # Polar checkout & subscriptions
│   │   ├── webhooks.ts             # Polar webhook handlers
│   │   └── admin.ts                # Admin operations
│   ├── services/
│   │   ├── characters.ts           # Character business logic
│   │   ├── voice.ts                # Voice session management + DO
│   │   ├── usage.ts                # Usage tracking & quota checks
│   │   └── usage-monitor.ts        # Real-time session monitoring
│   └── types/
│       ├── env.ts                  # Environment & bindings types
│       └── session.ts              # Session data types
├── wrangler.toml                   # Cloudflare Workers config
├── package.json                    # Dependencies & scripts
└── tsconfig.json                   # TypeScript config
```

---

## Configuration

### Cloudflare Bindings (wrangler.toml)

#### D1 Database
```toml
[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "d340a610-eac9-4804-bcbb-ccebe7f1adb4"
migrations_dir = "../../../packages/database-schema/drizzle/migrations"
```

#### R2 Storage
```toml
[[r2_buckets]]
binding = "USER_ASSETS"
bucket_name = "mirai-user-assets"
```

#### KV Namespaces
```toml
# General cache (long TTL)
[[kv_namespaces]]
binding = "CACHE"
id = "0c8c90fd2bc1430ba95596589f68ae1c"

# Voice session cache (short TTL: 5 min)
[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "f9761f3bee6d41b28b3bbb5d1355e822"
```

#### Durable Objects
```toml
[[durable_objects.bindings]]
name = "VOICE_SESSION"
class_name = "VoiceSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["VoiceSession"]
```

#### Service Binding (Voice Agent)
```toml
[[services]]
binding = "VOICE_AGENT"
service = "voice-agent-container"
```

### Environment Variables

#### Production
```toml
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "debug"
BETTER_AUTH_URL = "https://miraichat.app"
FRONTEND_URL = "https://miraichat.app"

# Polar Configuration
POLAR_ORGANIZATION_ID = "60a4b19f-1344-4c5f-b60c-1590bbe321fb"
POLAR_PRO_MONTHLY_ID = "c540d579-d932-459f-bc8c-c6f73c7091b3"
POLAR_PRO_YEARLY_ID = "15a6e08c-84d7-4076-a622-6f8e100bfa07"
POLAR_MAX_MONTHLY_ID = "005f746f-e207-4a00-b25c-a3d1c8f97084"
POLAR_MAX_YEARLY_ID = "bdd7e461-7fcd-431e-a266-6891e1758781"
```

#### Development
```toml
[env.dev.vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
BETTER_AUTH_URL = "http://localhost:8787"
FRONTEND_URL = "http://localhost:8787"
```

### Required Secrets

Set using `wrangler secret put SECRET_NAME`:

#### Authentication & OAuth
- `BETTER_AUTH_SECRET` - Generate with: `npx @better-auth/cli secret`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `DISCORD_CLIENT_ID` - From Discord Developer Portal (optional)
- `DISCORD_CLIENT_SECRET` - From Discord Developer Portal (optional)

#### Polar Payment Integration
- `POLAR_SANDBOX_ACCESS_TOKEN` - From Polar dashboard → Settings → API
- `POLAR_SANDBOX_WEBHOOK_SECRET` - From Polar dashboard → Settings → Webhooks

#### Inworld AI
- `INWORLD_API_KEY` - From Inworld AI dashboard
- `INWORLD_WORKSPACE_ID` - From Inworld AI dashboard

#### Email Service
- `RESEND_API_KEY` - From Resend dashboard

#### Admin
- `ADMIN_SECRET` - Custom secret for admin endpoints

---

## Authentication & Authorization

### Better-Auth Configuration

Located in `src/lib/auth.ts`, the authentication system uses Better-Auth with Drizzle adapter:

```typescript
export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema })

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification }
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // ... more config
  })
}
```

### Features

1. **Email/Password Authentication**
   - Email verification required
   - Custom password reset emails via Resend
   - Branded HTML email templates

2. **OAuth Providers**
   - Google OAuth
   - Discord OAuth
   - Automatic redirect to frontend after OAuth

3. **Session Management**
   - 7 days expiration
   - 24 hour update age
   - 5 minute cookie cache

4. **Rate Limiting** (Production only)
   - Global: 100 requests / 60 seconds
   - Sign-in: 5 requests / 10 seconds
   - Sign-up: 3 requests / 10 seconds

5. **Polar Integration**
   - Customer created on signup
   - Subscription checkout
   - Customer portal
   - Usage tracking
   - Webhook handling

### User Additional Fields

```typescript
user: {
  additionalFields: {
    displayName: { type: 'string', required: false },
    avatarUrl: { type: 'string', required: false },
    polarCustomerId: { type: 'string', required: false },
    subscriptionTier: { type: 'string', defaultValue: 'free' },
    subscriptionStatus: { type: 'string', required: false }
  }
}
```

### Subscription Tiers

| Tier | Voice Minutes | Characters | Features |
|------|--------------|------------|----------|
| **Free** | 20 total | Unlimited preset | Basic features |
| **Pro** | 500/month | Unlimited | Marketplace access, Priority support |
| **Max** | Unlimited | Unlimited custom | Voice cloning, Custom integration, SLA |

---

## API Routes

### Authentication Routes (`/api/auth/*`)

Handled by Better-Auth, no custom middleware required.

**Endpoints:**
- `POST /api/auth/sign-up/email` - Email signup
- `POST /api/auth/sign-in/email` - Email login
- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/discord` - Discord OAuth callback

### Character Routes (`/api/characters`)

Located in `src/routes/characters.ts`

#### POST /api/characters
Create a new character (auth required)

**Request Body:**
```typescript
{
  displayName: string
  description?: string
  personalityConfig: {
    motivations?: string[]
    flaws?: string[]
    dialogueStyle?: string
    adjectives?: string[]
    voiceConfig?: {
      voiceId: string
      stability?: number
      similarityBoost?: number
    }
  }
  live2dModelKey?: string
  avatarThumbnail?: string
}
```

**Response:**
```typescript
{
  id: string
  displayName: string
  description: string
  personalityConfig: PersonalityConfig
  inworldCharacterId: string  // Runtime reference: "runtime-{characterId}"
  userId: string
  createdAt: Date
}
```

#### GET /api/characters/presets
Get preset characters (public endpoint)

**Response:**
```typescript
{
  presets: Character[]
}
```

#### GET /api/characters
Get user's characters (auth required)

**Response:**
```typescript
{
  characters: Character[]
}
```

#### GET /api/characters/:id
Get specific character (auth required, supports presets)

**Response:**
```typescript
Character
```

#### PUT /api/characters/:id
Update character (auth required)

**Request Body:**
```typescript
{
  displayName?: string
  description?: string
  personalityConfig?: PersonalityConfig
  live2dModelKey?: string
  avatarThumbnail?: string
}
```

#### DELETE /api/characters/:id
Delete character (auth required, cannot delete presets)

**Response:**
```typescript
{ success: true }
```

### Voice Routes (`/api/voice`)

Located in `src/routes/voice.ts`

#### POST /api/voice/session/start
Start a new voice session (auth required)

**Request Body:**
```typescript
{
  characterId: string
}
```

**Pre-flight Checks:**
- Voice minute quota check
- Character access verification

**Response:**
```typescript
{
  sessionId: string
  sessionKey: string  // For backward compatibility
  conversationId: string
  websocketUrl: string  // "wss://miraichat.app/ws?sessionKey={key}"
  character: Character
  expiresAt: number  // Timestamp (5 minutes from creation)
}
```

**Session Flow:**
1. Check voice minute quota
2. Verify character access (owned or preset)
3. Create conversation record
4. Generate session key (UUID)
5. Store session data in KV cache (5 min TTL)
6. Store session in D1 database
7. Return WebSocket URL

#### GET /api/voice/session/:id
Get voice session details (auth required)

#### POST /api/voice/session/:id/end
End a voice session (auth required)

**Request Body:**
```typescript
{
  durationSeconds?: number
  audioSeconds?: number
}
```

**Actions:**
- Updates session status to "ended"
- Updates conversation end time
- Tracks usage for billing (voice minutes)

#### GET /api/voice/sessions/active
Get active voice sessions for user (auth required)

#### GET /api/voice/ws?sessionKey={key}
WebSocket endpoint (no auth middleware, uses sessionKey)

**WebSocket Upgrade Flow:**
1. Validate sessionKey from query param
2. Retrieve session data from KV cache
3. Check session expiration
4. Check voice minute quota (defense in depth)
5. Call `/load` on Voice Agent Container to initialize character
6. Forward WebSocket upgrade to Voice Agent Container
7. Container handles WebSocket connection with Inworld Runtime

**Character Loading:**
```typescript
POST /load?key={sessionKey}
Headers:
  X-User-ID: {userId}
  X-Character-ID: {characterId}
  X-Inworld-Character-ID: {inworldCharacterId}
  X-Inworld-API-Key: {apiKey}
  X-Inworld-Workspace-ID: {workspaceId}
Body:
  {
    agent: PersonalityConfig,
    userName: string,
    voiceConfig: VoiceConfig
  }
```

**Timeout Handling:**
- 60 second timeout for `/load` request
- Container cold start + VAD model loading + Inworld graph creation can take 30-60s
- Returns 504 Gateway Timeout if exceeded

### Asset Routes (`/api/assets`)

Located in `src/routes/assets.ts`

#### POST /api/assets/avatar
Upload user avatar (auth required)

**Form Data:**
- `avatar`: File (image, max 5MB)

**Response:**
```typescript
{
  key: string  // R2 key: "users/{userId}/avatar/{timestamp}.{ext}"
  url: string  // Public URL: "/api/assets/{key}"
  size: number
  type: string
}
```

#### POST /api/assets/upload
Upload character asset (auth required)

**Form Data:**
- `file`: File
- `characterId`: string
- `type`: 'live2d' | 'avatar' (default: 'live2d')

**Actions:**
- Verifies character ownership
- Uploads to R2: `users/{userId}/characters/{characterId}/{type}/{timestamp}-{filename}`
- Updates character record if type is 'live2d' or 'avatar'

#### GET /api/assets/public/:key
Download public asset (no auth, preset characters only)

**Key Prefix:** Must start with `presets/`

**Headers:**
- `Cache-Control: public, max-age=31536000` (1 year)
- `Access-Control-Allow-Origin: *`

#### GET /api/assets/:key
Download asset (auth required)

**Key Prefix:** Must start with `users/{userId}/`

**Headers:**
- `Cache-Control: max-age=86400` (24 hours)

#### DELETE /api/assets/:key
Delete asset (auth required)

### Payment Routes (`/api/payments`)

Located in `src/routes/payments.ts`

#### POST /api/payments/checkout
Create Polar checkout session (auth required)

**Request Body:**
```typescript
{
  tier: 'pro' | 'max'
  billingCycle?: 'monthly' | 'yearly'  // Default: 'monthly'
}
```

**Response:**
```typescript
{
  checkoutUrl: string
  checkoutId: string
}
```

**Product ID Mapping:**
- Pro Monthly: `c540d579-d932-459f-bc8c-c6f73c7091b3`
- Pro Yearly: `15a6e08c-84d7-4076-a622-6f8e100bfa07`
- Max Monthly: `005f746f-e207-4a00-b25c-a3d1c8f97084`
- Max Yearly: `bdd7e461-7fcd-431e-a266-6891e1758781`

#### GET /api/payments/portal
Get customer portal URL (auth required)

**Response:**
```typescript
{
  portalUrl: string
}
```

**Requirements:**
- User must have `polarCustomerId`

#### GET /api/payments/subscription
Get current subscription status (auth required)

**Response:**
```typescript
{
  subscription: Subscription | null
  tier: 'free' | 'pro' | 'max'
  status: string | null
  polarCustomerId: string | null
  usage: {
    voiceMinutes: number
    voiceMinutesLimit: number
    voiceMinutesRemaining: number
  }
  limits: {
    voiceMinutes: number
    characters: number
    features: string[]
  }
}
```

**Usage Calculation:**
- **Paid tiers**: Usage since current billing period start
- **Free tier**: ALL usage (no billing period reset)

**Graceful Degradation:**
- Returns 200 with default free tier data if database errors occur
- Critical user data fetch failures throw errors
- Non-critical subscription/usage fetch failures log and continue

#### POST /api/payments/usage
Record usage event (auth required, internal use)

**Request Body:**
```typescript
{
  eventType: 'voice_minutes' | 'character_creation' | 'message_sent'
  quantity: number
  metadata?: object
}
```

**Actions:**
- Creates usage event in database
- Syncs to Polar meter (placeholder for actual implementation)
- Marks as `polarSynced: true` if successful

### Webhook Routes (`/api/webhooks`)

Located in `src/routes/webhooks.ts`

#### POST /api/webhooks/polar
Handle Polar webhook events (signature verification)

**Verification:**
- Uses `@polar-sh/sdk/webhooks` `validateEvent()`
- Requires headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`
- Validates against `POLAR_SANDBOX_WEBHOOK_SECRET`

**Supported Events:**

1. **subscription.created**
   - Creates subscription record in database
   - Updates user tier
   - Links Polar customer to user

2. **subscription.active** (most reliable)
   - Activates subscription (after payment confirmation)
   - Creates/updates subscription record
   - Links customer by email if not already linked
   - Updates user tier to active

3. **subscription.updated**
   - Updates subscription details
   - Updates user tier and status
   - Handles plan changes

4. **subscription.canceled**
   - Marks subscription as canceled
   - Downgrades user to free tier

5. **subscription.revoked**
   - Immediately revokes subscription (fraud/chargeback)
   - Downgrades user to free tier

6. **order.created / order.paid**
   - Logs one-time purchases
   - Subscription activation handled by subscription.active

7. **benefit_grant.created / benefit_grant.revoked**
   - Can be used for feature-specific access control

8. **checkout.created / checkout.updated**
   - Logs checkout lifecycle

9. **customer.created**
   - Links Polar customer to existing user by email
   - Sets `polarCustomerId` on user record

10. **customer.updated**
    - Logs customer metadata updates

**Tier Mapping from Product ID:**
```typescript
function getTierFromProductId(productId: string): 'free' | 'pro' | 'max' {
  // Pro products: c540d579, 15a6e08c
  // Max products: 005f746f, bdd7e461
  // Default: free
}
```

**Error Handling:**
- Returns 200 OK to acknowledge receipt (prevents Polar retry)
- Logs all errors for investigation
- Change to 500 if you want Polar to retry failed events

### Admin Routes (`/admin`)

Located in `src/routes/admin.ts`

**Authentication:**
```typescript
adminRoutes.use('*', async (c, next) => {
  const adminSecret = c.req.header('X-Admin-Secret')
  if (!adminSecret || adminSecret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})
```

#### POST /admin/seed-presets-runtime
Seed preset characters for Inworld Runtime

**Actions:**
- Calls `seedPresetsRuntime()` from database schema package
- Creates preset character records with Inworld Runtime approach

#### GET /admin/seed-presets
Check seed status and list preset characters

**Response:**
```typescript
{
  presetCount: number
  presets: Array<{
    id: string
    displayName: string
    description: string
    inworldCharacterId: string
    createdAt: Date
  }>
}
```

#### DELETE /admin/seed-presets/:id
Delete a specific preset character

---

## Services & Business Logic

### CharacterService (`src/services/characters.ts`)

**Key Feature: Inworld Runtime Approach**

Characters are NOT pre-created via Inworld Studio API. Instead:

```typescript
// Generate a unique Runtime character reference
// This is NOT an actual Inworld character ID
const runtimeCharacterRef = `runtime-${characterId}`
```

The Voice Agent Container creates characters on-the-fly from personality configuration when the session starts.

**Methods:**

1. **createCharacter()**
   - Creates character record in D1
   - Generates runtime character reference
   - Returns character with personality config

2. **getUserCharacters(userId)**
   - Fetches user-owned characters
   - Ordered by creation date

3. **getPresetCharacters()**
   - Fetches all preset characters (`isPreset=true`)
   - Ordered by name

4. **getCharacter(characterId, userId)**
   - Supports both user-owned and preset characters
   - Uses OR logic: owned by user OR is preset

5. **updateCharacter(characterId, userId, data)**
   - Updates character in database
   - Voice agent uses updated config next session

6. **deleteCharacter(characterId, userId)**
   - Verifies ownership
   - Prevents preset deletion
   - Cascades to conversations/sessions

### VoiceSessionService (`src/services/voice.ts`)

**Methods:**

1. **startSession(userId, characterId)**
   - Verifies character access (owned or preset)
   - Creates conversation record
   - Generates session key (UUID)
   - Creates session metadata with 5 min expiration
   - Stores in KV cache (`session:{key}`, 300s TTL)
   - Stores in D1 database
   - Returns WebSocket URL using unified domain

   **WebSocket URL Strategy:**
   ```typescript
   // Primary: Unified domain with service binding
   wss://miraichat.app/ws?sessionKey={key}
   // Flow: Client → stage-web → Voice Agent (service) → Container
   // Latency: ~50ms initial + ~0.5-2ms service binding

   // Fallback options (for testing):
   // Direct Voice Worker:  wss://voice.miraichat.app/ws?sessionKey={key}
   // Via API Gateway:      wss://api.miraichat.app/api/voice/ws?sessionKey={key}
   ```

2. **getSession(sessionId, userId)**
   - Retrieves session by ID
   - Verifies user ownership

3. **endSession(sessionId, userId, metrics)**
   - Updates session status to "ended"
   - Updates conversation end time
   - Tracks usage for billing
   - Always tracks usage, even if 0 seconds

4. **getActiveSessions(userId)**
   - Returns all active sessions for user

5. **trackUsage(userId, conversationId, audioSeconds)** (private)
   - Converts audio seconds to minutes (rounded up)
   - Creates usage event in database
   - Marks as `polarSynced: false`
   - TODO: Async Polar API sync

### VoiceSession Durable Object (`src/services/voice.ts`)

**Purpose:** Manages WebSocket voice sessions with persistent state

**Note:** Currently a placeholder implementation. The actual WebSocket proxying is handled directly in the API Gateway voice routes.

**Methods:**

1. **fetch(request)**
   - `/init` - Initialize session metadata
   - `/websocket` - WebSocket upgrade handler

2. **webSocketMessage(ws, message)**
   - TODO: Forward to Inworld Container when binding available

3. **webSocketClose(ws, code, reason, wasClean)**
   - Logs closure and cleans up session state

4. **webSocketError(ws, error)**
   - Logs WebSocket errors

### Usage Tracking Service (`src/services/usage.ts`)

**Functions:**

1. **trackUsage(db, polarAccessToken, event)**
   - Creates usage event in database
   - Syncs to Polar for voice minutes (placeholder)
   - Returns usage statistics

2. **getCurrentUsage(db, userId)**
   - Calculates current usage in billing period
   - Returns voice minutes and character usage
   - Handles billing period logic:
     - **Paid tiers**: Since `currentPeriodStart`
     - **Free tier**: All-time usage

3. **checkUsageQuota(db, userId, eventType, requiredAmount)**
   - Checks if user has available quota
   - Returns `{ allowed, reason?, usage? }`
   - Handles unlimited tiers (-1)

4. **checkUsageWarnings(db, userId, eventType)**
   - Returns warning level: 'none' | 'approaching' (80%) | 'exceeded' (100%)
   - Calculates percent used
   - No warnings for unlimited tiers

**Tier Limits:**
```typescript
{
  free: {
    voiceMinutes: 20,      // Total (no billing period)
    characters: 1          // 1 preset character
  },
  pro: {
    voiceMinutes: 500,     // Per month
    characters: -1         // Unlimited
  },
  max: {
    voiceMinutes: -1,      // Unlimited
    characters: -1         // Unlimited
  }
}
```

### Usage Monitor Service (`src/services/usage-monitor.ts`)

**Purpose:** Real-time monitoring of active voice sessions

**In-Memory Storage:** Per-worker instance Map of active monitors

**Functions:**

1. **startMonitoring(sessionId, userId)**
   - Creates monitor with session start time
   - Stores in `activeMonitors` Map

2. **stopMonitoring(sessionId)**
   - Calculates total session seconds
   - Removes monitor from Map
   - Returns total seconds

3. **checkQuotaStatus(db, sessionId)**
   - Calculates current accumulated time
   - Checks quota accounting for session time
   - Returns warning level and usage

4. **getSessionUsage(sessionId)**
   - Returns current seconds and minutes for session
   - Does not check quota

5. **getActiveMonitors()**
   - Returns all active monitors (debugging)

6. **periodicQuotaCheck(db, sessionId, callbacks)**
   - Should be called every 60 seconds during WebSocket connection
   - Invokes callbacks for warnings and quota exceeded
   - Returns true to continue, false to disconnect

---

## Middleware

Located in `src/lib/middleware.ts`

### authMiddleware(auth)

Validates user session and adds to context:

```typescript
const session = await auth.api.getSession({ headers: c.req.raw.headers })
if (!session) return c.json({ error: 'Unauthorized' }, 401)

c.set('user', session.user)
c.set('session', session.session)
```

**Usage:**
```typescript
app.use('/api/characters', authMiddleware(auth))
```

### errorHandler(err, c)

Global error handling:
- Handles `APIError` with status code
- Logs all errors
- Returns 500 for unexpected errors

### logger(c, next)

Request logging:
```
[METHOD] URL - STATUS (TIME)
```

### requireSubscription(...allowedTiers)

**Deprecated** - Use `requireTier()` instead

Checks if user has one of the allowed subscription tiers:

```typescript
app.get('/api/premium', requireSubscription('pro', 'enterprise'), handler)
```

### requireTier(requiredTier)

Enhanced tier middleware with hierarchy support:

```typescript
const tierHierarchy = {
  free: 0,
  pro: 1,
  enterprise: 2  // Note: Should be 'max' in actual implementation
}

// Higher tiers can access lower tier features
if (userTierLevel < requiredTierLevel) {
  return c.json({ error: 'Subscription required', ... }, 403)
}
```

**Usage:**
```typescript
app.get('/api/premium-feature', requireTier('pro'), handler)
app.get('/api/enterprise-feature', requireTier('enterprise'), handler)
```

### checkVoiceMinutes(requiredMinutes)

Usage limit middleware for voice minutes:

```typescript
const limits = getTierLimits(userTier)

// Enterprise has unlimited
if (limits.voiceMinutes === -1) {
  await next()
  return
}

// Note: Simplified implementation - actual quota check happens
// in route handler using checkUsageQuota()
```

**Usage:**
```typescript
app.post('/api/voice/start', checkVoiceMinutes(1), handler)
```

### getTierLimits(tier)

Helper function returning tier-specific limits:

```typescript
{
  free: {
    voiceMinutes: 20,
    characters: 1,
    features: ['basic']
  },
  pro: {
    voiceMinutes: 500,
    characters: 10,
    features: ['basic', 'advanced', 'priority_support']
  },
  enterprise: {
    voiceMinutes: -1,  // Unlimited
    characters: -1,    // Unlimited
    features: ['basic', 'advanced', 'priority_support', 'custom_integration', 'sla']
  }
}
```

---

## Usage Tracking & Quota Enforcement

### Three-Layer Quota Enforcement

1. **Pre-Session Check** (`POST /api/voice/session/start`)
   - Checks quota before creating session
   - Returns 403 with upgrade URL if quota exceeded

2. **WebSocket Connection Check** (`GET /api/voice/ws`)
   - Defense in depth quota check
   - Deletes session if user can't use it
   - Returns 403 with upgrade URL

3. **Real-Time Monitoring** (Usage Monitor Service)
   - In-memory tracking of active sessions
   - Periodic quota checks during WebSocket connection
   - Can disconnect session if quota exceeded mid-session

### Usage Event Flow

```
1. Voice Session Ends
   ↓
2. VoiceSessionService.endSession()
   ↓
3. trackUsage(userId, conversationId, audioSeconds)
   ↓
4. Create usageEvents record
   - eventType: 'voice_minutes'
   - quantity: Math.ceil(audioSeconds / 60)
   - polarSynced: false
   ↓
5. TODO: Async Polar API sync
   - Mark polarSynced: true
```

### Usage Calculation Logic

**Free Tier:**
```typescript
// Count ALL usage (no billing period reset)
const totalUsage = allUsageEvents
  .reduce((sum, event) => sum + event.quantity, 0)
```

**Paid Tiers (Pro/Max):**
```typescript
// Count usage since current billing period start
const currentPeriodStart = subscription.currentPeriodStart
const periodUsage = allUsageEvents
  .filter(event => event.createdAt >= currentPeriodStart)
  .reduce((sum, event) => sum + event.quantity, 0)
```

### Quota Check Response Format

```typescript
{
  allowed: boolean
  reason?: string  // Human-readable error message
  usage?: {
    used: number
    limit: number  // -1 for unlimited
    remaining: number  // -1 for unlimited
  }
}
```

---

## Payment Integration (Polar)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (stage-web)                    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway (/api/payments)                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Payment Routes:                                 │   │
│  │  - POST /checkout  → Creates Polar checkout     │   │
│  │  - GET /portal     → Customer portal URL        │   │
│  │  - GET /subscription → Current subscription     │   │
│  │  - POST /usage     → Record usage event         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Better-Auth Polar Plugin:                       │   │
│  │  - createCustomerOnSignUp: true                  │   │
│  │  - checkout(), portal(), usage(), webhooks()     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Webhook Handler (/api/webhooks/polar):          │   │
│  │  - Signature verification                        │   │
│  │  - subscription.* events                         │   │
│  │  - order.* events                                │   │
│  │  - customer.* events                             │   │
│  │  - benefit_grant.* events                        │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Webhook Events
                    ▼
┌─────────────────────────────────────────────────────────┐
│            Polar (Sandbox Environment)                   │
│         https://sandbox-api.polar.sh                     │
│                                                           │
│  Products:                                                │
│  - Pro Monthly:  c540d579-d932-459f-bc8c-c6f73c7091b3   │
│  - Pro Yearly:   15a6e08c-84d7-4076-a622-6f8e100bfa07   │
│  - Max Monthly:  005f746f-e207-4a00-b25c-a3d1c8f97084   │
│  - Max Yearly:   bdd7e461-7fcd-431e-a266-6891e1758781   │
└─────────────────────────────────────────────────────────┘
```

### Polar Client Initialization

```typescript
const polar = new Polar({
  accessToken: env.POLAR_SANDBOX_ACCESS_TOKEN,
  server: 'sandbox'  // Required: Routes to https://sandbox-api.polar.sh
})
```

### Checkout Flow

1. User clicks "Upgrade to Pro" button
2. Frontend calls `POST /api/payments/checkout`
3. API Gateway creates Polar checkout session:
   ```typescript
   const checkout = await polar.checkouts.create({
     products: [productId],
     customerEmail: userEmail,
     metadata: { userId, tier, billingCycle },
     successUrl: `${env.FRONTEND_URL}/dashboard?checkout=success&tier=${tier}`
   })
   ```
4. User redirected to `checkout.url`
5. User completes payment on Polar
6. Polar sends webhooks:
   - `subscription.created`
   - `subscription.active` (most reliable)
   - `order.created`
   - `order.paid`
7. Webhook handler updates database:
   - Creates/updates subscription record
   - Links Polar customer to user
   - Updates user `subscriptionTier` and `subscriptionStatus`
8. User redirected to success URL
9. Frontend refetches subscription status

### Customer Portal Flow

1. User clicks "Manage Subscription"
2. Frontend calls `GET /api/payments/portal`
3. API Gateway creates portal session:
   ```typescript
   const portal = await polar.customerSessions.create({
     customerId: polarCustomerId
   })
   ```
4. User redirected to `portal.customerPortalUrl`
5. User can view/manage subscription on Polar
6. Changes trigger webhooks (e.g., `subscription.canceled`)

### Webhook Event Handling

**subscription.active** (Most Reliable):
```typescript
async function handleSubscriptionActive(db, data, env) {
  // 1. Check if subscription exists
  // 2. If not, try to link customer by email
  // 3. Create/update subscription record
  // 4. Update user tier to active
}
```

**Race Condition Handling:**
- `subscription.created` might arrive before `customer.created`
- `subscription.active` retries customer linking by email
- Fallback: Fetch customer from Polar API and match by email

**Timestamp Conversion:**
```typescript
// Polar sends timestamps in seconds
// Drizzle expects Date objects
currentPeriodStart: new Date(currentPeriodStart * 1000)
```

### Usage Metering (Placeholder)

```typescript
// TODO: Actual implementation would use Polar's usage API
// await polar.usage.record({
//   customerId: polarCustomerId,
//   meterId: 'voice_minutes',
//   value: quantity,
//   timestamp: new Date().toISOString(),
// })
```

---

## Durable Objects

### VoiceSession Durable Object

**Purpose:** Persistent WebSocket session state

**Class:** `VoiceSession` (exported from `src/index.ts`)

**Configuration:**
```toml
[[durable_objects.bindings]]
name = "VOICE_SESSION"
class_name = "VoiceSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["VoiceSession"]
```

**Current Implementation:** Placeholder

The actual WebSocket proxying is currently handled directly in the API Gateway voice routes (`src/routes/voice.ts`). The Durable Object is available for future migration when more complex session state management is needed.

**Potential Use Cases:**
- Multi-user voice rooms
- Session state persistence across worker instances
- Advanced session analytics
- Custom session lifecycle hooks

---

## Service Bindings

### Voice Agent Container Binding

**Configuration:**
```toml
[[services]]
binding = "VOICE_AGENT"
service = "voice-agent-container"
```

**Benefits:**
- Ultra-low latency: ~0.5-2ms (vs ~50ms public internet)
- Internal routing within Cloudflare's network
- No external DNS lookups
- No TLS handshake overhead

### Usage in API Gateway

**Character Loading:**
```typescript
const loadRequest = new Request('/load?key={sessionKey}', {
  method: 'POST',
  headers: {
    'X-User-ID': userId,
    'X-Character-ID': characterId,
    'X-Inworld-Character-ID': inworldCharacterId,
    'X-Inworld-API-Key': env.INWORLD_API_KEY,
    'X-Inworld-Workspace-ID': env.INWORLD_WORKSPACE_ID
  },
  body: JSON.stringify({
    agent: personalityConfig,
    userName: userId,
    voiceConfig: voiceConfig
  })
})

const response = await c.env.VOICE_AGENT.fetch(loadRequest)
```

**WebSocket Upgrade:**
```typescript
const containerRequest = new Request('/session', {
  method: c.req.method,
  headers: {
    // Forward WebSocket upgrade headers
    ...Object.fromEntries(c.req.raw.headers.entries()),
    // Add session context
    'X-Session-Key': sessionKey,
    'X-Conversation-ID': conversationId
  }
})

return c.env.VOICE_AGENT.fetch(containerRequest)
```

### Request Flow

```
Client
  ↓ WSS (Public Internet ~50ms)
Frontend (stage-web)
  ↓ Service Binding (~0.5-2ms)
Voice Agent Worker (voice-agent-container)
  ↓ Container Proxy (~1-5ms)
Voice Agent Container (multi-tenant.ts)
  ↓ WebSocket
Inworld Runtime
```

**Total Latency:**
- Initial Connection: ~50ms (public) + ~0.5-2ms (binding) = ~50-52ms
- Per Message: ~50ms (public) + ~0.5-2ms (binding) + ~1-5ms (container) = ~51-57ms

**Comparison with Direct Public Routing:**
- Initial Connection: ~50ms + ~50ms = ~100ms
- Per Message: ~50ms + ~50ms = ~100ms
- **Savings:** ~45-50ms per connection, ~43-49ms per message

---

## Database Integration

### Drizzle ORM Setup

```typescript
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@proj-airi/database-schema'

const db = drizzle(env.DB, { schema })
```

### Schema Package

Located in `packages/database-schema`:
- **Drizzle Schema** - Type-safe table definitions
- **Migrations** - Version-controlled schema changes
- **Seed Functions** - Preset character seeding

### Key Tables

**user**
- `id`, `email`, `name`, `emailVerified`, `image`, `createdAt`, `updatedAt`
- **Additional:** `displayName`, `avatarUrl`, `polarCustomerId`, `subscriptionTier`, `subscriptionStatus`

**session**
- `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `ipAddress`, `userAgent`, `userId`

**account**
- `id`, `accountId`, `providerId`, `userId`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password`, `createdAt`, `updatedAt`

**verification**
- `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`

**characters**
- `id`, `displayName`, `description`, `personalityConfig` (JSON), `inworldCharacterId`, `userId`, `isPreset`, `live2dModelKey`, `avatarThumbnail`, `createdAt`, `updatedAt`

**conversations**
- `id`, `userId`, `characterId`, `startedAt`, `endedAt`, `durationSeconds`

**voiceSessions**
- `id`, `conversationId`, `userId`, `characterId`, `status`, `websocketUrl`, `startedAt`, `endedAt`, `totalAudioSeconds`

**subscriptions**
- `id`, `userId`, `polarCustomerId`, `productId`, `priceId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `createdAt`, `updatedAt`

**usageEvents**
- `id`, `userId`, `eventType`, `quantity`, `metadata` (JSON), `createdAt`, `polarSynced`

### Query Examples

**Get User with Subscription:**
```typescript
const result = await db
  .select()
  .from(user)
  .where(eq(user.id, userId))
  .limit(1)

const currentUser = result[0]
const tier = currentUser.subscriptionTier || 'free'
```

**Get Active Subscription:**
```typescript
const result = await db
  .select()
  .from(subscriptions)
  .where(
    and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active')
    )
  )
  .orderBy(desc(subscriptions.createdAt))
  .limit(1)
```

**Get Usage in Billing Period:**
```typescript
const allUsage = await db
  .select()
  .from(usageEvents)
  .where(
    and(
      eq(usageEvents.userId, userId),
      eq(usageEvents.eventType, 'voice_minutes')
    )
  )

const periodUsage = allUsage
  .filter(event => event.createdAt >= currentPeriodStart)
  .reduce((sum, event) => sum + event.quantity, 0)
```

---

## Error Handling

### Global Error Handler

```typescript
export async function errorHandler(err: Error, c: Context<HonoEnv>) {
  console.error('[ERROR]', err)

  if (err.name === 'APIError') {
    return c.json({
      error: err.message,
      status: (err as any).status || 500
    }, (err as any).status || 500)
  }

  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500)
}
```

### Try-Catch Patterns

**Route Handlers:**
```typescript
try {
  const result = await service.doSomething()
  return c.json(result)
} catch (error) {
  console.error('[ROUTE] Error:', error)
  return c.json({
    error: 'Failed to do something',
    message: error instanceof Error ? error.message : 'Unknown error'
  }, 500)
}
```

**Service Methods:**
```typescript
async doSomething() {
  // Validate input
  if (!input) {
    throw new Error('Input required')
  }

  // Database operation
  const result = await db.insert(table).values(data)

  return result
}
```

### Graceful Degradation

**Subscription Endpoint:**
- Returns 200 with free tier defaults if database errors
- Logs errors for investigation
- Never returns 500 to prevent UI breakage

```typescript
try {
  // Fetch subscription data
} catch (error) {
  console.error('[PAYMENTS] Critical error:', error)

  // Return defaults instead of 500
  return c.json({
    subscription: null,
    tier: 'free',
    usage: { voiceMinutes: 0, voiceMinutesLimit: 20, voiceMinutesRemaining: 20 },
    error: 'Partial data returned due to database error'
  })
}
```

---

## Deployment

### Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Authenticated:** `wrangler login`

### Setting Up Bindings

**1. Create D1 Database:**
```bash
wrangler d1 create mirai-production
# Note the database_id and update wrangler.toml
```

**2. Run Migrations:**
```bash
wrangler d1 migrations apply mirai-production --remote
```

**3. Create R2 Bucket:**
```bash
wrangler r2 bucket create mirai-user-assets
```

**4. Create KV Namespaces:**
```bash
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "SESSION_CACHE"
# Note the IDs and update wrangler.toml
```

### Setting Secrets

**All secrets (production):**
```bash
# Auth
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET

# Polar (Sandbox)
wrangler secret put POLAR_SANDBOX_ACCESS_TOKEN
wrangler secret put POLAR_SANDBOX_WEBHOOK_SECRET

# Inworld
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID

# Email
wrangler secret put RESEND_API_KEY

# Admin
wrangler secret put ADMIN_SECRET
```

### Deployment Commands

**Development:**
```bash
pnpm dev
# or
wrangler dev
```

**Production:**
```bash
pnpm deploy
# or
wrangler deploy
```

**View Logs:**
```bash
pnpm tail
# or
wrangler tail
```

**Type Check:**
```bash
pnpm typecheck
```

### Post-Deployment

**1. Seed Preset Characters:**
```bash
curl -X POST https://miraichat.app/admin/seed-presets-runtime \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

**2. Configure Polar Webhooks:**
- Go to Polar Dashboard → Settings → Webhooks
- Add webhook URL: `https://miraichat.app/api/webhooks/polar`
- Set webhook secret (same as `POLAR_SANDBOX_WEBHOOK_SECRET`)
- Enable events: subscription.*, order.*, customer.*, benefit_grant.*

**3. Test OAuth:**
- Test Google OAuth: `https://miraichat.app/api/auth/callback/google`
- Test Discord OAuth: `https://miraichat.app/api/auth/callback/discord`
- Ensure redirects work correctly to frontend

**4. Test Voice Session:**
- Create account
- Start voice session
- Check WebSocket connection
- Verify usage tracking

### Monitoring

**1. Cloudflare Dashboard:**
- Workers → Analytics
- Real-time logs
- Error rate monitoring

**2. Custom Logging:**
```typescript
console.log('[PREFIX] Message:', data)
console.error('[PREFIX] Error:', error)
```

**3. Usage Metrics:**
```bash
# Get subscription status
curl https://miraichat.app/api/payments/subscription \
  -H "Cookie: your-session-cookie"
```

---

## Summary

The Mirai API Gateway is a production-ready Cloudflare Workers application that provides:

✅ **Authentication** - Better-Auth with OAuth (Google, Discord)
✅ **Character Management** - Inworld Runtime approach (on-the-fly character creation)
✅ **Voice Sessions** - WebSocket proxy with ultra-low latency service bindings
✅ **Asset Management** - R2 storage for avatars and Live2D models
✅ **Payment Integration** - Polar subscriptions with webhook handling
✅ **Usage Tracking** - Three-layer quota enforcement (pre-session, WebSocket, real-time)
✅ **Admin Operations** - Preset character seeding
✅ **Type Safety** - Full TypeScript with Drizzle ORM
✅ **Edge Performance** - Global CDN with ~50ms latency

**Key Innovations:**
- Service binding architecture for ~0.5-2ms internal latency
- Inworld Runtime approach eliminating pre-created character overhead
- Three-layer quota enforcement preventing usage abuse
- Graceful degradation for critical user-facing endpoints
- Comprehensive webhook handling for Polar integration

**Future Enhancements:**
- Full Durable Object integration for advanced session management
- Polar usage metering API implementation
- Character marketplace with revenue sharing
- Advanced analytics and monitoring
- Multi-region deployment optimization

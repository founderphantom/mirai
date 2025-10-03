# Production-Ready SaaS Architecture - MiraiChat
## AI Companion Platform with Live2D & Voice Interaction

**Status:** Architecture Design
**Target Scale:** 10,000+ concurrent users
**Last Updated:** January 2025
**Version:** 3.0 (Cloudflare-First Architecture)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Services Architecture](#backend-services-architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [Database Schema Design](#database-schema-design)
7. [Voice AI Infrastructure](#voice-ai-infrastructure)
8. [Asset Management & CDN](#asset-management--cdn)
9. [Marketplace System](#marketplace-system)
10. [Payment & Billing](#payment--billing)
11. [Monitoring & Observability](#monitoring--observability)
12. [Security & Compliance](#security--compliance)
13. [Scaling Strategy](#scaling-strategy)
14. [Cost Analysis & Optimization](#cost-analysis--optimization)
15. [Deployment Pipeline](#deployment-pipeline)
16. [Disaster Recovery](#disaster-recovery)

---

## Executive Summary

MiraiChat is a production-ready SaaS platform that enables users to interact with AI-powered Live2D companions through voice and text. The platform supports:

- **Real-time Voice AI** using Cloudflare's Realtime Voice AI infrastructure
- **Live2D Character Rendering** with WebGL/Three.js
- **Creator Marketplace** for custom characters and personalities
- **Multi-tenant Architecture** supporting 10,000+ concurrent users
- **Global Edge Deployment** via Cloudflare Workers (330+ locations)
- **Enterprise-grade Security** with Supabase Auth + Worker-enforced authorization

### Key Differentiators

| Feature | Implementation | Scale Target |
|---------|---------------|--------------|
| Voice Latency | < 800ms end-to-end | Real-time conversation |
| Concurrent Users | Cloudflare edge network | 10,000+ |
| Character Models | R2 + CDN delivery | Unlimited |
| Memory Storage | Vectorize + D1 | Per-user semantic memory |
| Database | Cloudflare D1 (global) | 10GB+ per database |
| File Storage | Cloudflare R2 | Unlimited, no egress fees |
| Monthly Cost | ~$8/mo infrastructure | 75% cheaper than hybrid |

### Why Cloudflare-First Architecture?

**MiraiChat uses Cloudflare for everything except authentication.** This architectural decision provides massive cost savings and performance benefits:

#### ✅ 75% Cost Reduction
```
Traditional Stack (Supabase + Cloudflare):
  Supabase Pro: $25/mo (Auth + Postgres + Storage)
  Cloudflare D1: $5/mo
  Cloudflare R2: $3/mo
  Total: $33/mo

Cloudflare-First Stack:
  Supabase Free: $0/mo (Auth only, <50K MAU)
  Cloudflare D1: $5/mo (primary database)
  Cloudflare R2: $3/mo (all file storage)
  Total: $8/mo

Savings: $25/mo = $300/year
```

#### ✅ Unified Data Platform
- **D1 for structured data:** Users, characters, conversations, purchases
- **Vectorize for AI memory:** Semantic search, embeddings, RAG
- **R2 for files:** Live2D models, avatars, audio, uploads
- **KV for caching:** Session data, API responses
- **Durable Objects for state:** Voice sessions, real-time updates

#### ✅ Performance Benefits
- **Global distribution:** D1 automatically replicates to 330+ edge locations
- **No egress fees:** R2 → Workers = FREE bandwidth
- **Sub-50ms queries:** D1 serves from nearest datacenter
- **Edge compute:** All business logic runs at the edge

#### ✅ Simplified Architecture
- **One vendor:** Single billing, single dashboard, single API
- **Service bindings:** Zero-latency worker-to-worker calls
- **Built-in observability:** Tail logs, Analytics Engine, Logpush
- **No VPC complexity:** Everything runs on Cloudflare's network

#### ✅ What About Supabase?
**Supabase is ONLY used for Auth (free tier):**
- OAuth providers (Google, GitHub, Discord)
- JWT token generation & verification
- Email/password authentication
- Password reset flows
- Stays under 50K MAU (way above our 10K user target)

#### ⚠️ Trade-offs Accepted
| Feature Lost | Cloudflare Alternative |
|-------------|------------------------|
| Row Level Security (RLS) | Worker-enforced auth checks |
| Auto-generated API | Hono-based custom API (more control) |
| Supabase Realtime | Durable Objects + WebSockets |
| Supabase Dashboard | Cloudflare Dashboard + D1 Console |

**Result:** Same functionality, 75% cheaper, better performance! 🚀

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER DEVICES                                │
│  (Web Browser, Mobile Web, Progressive Web App)                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE GLOBAL NETWORK                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │   CDN/Cache  │  │     WAF      │  │  DDoS Protection        │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKERS (Full-Stack Edge)                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │   Frontend Worker (SSR + Static Assets)                    │    │
│  │  - Vue SSR for marketing/marketplace pages (SEO)           │    │
│  │  - Static SPA for app interface (cached)                   │    │
│  │  - Asset serving from R2 (Live2D models, textures)         │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │   Backend Workers                                           │    │
│  │  ├─ API Gateway Worker (Auth + Business Logic)             │    │
│  │  ├─ Voice Agent (Durable Objects)                          │    │
│  │  ├─ Marketplace Worker                                     │    │
│  │  ├─ Storage Worker (R2 uploads/downloads)                  │    │
│  │  └─ Realtime Worker (Durable Objects for live updates)     │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                ┌────────────────┴─────────────────────────────┐
                ▼                ▼                             ▼
  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
  │   SUPABASE          │  │  CLOUDFLARE DATA     │  │   EXTERNAL SERVICES      │
  │  - Auth ONLY        │  │  ┌────────────────┐  │  │  - OpenRouter (LLM)      │
  │    (Free Tier)      │  │  │ D1 (Primary DB)│  │  │  - Inworld (TTS)         │
  │  - OAuth            │  │  │ - Users        │  │  │  - Stripe (Payments)     │
  │  - JWT tokens       │  │  │ - Characters   │  │  │  - Resend (Email)        │
  │  - <50K MAU         │  │  │ - Marketplace  │  │  │  - Sentry (Errors)       │
  └─────────────────────┘  │  │ - Purchases    │  │  └──────────────────────────┘
                           │  └────────────────┘  │
                           │  ┌────────────────┐  │
                           │  │ R2 (All Files) │  │
                           │  │ - Live2D models│  │
                           │  │ - Avatars      │  │
                           │  │ - Uploads      │  │
                           │  │ - Audio cache  │  │
                           │  └────────────────┘  │
                           │  ┌────────────────┐  │
                           │  │ Vectorize (AI) │  │
                           │  │ - Embeddings   │  │
                           │  │ - Memory RAG   │  │
                           │  └────────────────┘  │
                           │  ┌────────────────┐  │
                           │  │ KV (Cache)     │  │
                           │  └────────────────┘  │
                           │  ┌────────────────┐  │
                           │  │ Analytics      │  │
                           │  └────────────────┘  │
                           └──────────────────────┘
```

### Technology Stack

#### Frontend (Cloudflare Workers)
- **Framework:** Vue 3 + TypeScript + Vite
- **SSR:** Vue SSR for SEO-critical pages (landing, marketplace)
- **SPA:** Client-side routing for app interface
- **3D Rendering:** Three.js + TresJS + Live2D SDK
- **UI Library:** Reka UI + UnoCSS
- **State Management:** Pinia + VueUse
- **Audio:** Web Audio API + MediaBunny
- **PWA:** Workbox + vite-plugin-pwa
- **Hosting:** Cloudflare Workers with static asset serving

#### Backend (Cloudflare Edge - 100%)
- **Workers:** Edge compute (330+ locations)
- **Durable Objects:** Stateful sessions + real-time updates
- **D1:** Primary database (SQLite at edge, replicated globally)
- **Vectorize:** Vector search for AI memory
- **R2:** All file storage (models, avatars, uploads, audio)
- **KV:** Edge caching (sessions, API responses)
- **AI Gateway:** LLM request routing & caching

#### Authentication (Supabase Free Tier)
- **Supabase Auth:** OAuth (Google, GitHub, Discord)
- **JWT Tokens:** Verified in Workers
- **Email/Password:** Password reset flows
- **MAU Limit:** 50,000 (way above 10K user target)
- **Cost:** $0/month (stays within free tier)

#### External Services
- **OpenRouter:** LLM inference (Mistral, GPT-4, etc.)
- **Inworld AI:** Emotional TTS
- **Stripe:** Subscription billing
- **Resend:** Transactional email
- **Sentry:** Error tracking
- **LogTail:** Log aggregation

---

## Frontend Architecture

### Application Structure

```
apps/stage-web/
├── src/
│   ├── main.ts                    # App entry
│   ├── App.vue                    # Root component
│   ├── components/
│   │   ├── Live2D/               # Character rendering
│   │   │   ├── CharacterCanvas.vue
│   │   │   ├── AnimationController.vue
│   │   │   └── ExpressionMapper.vue
│   │   ├── Voice/                # Voice interaction
│   │   │   ├── VoiceSession.vue
│   │   │   ├── AudioVisualizer.vue
│   │   │   └── MicrophoneInput.vue
│   │   ├── Chat/                 # Text chat
│   │   │   ├── ChatHistory.vue
│   │   │   ├── MessageBubble.vue
│   │   │   └── TypingIndicator.vue
│   │   └── Marketplace/          # Creator marketplace
│   │       ├── CharacterGallery.vue
│   │       ├── CharacterCard.vue
│   │       └── CharacterDetail.vue
│   ├── layouts/
│   │   ├── default.vue           # Main app layout
│   │   ├── auth.vue              # Auth pages
│   │   └── creator.vue           # Creator dashboard
│   ├── pages/
│   │   ├── index.vue             # Landing page
│   │   ├── app/
│   │   │   ├── chat.vue          # Main chat interface
│   │   │   ├── voice.vue         # Voice session
│   │   │   └── library.vue       # Character library
│   │   ├── marketplace/
│   │   │   ├── index.vue         # Browse characters
│   │   │   ├── [id].vue          # Character details
│   │   │   └── upload.vue        # Creator upload
│   │   ├── creator/
│   │   │   ├── dashboard.vue     # Creator analytics
│   │   │   ├── upload.vue        # New character
│   │   │   └── earnings.vue      # Revenue tracking
│   │   ├── settings/
│   │   │   ├── profile.vue
│   │   │   ├── billing.vue
│   │   │   └── preferences.vue
│   │   └── auth/
│   │       ├── login.vue
│   │       ├── signup.vue
│   │       └── callback.vue
│   ├── stores/
│   │   ├── auth.ts               # Authentication state
│   │   ├── character.ts          # Active character
│   │   ├── voice.ts              # Voice session
│   │   ├── marketplace.ts        # Marketplace data
│   │   └── subscription.ts       # Billing state
│   ├── composables/
│   │   ├── useLive2D.ts          # Live2D integration
│   │   ├── useVoiceSession.ts    # Voice AI client
│   │   ├── useSupabase.ts        # Supabase client
│   │   ├── useCharacterMemory.ts # Memory retrieval
│   │   └── useMarketplace.ts     # Marketplace API
│   ├── services/
│   │   ├── api.ts                # API client
│   │   ├── live2d-loader.ts      # Model loading
│   │   ├── voice-client.ts       # WebRTC voice
│   │   └── analytics.ts          # Event tracking
│   └── types/
│       ├── character.ts
│       ├── voice.ts
│       ├── marketplace.ts
│       └── api.ts
```

### Key Frontend Features

#### 1. Live2D Character Rendering

```typescript
// composables/useLive2D.ts
import { Live2DModel } from '@proj-airi/unplugin-live2d-sdk'
import * as THREE from 'three'

export function useLive2D(characterId: string) {
  const scene = useThreeScene()
  const model = ref<Live2DModel>()
  const currentExpression = ref<string>('neutral')
  const lipSyncData = ref<Float32Array>()

  async function loadCharacter() {
    // Load model from R2 CDN
    const modelUrl = `${CDN_BASE_URL}/models/${characterId}/model.json`

    model.value = await Live2DModel.load(modelUrl, {
      autoInteract: true,
      autoUpdate: true,
    })

    scene.add(model.value)
  }

  function setExpression(emotion: string, intensity: number) {
    if (!model.value) return

    // Map emotion to Live2D expression
    const expressionMap: Record<string, string> = {
      happy: 'smile',
      sad: 'sad',
      excited: 'excited',
      surprised: 'surprised',
      neutral: 'idle',
    }

    const expression = expressionMap[emotion] || 'idle'
    currentExpression.value = expression

    model.value.internalModel.motionManager.startMotion(
      'expression',
      expression,
      intensity
    )
  }

  function updateLipSync(audioData: Float32Array) {
    if (!model.value) return

    // Update mouth shape based on audio amplitude
    lipSyncData.value = audioData
    const mouthOpenY = calculateMouthOpenness(audioData)

    model.value.internalModel.coreModel.setParameterValueById(
      'ParamMouthOpenY',
      mouthOpenY
    )
  }

  return {
    model,
    currentExpression,
    loadCharacter,
    setExpression,
    updateLipSync,
  }
}
```

#### 2. Voice Session Management

```typescript
// composables/useVoiceSession.ts
import { RealtimeKitClient } from '@/services/voice-client'

export function useVoiceSession(characterId: string) {
  const supabase = useSupabaseClient()
  const { setExpression, updateLipSync } = useLive2D(characterId)

  const session = ref<VoiceSession>()
  const isConnected = ref(false)
  const isListening = ref(false)
  const isSpeaking = ref(false)

  async function startSession() {
    // Get user auth token
    const { data: { session: authSession } } = await supabase.auth.getSession()

    // Create voice session on Cloudflare
    const response = await fetch('/api/voice/session/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authSession?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        characterId,
        userId: authSession?.user.id,
      }),
    })

    const { sessionId, meetingId, authToken, iceServers } = await response.json()

    // Initialize WebRTC client
    const client = new RealtimeKitClient({
      meetingId,
      authToken,
      iceServers,
    })

    // Handle incoming audio
    client.on('audio', (audioBuffer: ArrayBuffer) => {
      isSpeaking.value = true

      // Convert to Float32Array for lip sync
      const audioData = new Float32Array(audioBuffer)
      updateLipSync(audioData)

      // Play audio through speakers
      playAudio(audioBuffer)
    })

    // Handle transcriptions
    client.on('transcription', (text: string) => {
      console.log('User said:', text)
    })

    // Handle character responses with emotion
    client.on('response', ({ text, emotion, intensity }) => {
      console.log('Character responds:', text, 'with emotion:', emotion)
      setExpression(emotion, intensity)
    })

    // Handle session end
    client.on('end', () => {
      isSpeaking.value = false
      isConnected.value = false
    })

    await client.connect()

    session.value = { sessionId, client }
    isConnected.value = true
  }

  async function endSession() {
    if (!session.value) return

    await session.value.client.disconnect()

    // Save conversation history
    await fetch(`/api/voice/session/${session.value.sessionId}/end`, {
      method: 'POST',
    })

    session.value = undefined
    isConnected.value = false
  }

  function toggleListening() {
    if (!session.value) return

    if (isListening.value) {
      session.value.client.stopListening()
    } else {
      session.value.client.startListening()
    }

    isListening.value = !isListening.value
  }

  return {
    session,
    isConnected,
    isListening,
    isSpeaking,
    startSession,
    endSession,
    toggleListening,
  }
}
```

#### 3. Marketplace Integration

```typescript
// composables/useMarketplace.ts
export function useMarketplace() {
  const supabase = useSupabaseClient()

  const characters = ref<MarketplaceCharacter[]>([])
  const isLoading = ref(false)

  async function fetchCharacters(filters?: {
    category?: string
    priceRange?: [number, number]
    sortBy?: 'popular' | 'recent' | 'price'
  }) {
    isLoading.value = true

    try {
      let query = supabase
        .from('marketplace_characters')
        .select(`
          *,
          creator:profiles!creator_id (
            id,
            username,
            avatar_url
          ),
          stats:character_stats (
            downloads,
            rating,
            revenue
          )
        `)

      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.priceRange) {
        query = query
          .gte('price', filters.priceRange[0])
          .lte('price', filters.priceRange[1])
      }

      if (filters?.sortBy === 'popular') {
        query = query.order('stats.downloads', { ascending: false })
      } else if (filters?.sortBy === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else if (filters?.sortBy === 'price') {
        query = query.order('price', { ascending: true })
      }

      const { data, error } = await query

      if (error) throw error

      characters.value = data
    } finally {
      isLoading.value = false
    }
  }

  async function purchaseCharacter(characterId: string) {
    const { data: { session } } = await supabase.auth.getSession()

    // Create Stripe Checkout session
    const response = await fetch('/api/marketplace/purchase', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ characterId }),
    })

    const { checkoutUrl } = await response.json()

    // Redirect to Stripe Checkout
    window.location.href = checkoutUrl
  }

  return {
    characters,
    isLoading,
    fetchCharacters,
    purchaseCharacter,
  }
}
```

### Frontend Performance Optimization

#### Asset Loading Strategy

```typescript
// services/live2d-loader.ts
export class Live2DLoader {
  private cache = new Map<string, Live2DModel>()
  private preloadQueue: string[] = []

  async loadModel(characterId: string): Promise<Live2DModel> {
    // Check cache first
    if (this.cache.has(characterId)) {
      return this.cache.get(characterId)!
    }

    // Load from CDN with progress tracking
    const modelUrl = `${CDN_BASE_URL}/models/${characterId}/model.json`

    const model = await Live2DModel.load(modelUrl, {
      onProgress: (progress) => {
        console.log(`Loading ${characterId}: ${progress}%`)
      },
    })

    // Cache for future use
    this.cache.set(characterId, model)

    return model
  }

  // Preload popular characters in background
  async preloadPopularCharacters(characterIds: string[]) {
    this.preloadQueue = characterIds

    // Load one at a time to avoid overwhelming bandwidth
    for (const id of characterIds) {
      if (!this.cache.has(id)) {
        await this.loadModel(id)
      }
    }
  }

  // Clear cache to free memory
  clearCache() {
    for (const [id, model] of this.cache) {
      model.destroy()
    }
    this.cache.clear()
  }
}
```

#### Code Splitting

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'three-vendor': ['three', '@tresjs/core', '@tresjs/cientos'],
          'live2d-vendor': ['@proj-airi/unplugin-live2d-sdk'],
          'ui-vendor': ['reka-ui', '@vueuse/core'],

          // Feature chunks (lazy loaded)
          'marketplace': [
            './src/pages/marketplace/index.vue',
            './src/composables/useMarketplace.ts',
          ],
          'creator-dashboard': [
            './src/pages/creator/dashboard.vue',
            './src/composables/useCreatorAnalytics.ts',
          ],
        },
      },
    },
  },
})
```

---

## Backend Services Architecture

### Cloudflare Workers Structure

```
apps/workers/
├── frontend/                 # Frontend SSR + Static Assets
│   ├── src/
│   │   ├── index.ts         # Main entry point
│   │   ├── server/
│   │   │   ├── ssr.ts       # Vue SSR renderer
│   │   │   ├── static.ts    # Static asset handler
│   │   │   └── routes.ts    # Route matching
│   │   ├── client/          # Client-side code (built by Vite)
│   │   │   └── entry-client.ts
│   │   └── assets.ts        # R2 asset proxy
│   ├── wrangler.toml
│   └── vite.config.ts       # SSR build config
├── api-gateway/              # Main API router
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── routes/
│   │   │   ├── auth.ts      # Auth endpoints
│   │   │   ├── characters.ts
│   │   │   ├── marketplace.ts
│   │   │   └── subscriptions.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts      # Verify Supabase JWT
│   │   │   ├── cors.ts
│   │   │   ├── ratelimit.ts
│   │   │   └── logging.ts
│   │   └── lib/
│   │       ├── supabase.ts
│   │       └── stripe.ts
│   └── wrangler.toml
├── voice-agent/              # Voice AI (from existing plan)
│   ├── src/
│   │   ├── index.ts
│   │   ├── agent.ts         # RealtimeAgent
│   │   ├── session.ts       # Durable Object
│   │   ├── handlers/
│   │   │   ├── stt.ts
│   │   │   ├── text.ts
│   │   │   └── tts.ts
│   │   └── lib/
│   │       ├── memory.ts
│   │       └── relationship.ts
│   └── wrangler.toml
├── marketplace/              # Marketplace worker
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── browse.ts
│   │   │   ├── purchase.ts
│   │   │   ├── upload.ts
│   │   │   └── stats.ts
│   │   ├── lib/
│   │   │   ├── asset-processing.ts
│   │   │   ├── content-moderation.ts
│   │   │   └── revenue-split.ts
│   │   └── validators/
│   │       ├── model-schema.ts
│   │       └── personality-schema.ts
│   └── wrangler.toml
├── webhooks/                 # External service webhooks
│   ├── src/
│   │   ├── stripe.ts        # Payment events
│   │   └── resend.ts        # Email events
│   └── wrangler.toml
└── cron/                     # Scheduled tasks
    ├── src/
    │   ├── analytics.ts     # Daily analytics
    │   ├── cleanup.ts       # Cache cleanup
    │   └── notifications.ts # User notifications
    └── wrangler.toml
```

### Frontend Worker (SSR + Static Assets)

```typescript
// apps/workers/frontend/src/index.ts
import { createServer } from './server/ssr'
import { serveStatic } from './server/static'
import { proxyAssets } from './assets'

type Env = {
  ASSETS: R2Bucket
  KV: KVNamespace
  ENVIRONMENT: 'development' | 'staging' | 'production'
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // 1. Serve static build assets (JS, CSS, images) - Cached at edge
    if (url.pathname.startsWith('/assets/')) {
      return serveStatic(request, env, ctx)
    }

    // 2. Proxy Live2D models and character assets from R2
    if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/characters/')) {
      return proxyAssets(request, env, ctx)
    }

    // 3. API routes go to API Gateway Worker (via Service Binding)
    if (url.pathname.startsWith('/api/')) {
      return env.API_GATEWAY.fetch(request)
    }

    // 4. SSR for SEO-critical pages (landing, marketplace, character details)
    const ssrRoutes = ['/', '/marketplace', '/marketplace/*', '/characters/*']
    const shouldSSR = ssrRoutes.some(route => {
      if (route.endsWith('*')) {
        return url.pathname.startsWith(route.slice(0, -1))
      }
      return url.pathname === route
    })

    if (shouldSSR) {
      return createServer(env).render(request)
    }

    // 5. SPA fallback - Serve index.html for client-side routing
    return serveStatic(new Request(new URL('/index.html', request.url)), env, ctx)
  },
}
```

#### SSR Renderer

```typescript
// apps/workers/frontend/src/server/ssr.ts
import { renderToString } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import App from '../../../stage-web/src/App.vue'
import { routes } from '../../../stage-web/src/router/routes'

export function createServer(env: Env) {
  return {
    async render(request: Request): Promise<Response> {
      const url = new URL(request.url)

      // Create Vue SSR app
      const app = createSSRApp(App)
      const router = createRouter({
        history: createMemoryHistory(),
        routes,
      })
      const pinia = createPinia()

      app.use(router)
      app.use(pinia)

      // Navigate to the requested route
      await router.push(url.pathname)
      await router.isReady()

      // Render app to HTML string
      const appHtml = await renderToString(app)

      // Get head tags (title, meta)
      const { headTags, bodyTags } = await getMetaTags(url.pathname)

      // Get preload state from Pinia
      const state = JSON.stringify(pinia.state.value)

      // Construct full HTML
      const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${headTags}
    <link rel="stylesheet" href="/assets/style.css">
  </head>
  <body>
    <div id="app">${appHtml}</div>
    <script>
      window.__INITIAL_STATE__ = ${state}
    </script>
    <script type="module" src="/assets/client.js"></script>
    ${bodyTags}
  </body>
</html>
      `.trim()

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=300', // 5 min cache
        },
      })
    },
  }
}

async function getMetaTags(path: string) {
  // Customize meta tags per route
  const metaTags: Record<string, { title: string; description: string; image?: string }> = {
    '/': {
      title: 'MiraiChat - AI Companions with Voice & Live2D',
      description: 'Experience natural conversations with AI companions featuring Live2D characters and real-time voice interaction.',
      image: 'https://cdn.miraichat.app/og-home.png',
    },
    '/marketplace': {
      title: 'Character Marketplace - MiraiChat',
      description: 'Discover and purchase unique AI companion characters created by talented artists.',
      image: 'https://cdn.miraichat.app/og-marketplace.png',
    },
  }

  const meta = metaTags[path] || metaTags['/']

  const headTags = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    ${meta.image ? `<meta property="og:image" content="${meta.image}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
  `

  return { headTags, bodyTags: '' }
}
```

#### Static Asset Handler

```typescript
// apps/workers/frontend/src/server/static.ts
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

export async function serveStatic(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Serve from KV Assets (build output)
    return await getAssetFromKV(
      {
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
        cacheControl: {
          browserTTL: 31536000, // 1 year
          edgeTTL: 31536000,
          bypassCache: false,
        },
      }
    )
  } catch (e) {
    return new Response('Not Found', { status: 404 })
  }
}
```

#### R2 Asset Proxy

```typescript
// apps/workers/frontend/src/assets.ts
export async function proxyAssets(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const key = url.pathname.slice(1) // Remove leading slash

  // Check cache first
  const cache = caches.default
  let response = await cache.match(request)

  if (response) {
    return response
  }

  // Fetch from R2
  const object = await env.ASSETS.get(key)

  if (!object) {
    return new Response('Asset Not Found', { status: 404 })
  }

  // Determine cache duration based on asset type
  const cacheControl = getCacheControl(key)

  response = new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': cacheControl,
      'ETag': object.httpEtadata?.etag || '',
      'Access-Control-Allow-Origin': '*',
    },
  })

  // Cache in Cloudflare CDN
  ctx.waitUntil(cache.put(request, response.clone()))

  return response
}

function getCacheControl(key: string): string {
  if (key.startsWith('models/')) {
    return 'public, max-age=31536000, immutable' // 1 year
  } else if (key.startsWith('characters/')) {
    return 'public, max-age=604800' // 1 week
  } else {
    return 'public, max-age=3600' // 1 hour
  }
}
```

#### Vite SSR Build Configuration

```typescript
// apps/workers/frontend/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    ssr: true,
    rollupOptions: {
      input: {
        client: './src/client/entry-client.ts',
        server: './src/server/entry-server.ts',
      },
      output: {
        format: 'esm',
      },
    },
  },
  ssr: {
    target: 'webworker',
    noExternal: ['vue', 'vue-router', 'pinia'],
  },
})
```

#### wrangler.toml Configuration

```toml
# apps/workers/frontend/wrangler.toml
name = "mirai-frontend"
main = "src/index.ts"
compatibility_date = "2025-01-01"

# R2 bucket for assets
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "mirai-assets"

# KV for static content
[[kv_namespaces]]
binding = "__STATIC_CONTENT"
id = "xxx"

# Service binding to API Gateway
[[services]]
binding = "API_GATEWAY"
service = "mirai-api-gateway"

# Environment
[vars]
ENVIRONMENT = "production"

# Assets configuration
[site]
bucket = "./dist/client"

# Workers AI (if needed for edge features)
[ai]
binding = "AI"
```

### API Gateway Worker

```typescript
// apps/workers/api-gateway/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createSupabaseClient } from './lib/supabase'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/ratelimit'
import characterRoutes from './routes/characters'
import marketplaceRoutes from './routes/marketplace'
import subscriptionRoutes from './routes/subscriptions'

type Env = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  DB: D1Database
  KV: KVNamespace
  STRIPE_SECRET_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', cors())
app.use('*', rateLimitMiddleware)

// Public routes
app.get('/health', (c) => c.json({ status: 'ok' }))

// Protected routes
app.use('/api/*', authMiddleware)
app.route('/api/characters', characterRoutes)
app.route('/api/marketplace', marketplaceRoutes)
app.route('/api/subscriptions', subscriptionRoutes)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
}
```

### Authentication Middleware

```typescript
// apps/workers/api-gateway/src/middleware/auth.ts
import { createSupabaseClient } from '../lib/supabase'
import { Context, Next } from 'hono'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }

  const token = authHeader.substring(7)

  const supabase = createSupabaseClient(c.env)

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  // Attach user to context
  c.set('user', user)
  c.set('supabase', supabase)

  await next()
}
```

### Rate Limiting Middleware

```typescript
// apps/workers/api-gateway/src/middleware/ratelimit.ts
import { Context, Next } from 'hono'

const RATE_LIMITS = {
  anonymous: { requests: 10, window: 60 }, // 10 req/min
  authenticated: { requests: 100, window: 60 }, // 100 req/min
  premium: { requests: 500, window: 60 }, // 500 req/min
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  const user = c.get('user')

  // Determine rate limit tier
  let limit = RATE_LIMITS.anonymous
  if (user?.app_metadata?.subscription === 'premium') {
    limit = RATE_LIMITS.premium
  } else if (user) {
    limit = RATE_LIMITS.authenticated
  }

  const key = `ratelimit:${user?.id || ip}`
  const count = await c.env.KV.get(key)

  if (count && parseInt(count) >= limit.requests) {
    return c.json(
      { error: 'Rate limit exceeded' },
      429,
      {
        'X-RateLimit-Limit': limit.requests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + limit.window * 1000).toString(),
      }
    )
  }

  // Increment counter
  await c.env.KV.put(
    key,
    (parseInt(count || '0') + 1).toString(),
    { expirationTtl: limit.window }
  )

  await next()
}
```

---

## Authentication & Authorization

### Supabase Auth Integration

```typescript
// Frontend: composables/useAuth.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function useAuth() {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)

  async function signIn(provider: 'google' | 'github' | 'discord') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error
    return data
  }

  async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    user.value = data.user
    session.value = data.session
  }

  async function signUp(email: string, password: string, metadata: {
    username: string
    display_name: string
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })

    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    session.value = null
  }

  // Listen to auth state changes
  supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession
    user.value = newSession?.user ?? null
  })

  return {
    user,
    session,
    signIn,
    signInWithEmail,
    signUp,
    signOut,
  }
}
```

### Worker-Enforced Authorization

**Instead of Row Level Security (RLS), we enforce authorization in Workers:**

```typescript
// apps/workers/api-gateway/src/middleware/auth.ts
import { createClient } from '@supabase/supabase-js'
import { Context, Next } from 'hono'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }

  const token = authHeader.substring(7)

  // Verify JWT with Supabase Auth (free tier)
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  // Attach user to context for downstream use
  c.set('userId', user.id)
  c.set('userEmail', user.email)
  c.set('userMetadata', user.user_metadata)

  await next()
}

// Helper: Enforce ownership in queries
export async function enforceOwnership<T>(
  query: D1PreparedStatement,
  userId: string,
  errorMsg: string = 'Access denied'
): Promise<T> {
  const result = await query.bind(userId).first()

  if (!result) {
    throw new Error(errorMsg)
  }

  return result as T
}
```

### Authorization Patterns

#### 1. User-Scoped Queries (Most Common)

```typescript
// apps/workers/api-gateway/src/routes/characters.ts
import { authMiddleware, enforceOwnership } from '../middleware/auth'

app.get('/characters', authMiddleware, async (c) => {
  const userId = c.get('userId')

  // Automatically scope to user
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM user_characters WHERE user_id = ?
  `).bind(userId).all()

  return c.json({ characters: results })
})

app.get('/characters/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const characterId = c.req.param('id')

  // Verify ownership before returning
  const character = await enforceOwnership(
    c.env.DB.prepare(`
      SELECT * FROM user_characters
      WHERE id = ? AND user_id = ?
    `).bind(characterId, userId),
    userId,
    'Character not found or access denied'
  )

  return c.json({ character })
})
```

#### 2. Creator-Only Routes

```typescript
app.post('/marketplace/upload', authMiddleware, async (c) => {
  const userId = c.get('userId')

  // Check if user is a creator
  const profile = await c.env.DB.prepare(`
    SELECT is_creator FROM profiles WHERE id = ?
  `).bind(userId).first()

  if (!profile?.is_creator) {
    return c.json({ error: 'Creator account required' }, 403)
  }

  // Proceed with upload...
})
```

#### 3. Public Read, Owner Write

```typescript
// Marketplace listings - public read
app.get('/marketplace', async (c) => {
  // No auth required for browsing
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM marketplace_characters
    WHERE status = 'published'
  `).all()

  return c.json({ characters: results })
})

// Update listing - creator only
app.put('/marketplace/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const characterId = c.req.param('id')

  // Verify creator owns this listing
  const character = await c.env.DB.prepare(`
    SELECT * FROM marketplace_characters
    WHERE id = ? AND creator_id = ?
  `).bind(characterId, userId).first()

  if (!character) {
    return c.json({ error: 'Access denied' }, 403)
  }

  // Proceed with update...
})
```

#### 4. Subscription Tier Checks

```typescript
// Helper: Check subscription tier
async function requireTier(
  c: Context,
  requiredTier: 'free' | 'premium' | 'enterprise'
) {
  const userId = c.get('userId')

  const subscription = await c.env.DB.prepare(`
    SELECT tier FROM subscriptions
    WHERE user_id = ? AND status = 'active'
  `).bind(userId).first()

  const tierLevel = { free: 0, premium: 1, enterprise: 2 }
  const userLevel = tierLevel[subscription?.tier || 'free']
  const requiredLevel = tierLevel[requiredTier]

  if (userLevel < requiredLevel) {
    throw new Error(`${requiredTier} subscription required`)
  }
}

// Usage
app.post('/voice/session', authMiddleware, async (c) => {
  await requireTier(c, 'premium') // Voice requires premium

  // Create voice session...
})
```

### Security Best Practices

1. **Always bind parameters** - Prevent SQL injection
2. **Verify ownership explicitly** - Check user_id in WHERE clause
3. **Use middleware consistently** - Apply authMiddleware to protected routes
4. **Fail closed** - Return 403/404 instead of exposing data existence
5. **Log auth failures** - Track suspicious activity

```typescript
// Good - Explicit ownership check
const result = await db.prepare(`
  SELECT * FROM user_data WHERE user_id = ? AND id = ?
`).bind(userId, resourceId).first()

// Bad - Missing ownership check (security vulnerability!)
const result = await db.prepare(`
  SELECT * FROM user_data WHERE id = ?
`).bind(resourceId).first()
```

---

## Database Schema Design

**⚠️ UNIFIED SCHEMA:** The complete, production-ready database schema is now in:
**→ `unified-database-schema.md`**

This unified schema integrates:
- ✅ Marketplace features (characters, purchases, reviews)
- ✅ Voice AI features (sessions, emotions, relationships)
- ✅ Analytics & metrics
- ✅ Scalability optimizations (composite indexes, archival)
- ✅ 10k+ user capacity

**See also:** `schema-improvements-summary.md` for migration guide and improvements summary.

### Quick Reference: Key Tables

The unified schema contains **30+ tables** organized into these categories:

**Core Tables:**
- `profiles` - User accounts (from Supabase Auth)
- `creator_profiles` - Marketplace seller profiles
- `subscriptions` - User subscription tiers & billing

**Character System:**
- `marketplace_characters` - Character templates for sale
- `user_characters` - User-owned character instances (with real-time state)

**Relationship & Emotions:**
- `relationships` - Affection, trust, level, milestones
- `emotional_states` - Real-time emotion tracking

**Conversations & Memory:**
- `conversation_sessions` - Voice or text sessions
- `conversations` - Individual messages
- `memory_highlights` - Important memories (+ Vectorize)

**Voice AI:**
- `voice_sessions` - Real-time voice session state (Durable Objects)
- `voice_session_events` - Granular event tracking
- `voice_quality_metrics` - Latency & performance metrics

**Analytics:**
- `character_analytics` - Character performance
- `user_engagement_metrics` - User retention & activity
- `platform_analytics` - System-wide metrics

**Full Details:** See `unified-database-schema.md` for complete table definitions, indexes, and examples.

### Cloudflare D1 Schema (Primary Database)

**D1 Database:** `mirai-production` (primary database, globally replicated)

```sql
-- =====================================================
-- USER MANAGEMENT
-- =====================================================

-- Profiles (id comes from Supabase Auth user.id)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- Supabase Auth user.id
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT, -- R2 URL: r2://avatars/{user_id}/avatar.jpg
  bio TEXT,
  is_creator INTEGER DEFAULT 0, -- SQLite boolean (0/1)
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL  -- Unix timestamp
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_creator ON profiles(is_creator) WHERE is_creator = 1;

-- Creator profiles (for marketplace sellers)
CREATE TABLE creator_profiles (
  id TEXT PRIMARY KEY, -- Same as profiles.id
  creator_name TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0, -- SQLite uses REAL for decimals
  payout_email TEXT,
  stripe_account_id TEXT,
  created_at INTEGER NOT NULL
);

-- =====================================================
-- CHARACTERS & COMPANIONS
-- =====================================================

-- Base characters (marketplace listings)
CREATE TABLE marketplace_characters (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  creator_id TEXT NOT NULL, -- References profiles(id)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'anime', 'realistic', 'fantasy'
  tags TEXT, -- JSON array: ["tag1", "tag2"]

  -- Pricing
  price REAL NOT NULL, -- SQLite uses REAL for decimals, 0 for free characters
  currency TEXT DEFAULT 'USD',

  -- Assets
  model_url TEXT NOT NULL, -- R2 URL to Live2D model
  thumbnail_url TEXT NOT NULL,
  preview_images TEXT, -- JSON array: ["url1", "url2"]

  -- Personality
  personality_data TEXT NOT NULL, -- JSON object: personality traits, behaviors
  voice_config TEXT, -- JSON object: TTS configuration

  -- Metadata
  version TEXT DEFAULT '1.0.0',
  file_size_mb REAL,
  poly_count INTEGER,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'rejected', 'archived')),
  moderation_notes TEXT,

  -- Stats (denormalized for performance)
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL, -- Unix timestamp
  published_at INTEGER -- Unix timestamp
);

CREATE INDEX idx_marketplace_category ON marketplace_characters(category);
CREATE INDEX idx_marketplace_creator ON marketplace_characters(creator_id);
CREATE INDEX idx_marketplace_status ON marketplace_characters(status);
CREATE INDEX idx_marketplace_price ON marketplace_characters(price);

-- User-owned characters (purchased or created)
CREATE TABLE user_characters (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References marketplace_characters(id)

  -- Purchase info
  purchase_date INTEGER NOT NULL, -- Unix timestamp
  purchase_price REAL,

  -- User customizations
  custom_name TEXT, -- User can rename character
  custom_personality TEXT, -- JSON object: Override base personality

  -- Relationship state
  relationship_level INTEGER DEFAULT 0,
  affection REAL DEFAULT 0,
  trust REAL DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  last_interaction INTEGER, -- Unix timestamp

  -- Emotional state
  current_mood TEXT DEFAULT 'neutral',
  emotional_state TEXT, -- JSON object

  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL, -- Unix timestamp

  UNIQUE(user_id, character_id)
);

CREATE INDEX idx_user_characters_user ON user_characters(user_id);
CREATE INDEX idx_user_characters_character ON user_characters(character_id);

-- =====================================================
-- CONVERSATIONS & MEMORY
-- =====================================================

-- Conversation sessions
CREATE TABLE conversation_sessions (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References user_characters(id)

  session_type TEXT DEFAULT 'voice' CHECK (session_type IN ('voice', 'text')),

  started_at INTEGER NOT NULL, -- Unix timestamp
  ended_at INTEGER, -- Unix timestamp
  duration_seconds INTEGER,
  message_count INTEGER DEFAULT 0,

  -- Session metadata
  platform TEXT, -- 'web', 'mobile', etc.
  client_version TEXT
);

-- Individual messages
CREATE TABLE conversations (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  session_id TEXT NOT NULL, -- References conversation_sessions(id)
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References user_characters(id)

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Voice-specific
  audio_url TEXT, -- R2 URL if voice message
  transcription TEXT,

  -- Emotion & context
  emotion TEXT,
  emotion_intensity REAL,

  -- Memory importance (for Vectorize storage)
  importance_score REAL,

  created_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_character ON conversations(character_id);
CREATE INDEX idx_conversations_timestamp ON conversations(created_at DESC);

-- Memory highlights (important moments stored separately)
CREATE TABLE memory_highlights (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References user_characters(id)

  content TEXT NOT NULL,
  context TEXT, -- JSON object: Additional metadata
  importance REAL NOT NULL,

  -- Vectorize index reference
  vector_id TEXT UNIQUE,

  created_at INTEGER NOT NULL -- Unix timestamp
);

-- =====================================================
-- MARKETPLACE & TRANSACTIONS
-- =====================================================

-- Purchases
CREATE TABLE purchases (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References marketplace_characters(id)

  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Payment processing
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),

  -- Revenue split (80% creator, 20% platform)
  creator_revenue REAL,
  platform_revenue REAL,

  created_at INTEGER NOT NULL, -- Unix timestamp
  completed_at INTEGER -- Unix timestamp
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_character ON purchases(character_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- Reviews & Ratings
CREATE TABLE character_reviews (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)
  character_id TEXT NOT NULL, -- References marketplace_characters(id)

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,

  -- Moderation
  is_flagged INTEGER DEFAULT 0, -- SQLite boolean (0/1)

  created_at INTEGER NOT NULL, -- Unix timestamp

  UNIQUE(user_id, character_id)
);

-- =====================================================
-- SUBSCRIPTIONS & BILLING
-- =====================================================

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)

  tier TEXT NOT NULL CHECK (tier IN ('free', 'premium', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),

  -- Stripe integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,

  -- Billing
  current_period_start INTEGER, -- Unix timestamp
  current_period_end INTEGER, -- Unix timestamp
  cancel_at INTEGER, -- Unix timestamp

  -- Usage limits
  monthly_voice_minutes_limit INTEGER,
  monthly_voice_minutes_used INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Usage tracking
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  user_id TEXT NOT NULL, -- References profiles(id)

  resource_type TEXT NOT NULL, -- 'voice_minutes', 'api_calls', 'storage_mb'
  amount REAL NOT NULL,

  -- Cost tracking (optional)
  cost_usd REAL,

  created_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_usage_user_resource ON usage_logs(user_id, resource_type);
CREATE INDEX idx_usage_timestamp ON usage_logs(created_at DESC);

-- =====================================================
-- ANALYTICS & METRICS
-- =====================================================

-- Character analytics (aggregated daily)
CREATE TABLE character_analytics (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  character_id TEXT NOT NULL, -- References marketplace_characters(id)
  date INTEGER NOT NULL, -- Unix timestamp (midnight UTC)

  views INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,

  UNIQUE(character_id, date)
);

-- Platform analytics (aggregated daily)
CREATE TABLE platform_analytics (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT
  date INTEGER NOT NULL UNIQUE, -- Unix timestamp (midnight UTC)

  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,

  total_sessions INTEGER DEFAULT 0,
  total_voice_minutes INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  total_revenue REAL DEFAULT 0,
  total_purchases INTEGER DEFAULT 0
);

-- =====================================================
-- CONTENT MODERATION
-- =====================================================

CREATE TABLE moderation_queue (
  id TEXT PRIMARY KEY, -- UUID stored as TEXT

  content_type TEXT NOT NULL, -- 'character', 'review', 'message'
  content_id TEXT NOT NULL,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Automated flags
  auto_flagged INTEGER DEFAULT 0, -- SQLite boolean (0/1)
  flag_reasons TEXT, -- JSON array: ["reason1", "reason2"]

  -- Manual review
  reviewer_id TEXT, -- References profiles(id)
  review_notes TEXT,
  reviewed_at INTEGER, -- Unix timestamp

  created_at INTEGER NOT NULL -- Unix timestamp
);

-- =====================================================
-- APPLICATION-LAYER LOGIC (D1/SQLite has no triggers)
-- =====================================================

-- NOTE: Unlike Postgres, D1 (SQLite) does not support triggers or functions.
-- The following operations must be handled in application code (Workers):

-- 1. Updated_at timestamps:
--    - Explicitly set updated_at = Date.now() in UPDATE queries
--    - Example: UPDATE profiles SET name = ?, updated_at = ? WHERE id = ?

-- 2. Character rating calculation:
--    - After INSERT/UPDATE on character_reviews, run:
--      UPDATE marketplace_characters SET
--        rating = (SELECT AVG(rating) FROM character_reviews WHERE character_id = ?),
--        review_count = (SELECT COUNT(*) FROM character_reviews WHERE character_id = ?)
--      WHERE id = ?

-- 3. Denormalized stats updates:
--    - Use D1 batch() API for transactional updates
--    - Example: await env.DB.batch([query1, query2, query3])
```

---

## Voice AI Infrastructure

*This section references the detailed implementation in `voice-agent.md`*

### Architecture Summary

1. **Cloudflare Realtime Agents** - Voice AI orchestration
2. **Durable Objects** - Stateful session management
3. **Workers AI** - STT (Whisper), emotion detection, embeddings
4. **AI Gateway** - LLM routing to OpenRouter
5. **Inworld TTS** - Emotional voice synthesis
6. **D1 + Vectorize** - Memory and relationship storage

### Key Integration Points

#### Frontend → Voice Agent

```typescript
// Frontend initiates voice session
const { sessionId, meetingId, authToken } = await fetch('/api/voice/session/create', {
  method: 'POST',
  body: JSON.stringify({
    userId: user.id,
    characterId: activeCharacter.id,
  }),
})

// Connect to RealtimeKit
const voiceClient = new RealtimeKitClient({ meetingId, authToken })
await voiceClient.connect()
```

#### Voice Agent → D1 Database

```typescript
// Store conversation in D1 for persistence (already at edge)
async function saveConversation(env: Env, sessionId: string, messages: Message[]) {
  const statements = messages.map((msg) =>
    env.DB.prepare(`
      INSERT INTO conversations (id, session_id, user_id, character_id, role, content, emotion, emotion_intensity, importance_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      msg.id,
      sessionId,
      msg.userId,
      msg.characterId,
      msg.role,
      msg.content,
      msg.emotion,
      msg.emotionIntensity,
      msg.importanceScore,
      msg.timestamp
    )
  )

  // Use batch API for atomic insert
  const results = await env.DB.batch(statements)

  if (results.some(r => !r.success)) {
    console.error('D1 batch insert error:', results.filter(r => !r.success))
  }
}
```

---

## Asset Management & CDN

### R2 Bucket Structure

```
mirai-assets/
├── models/                    # Live2D character models
│   ├── {character_id}/
│   │   ├── model.json        # Live2D model definition
│   │   ├── textures/
│   │   │   ├── texture_00.png
│   │   │   └── texture_01.png
│   │   ├── motions/
│   │   │   ├── idle.motion3.json
│   │   │   ├── happy.motion3.json
│   │   │   └── sad.motion3.json
│   │   └── expressions/
│   │       ├── smile.exp3.json
│   │       └── surprised.exp3.json
├── thumbnails/               # Character preview images
│   └── {character_id}/
│       ├── main.webp
│       ├── preview_1.webp
│       └── preview_2.webp
├── audio/                    # Cached TTS audio
│   └── {character_id}/
│       └── {hash}.mp3
└── uploads/                  # User/creator uploads (temp)
    └── {user_id}/
        └── {upload_id}/
```

### CDN Configuration

```typescript
// apps/workers/cdn/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const key = url.pathname.slice(1) // Remove leading slash

    // Check cache first
    const cache = caches.default
    let response = await cache.match(request)

    if (response) {
      return response
    }

    // Fetch from R2
    const object = await env.ASSETS.get(key)

    if (!object) {
      return new Response('Not Found', { status: 404 })
    }

    // Determine cache duration based on asset type
    const cacheControl = getCacheControl(key)

    response = new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': cacheControl,
        'ETag': object.httpEtadata?.etag || '',
        'Access-Control-Allow-Origin': '*',
      },
    })

    // Cache in Cloudflare CDN
    ctx.waitUntil(cache.put(request, response.clone()))

    return response
  },
}

function getCacheControl(key: string): string {
  if (key.startsWith('models/')) {
    return 'public, max-age=31536000, immutable' // 1 year
  } else if (key.startsWith('thumbnails/')) {
    return 'public, max-age=604800' // 1 week
  } else if (key.startsWith('audio/')) {
    return 'public, max-age=86400' // 1 day
  } else {
    return 'public, max-age=3600' // 1 hour
  }
}
```

### Asset Upload Worker

```typescript
// apps/workers/marketplace/src/routes/upload.ts
import { Hono } from 'hono'
import { validateLive2DModel } from '../validators/model-schema'

const app = new Hono<{ Bindings: Env }>()

app.post('/upload/model', async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()

  const modelFile = formData.get('model') as File
  const textureFiles = formData.getAll('textures') as File[]
  const motionFiles = formData.getAll('motions') as File[]

  // Validate model structure
  const modelData = JSON.parse(await modelFile.text())
  const validation = validateLive2DModel(modelData)

  if (!validation.success) {
    return c.json({ error: 'Invalid model', details: validation.errors }, 400)
  }

  // Generate unique character ID
  const characterId = crypto.randomUUID()

  // Upload to R2 with progress tracking
  const uploads = [
    {
      key: `models/${characterId}/model.json`,
      file: modelFile,
    },
    ...textureFiles.map((file, i) => ({
      key: `models/${characterId}/textures/texture_${i.toString().padStart(2, '0')}.png`,
      file,
    })),
    ...motionFiles.map((file) => ({
      key: `models/${characterId}/motions/${file.name}`,
      file,
    })),
  ]

  for (const { key, file } of uploads) {
    await c.env.ASSETS.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type,
      },
    })
  }

  // Store metadata in Supabase
  const supabase = c.get('supabase')
  const { data, error } = await supabase
    .from('marketplace_characters')
    .insert({
      id: characterId,
      creator_id: user.id,
      name: formData.get('name'),
      description: formData.get('description'),
      category: formData.get('category'),
      price: parseFloat(formData.get('price') as string),
      model_url: `${c.env.CDN_BASE_URL}/models/${characterId}/model.json`,
      personality_data: JSON.parse(formData.get('personality') as string),
      status: 'review', // Requires moderation
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return c.json({ error: 'Failed to create character' }, 500)
  }

  return c.json({
    success: true,
    characterId,
    character: data,
  })
})

export default app
```

---

## Marketplace System

### Content Moderation Pipeline

```typescript
// apps/workers/marketplace/src/lib/content-moderation.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ModerationResult {
  approved: boolean
  flags: string[]
  confidence: number
  reason?: string
}

export async function moderateCharacterContent(
  characterData: {
    name: string
    description: string
    personalityData: any
  }
): Promise<ModerationResult> {
  const prompt = `You are a content moderator for an AI companion platform. Review the following character submission and determine if it violates our policies:

POLICIES:
- No explicit sexual content
- No violence or illegal activities
- No impersonation of real people
- No hate speech or discrimination
- Characters should be appropriate for ages 13+

CHARACTER SUBMISSION:
Name: ${characterData.name}
Description: ${characterData.description}
Personality: ${JSON.stringify(characterData.personalityData, null, 2)}

Respond in JSON format:
{
  "approved": boolean,
  "flags": ["flag1", "flag2"],
  "confidence": 0.0-1.0,
  "reason": "explanation if rejected"
}`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [
      { role: 'user', content: prompt },
    ],
  })

  const response = JSON.parse(message.content[0].text)

  return {
    approved: response.approved,
    flags: response.flags || [],
    confidence: response.confidence,
    reason: response.reason,
  }
}
```

### Revenue Split & Payouts

```typescript
// apps/workers/marketplace/src/lib/revenue-split.ts
const PLATFORM_FEE = 0.20 // 20%
const CREATOR_SHARE = 0.80 // 80%

export async function processPurchase(
  characterId: string,
  amount: number,
  userId: string,
  env: Env
) {
  const creatorRevenue = amount * CREATOR_SHARE
  const platformRevenue = amount * PLATFORM_FEE

  // Get character creator
  const supabase = createSupabaseClient(env)
  const { data: character } = await supabase
    .from('marketplace_characters')
    .select('creator_id')
    .eq('id', characterId)
    .single()

  // Create purchase record
  const { data: purchase } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      character_id: characterId,
      amount,
      creator_revenue: creatorRevenue,
      platform_revenue: platformRevenue,
      status: 'completed',
    })
    .select()
    .single()

  // Update creator totals
  await supabase.rpc('increment_creator_revenue', {
    creator_id: character.creator_id,
    amount: creatorRevenue,
  })

  // Schedule payout (processed monthly via cron)
  await env.PAYOUT_QUEUE.send({
    creatorId: character.creator_id,
    amount: creatorRevenue,
    purchaseId: purchase.id,
  })

  return purchase
}
```

### Search & Discovery

```typescript
// apps/workers/api-gateway/src/routes/marketplace.ts
app.get('/browse', async (c) => {
  const {
    category,
    minPrice,
    maxPrice,
    sortBy = 'popular',
    page = 1,
    limit = 20,
  } = c.req.query()

  const supabase = c.get('supabase')

  let query = supabase
    .from('marketplace_characters')
    .select(`
      *,
      creator:profiles!creator_id (
        username,
        display_name,
        avatar_url
      )
    `, { count: 'exact' })
    .eq('status', 'published')

  if (category) {
    query = query.eq('category', category)
  }

  if (minPrice) {
    query = query.gte('price', parseFloat(minPrice))
  }

  if (maxPrice) {
    query = query.lte('price', parseFloat(maxPrice))
  }

  // Sorting
  if (sortBy === 'popular') {
    query = query.order('downloads', { ascending: false })
  } else if (sortBy === 'recent') {
    query = query.order('published_at', { ascending: false })
  } else if (sortBy === 'rating') {
    query = query.order('rating', { ascending: false })
  } else if (sortBy === 'price-low') {
    query = query.order('price', { ascending: true })
  } else if (sortBy === 'price-high') {
    query = query.order('price', { ascending: false })
  }

  // Pagination
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({
    characters: data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  })
})
```

---

## Payment & Billing

### Stripe Integration

```typescript
// apps/workers/api-gateway/src/routes/subscriptions.ts
import Stripe from 'stripe'

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

app.post('/subscribe', async (c) => {
  const user = c.get('user')
  const { tier } = await c.req.json() // 'premium' or 'enterprise'

  // Get or create Stripe customer
  let customerId = user.user_metadata?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
      },
    })
    customerId = customer.id

    // Save customer ID to Supabase
    const supabase = c.get('supabase')
    await supabase.auth.updateUser({
      data: { stripe_customer_id: customerId },
    })
  }

  // Create checkout session
  const priceId = tier === 'premium'
    ? env.STRIPE_PREMIUM_PRICE_ID
    : env.STRIPE_ENTERPRISE_PRICE_ID

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${env.APP_URL}/settings/billing?success=true`,
    cancel_url: `${env.APP_URL}/settings/billing?cancelled=true`,
    metadata: {
      user_id: user.id,
      tier,
    },
  })

  return c.json({ checkoutUrl: session.url })
})

app.post('/cancel-subscription', async (c) => {
  const user = c.get('user')
  const supabase = c.get('supabase')

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!subscription?.stripe_subscription_id) {
    return c.json({ error: 'No active subscription' }, 404)
  }

  // Cancel at period end
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  // Update in database
  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)

  return c.json({ success: true })
})
```

### Webhook Handler

```typescript
// apps/workers/webhooks/src/stripe.ts
export default {
  async fetch(request: Request, env: Env) {
    const sig = request.headers.get('stripe-signature')!
    const body = await request.text()

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Create subscription record in D1
        await env.DB.prepare(`
          INSERT INTO subscriptions (id, user_id, tier, stripe_subscription_id, stripe_customer_id, status, current_period_start, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          session.metadata.user_id,
          session.metadata.tier,
          session.subscription,
          session.customer,
          'active',
          session.created, // Unix timestamp
          Date.now(),
          Date.now()
        ).run()
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Update subscription status in D1
        await env.DB.prepare(`
          UPDATE subscriptions
          SET status = ?, current_period_start = ?, current_period_end = ?, updated_at = ?
          WHERE stripe_subscription_id = ?
        `).bind(
          subscription.status,
          subscription.current_period_start, // Unix timestamp
          subscription.current_period_end, // Unix timestamp
          Date.now(),
          subscription.id
        ).run()
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Mark as cancelled in D1
        await env.DB.prepare(`
          UPDATE subscriptions
          SET status = ?, updated_at = ?
          WHERE stripe_subscription_id = ?
        `).bind('cancelled', Date.now(), subscription.id).run()
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        // Update to past_due in D1
        await env.DB.prepare(`
          UPDATE subscriptions
          SET status = ?, updated_at = ?
          WHERE stripe_subscription_id = ?
        `).bind('past_due', Date.now(), invoice.subscription).run()
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  },
}
```

### Usage Metering

```typescript
// Track voice minutes usage
export async function trackVoiceUsage(
  userId: string,
  durationSeconds: number,
  env: Env
) {
  const minutes = Math.ceil(durationSeconds / 60)

  // Log usage in D1
  await env.DB.prepare(`
    INSERT INTO usage_logs (id, user_id, resource_type, amount, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, 'voice_minutes', minutes, Date.now()).run()

  // Get current subscription usage
  const subscription = await env.DB.prepare(`
    SELECT monthly_voice_minutes_used, monthly_voice_minutes_limit
    FROM subscriptions
    WHERE user_id = ?
  `).bind(userId).first<{ monthly_voice_minutes_used: number; monthly_voice_minutes_limit: number }>()

  const newUsage = (subscription?.monthly_voice_minutes_used || 0) + minutes

  // Update subscription usage
  await env.DB.prepare(`
    UPDATE subscriptions
    SET monthly_voice_minutes_used = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(newUsage, Date.now(), userId).run()

  // Check if limit exceeded
  if (newUsage >= (subscription?.monthly_voice_minutes_limit || Infinity)) {
    // Trigger upgrade prompt or suspend service
    await env.NOTIFICATIONS_QUEUE.send({
      type: 'usage_limit_reached',
      userId,
    })
  }

  return { usage: newUsage, limit: subscription?.monthly_voice_minutes_limit }
}
```

---

## Monitoring & Observability

### Analytics Engine Setup

```typescript
// apps/workers/analytics/src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const { event, properties } = await request.json()

    // Write to Cloudflare Analytics Engine
    await env.ANALYTICS.writeDataPoint({
      // Indexes (for filtering)
      indexes: [
        properties.userId || 'anonymous',
        properties.characterId || '',
        event,
      ],
      // Blobs (string values)
      blobs: [
        properties.platform || 'web',
        properties.sessionId || '',
      ],
      // Doubles (numeric values)
      doubles: [
        properties.duration || 0,
        properties.messageCount || 0,
        Date.now(),
      ],
    })

    return new Response('OK')
  },
}
```

### Error Tracking with Sentry

```typescript
// Frontend: main.ts
import * as Sentry from '@sentry/vue'

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.vueRouterInstrumentation(router),
    }),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
```

```typescript
// Worker: error handling
export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handleRequest(request, env)
    } catch (error) {
      // Log to Sentry
      await fetch('https://sentry.io/api/...', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SENTRY_DSN}`,
        },
        body: JSON.stringify({
          exception: {
            values: [{
              type: error.name,
              value: error.message,
              stacktrace: { frames: parseStackTrace(error.stack) },
            }],
          },
          request: {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers),
          },
          environment: env.ENVIRONMENT,
        }),
      })

      return new Response('Internal Server Error', { status: 500 })
    }
  },
}
```

### Performance Monitoring

```typescript
// composables/usePerformanceMonitoring.ts
export function usePerformanceMonitoring() {
  function trackMetric(name: string, value: number, unit: string = 'ms') {
    // Send to analytics
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        event: 'performance_metric',
        properties: {
          name,
          value,
          unit,
          url: window.location.pathname,
        },
      }),
    })

    // Also track in browser Performance API
    performance.mark(`metric:${name}`)
  }

  function measureVoiceLatency() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          trackMetric(entry.name, entry.duration)
        }
      }
    })

    observer.observe({ entryTypes: ['measure'] })

    return {
      start: (label: string) => performance.mark(`${label}-start`),
      end: (label: string) => {
        performance.mark(`${label}-end`)
        performance.measure(
          `voice-latency-${label}`,
          `${label}-start`,
          `${label}-end`
        )
      },
    }
  }

  return {
    trackMetric,
    measureVoiceLatency,
  }
}
```

---

## Security & Compliance

### Content Security Policy

```typescript
// apps/workers/api-gateway/src/middleware/security.ts
export function securityHeaders(c: Context, next: Next) {
  c.header('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self' data:;
    connect-src 'self' https://api.supabase.io https://*.cloudflare.com;
    media-src 'self' blob: https:;
    worker-src 'self' blob:;
    frame-src 'none';
    object-src 'none';
  `.replace(/\s+/g, ' ').trim())

  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')

  return next()
}
```

### Data Encryption

```typescript
// Encrypt sensitive user data before storing
import { subtle } from 'crypto'

async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encodedData = new TextEncoder().encode(data)

  const encrypted = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  )

  return new TextDecoder().decode(decrypted)
}
```

### GDPR Compliance

```typescript
// apps/workers/api-gateway/src/routes/privacy.ts

// Data export (GDPR Article 20)
app.get('/export-data', async (c) => {
  const user = c.get('user')
  const env = c.env

  // Gather all user data from D1
  const [profile, characters, conversations, purchases] = await Promise.all([
    env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(user.id).first(),
    env.DB.prepare('SELECT * FROM user_characters WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT * FROM conversations WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT * FROM purchases WHERE user_id = ?').bind(user.id).all(),
  ])

  const exportData = {
    profile,
    characters: characters.results,
    conversations: conversations.results,
    purchases: purchases.results,
    exportedAt: new Date().toISOString(),
  }

  return c.json(exportData)
})

// Data deletion (GDPR Article 17)
app.delete('/delete-account', async (c) => {
  const user = c.get('user')
  const env = c.env
  const supabase = c.get('supabase')

  // Delete user data from D1
  // Note: Manual cascade since D1 doesn't enforce FK constraints
  await env.DB.batch([
    env.DB.prepare('DELETE FROM conversations WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM conversation_sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM user_characters WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM purchases WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM character_reviews WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM usage_logs WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM memory_highlights WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(user.id),
  ])

  // Delete from Supabase Auth (we still use Supabase for Auth only)
  await supabase.auth.admin.deleteUser(user.id)

  return c.json({ success: true })
})
```

---

## Scaling Strategy

### Load Distribution

```
┌─────────────────────────────────────────────────────┐
│         CLOUDFLARE GLOBAL NETWORK (330+ CITIES)    │
│                                                     │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │  Edge  │  │  Edge  │  │  Edge  │  │  Edge  │   │
│  │ US-East│  │US-West │  │ Europe │  │  Asia  │   │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘   │
└──────┼───────────┼───────────┼───────────┼─────────┘
       │           │           │           │
       │     Geographic Routing (Anycast)  │
       │           │           │           │
       └───────────┴───────────┴───────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
     ┌────▼─────┐          ┌─────▼────┐
     │ Supabase │          │ External │
     │Multi-AZ  │          │ Services │
     └──────────┘          └──────────┘
```

### Horizontal Scaling

- **Workers:** Auto-scale based on requests (no configuration needed)
- **Durable Objects:** Scale per user session (isolated instances)
- **D1:** Replicated globally (read replicas at each edge location)
- **R2:** Globally distributed object storage with automatic replication

### Auto-scaling Rules

```typescript
// Example: Dynamic capacity based on load
async function getOptimalWorkerLocation(
  userLocation: { lat: number; lon: number },
  currentLoad: Map<string, number>
): Promise<string> {
  // Calculate latency + load for each datacenter
  const scores = Array.from(DATACENTERS).map((dc) => {
    const latency = calculateLatency(userLocation, dc.location)
    const load = currentLoad.get(dc.id) || 0

    // Weighted score: 70% latency, 30% load
    return {
      datacenter: dc.id,
      score: latency * 0.7 + load * 0.3,
    }
  })

  // Return datacenter with lowest score
  return scores.sort((a, b) => a.score - b.score)[0].datacenter
}
```

### Database Scaling

```sql
-- Partitioning large tables by date
CREATE TABLE conversations_2025_01 PARTITION OF conversations
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE conversations_2025_02 PARTITION OF conversations
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Indexes for common queries
CREATE INDEX idx_conversations_user_date
  ON conversations(user_id, created_at DESC);

CREATE INDEX idx_conversations_character_date
  ON conversations(character_id, created_at DESC);
```

---

## Cost Analysis & Optimization

### Monthly Cost Breakdown (10,000 Active Users)

| Service | Usage | Cost |
|---------|-------|------|
| **Cloudflare Workers** | 50M requests | $5 (includes 10M free) |
| **Durable Objects** | 10K hours | $150 |
| **D1 Database** | 50M rows read, 5M writes | $10 |
| **Vectorize** | 5M queries | $50 |
| **R2 Storage** | 500GB storage, 5TB egress | $100 |
| **Workers AI** | 5M STT + emotion requests | $30 |
| **OpenRouter (LLM)** | 10M tokens | $200 |
| **Inworld TTS** | 5M TTS requests | $900 |
| **Supabase Free** | Auth only (<50K MAU) | $0 |
| **Stripe** | 5,000 transactions @ 2.9% + $0.30 | ~$500 in fees |
| **Sentry** | Error tracking | $26 |
| **Resend** | Transactional email | $20 |
| **Total Infrastructure** | | **~$1,991/month** |

**Revenue Assumptions:**
- 10,000 active users
- 30% premium conversion @ $9.99/month = 3,000 × $9.99 = $29,970
- Marketplace 20% fee on $10,000 creator sales = $2,000
- **Total Monthly Revenue:** ~$31,970
- **Gross Margin:** ~94% ($29,979 profit)

### Cost Optimization Strategies

#### 1. Aggressive Caching

```typescript
// Cache LLM responses for common queries
async function getCachedLLMResponse(
  prompt: string,
  env: Env
): Promise<string | null> {
  const hash = await hashPrompt(prompt)
  const cached = await env.KV.get(`llm:${hash}`)

  if (cached) {
    // Save $0.02 per cached hit
    return cached
  }

  return null
}

async function cacheLLMResponse(
  prompt: string,
  response: string,
  env: Env
): Promise<void> {
  const hash = await hashPrompt(prompt)

  // Cache for 24 hours
  await env.KV.put(`llm:${hash}`, response, {
    expirationTtl: 86400,
  })
}
```

#### 2. Smart TTS Caching

```typescript
// Pre-generate common phrases
const COMMON_PHRASES = [
  'Hello! How are you?',
  'Nice to meet you!',
  'What would you like to talk about?',
  // ... more
]

async function preGenerateCommonPhrases(characterId: string, env: Env) {
  for (const phrase of COMMON_PHRASES) {
    const hash = await hashText(phrase + characterId)
    const exists = await env.R2.head(`audio/${characterId}/${hash}.mp3`)

    if (!exists) {
      const audio = await synthesizeSpeech(phrase, characterId)
      await env.R2.put(`audio/${characterId}/${hash}.mp3`, audio)
    }
  }
}
```

#### 3. Tiered LLM Models

```typescript
// Use smaller models for simple queries
function selectOptimalModel(query: string): string {
  const complexity = calculateComplexity(query)

  if (complexity < 0.3) {
    return 'mistralai/mistral-7b-instruct' // $0.001/1K tokens
  } else if (complexity < 0.7) {
    return 'mistralai/mistral-nemo' // $0.003/1K tokens
  } else {
    return 'anthropic/claude-3.5-sonnet' // $0.015/1K tokens
  }
}
```

---

## Deployment Pipeline

### CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Build frontend (SSR + Client)
        run: |
          # Build client bundle
          pnpm run build --filter=@proj-airi/stage-web
          # Build SSR bundle for Workers
          pnpm run build:ssr --filter=@proj-airi/stage-web
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          VITE_CDN_BASE_URL: ${{ secrets.CDN_BASE_URL }}

      - name: Deploy Frontend Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
          workingDirectory: apps/workers/frontend
        env:
          ENVIRONMENT: production

  deploy-workers:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        worker: [api-gateway, voice-agent, marketplace, webhooks]
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ${{ matrix.worker }}
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
          workingDirectory: apps/workers/${{ matrix.worker }}
          secrets: |
            SUPABASE_URL
            SUPABASE_SERVICE_KEY
            OPENROUTER_API_KEY
            INWORLD_API_KEY
            STRIPE_SECRET_KEY
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          INWORLD_API_KEY: ${{ secrets.INWORLD_API_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}

  migrate-database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Supabase migrations
        run: |
          npx supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

### Environment Management

```bash
# .env.production
VITE_APP_URL=https://miraichat.app
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx
VITE_CDN_BASE_URL=https://cdn.miraichat.app
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Disaster Recovery

### Backup Strategy

```typescript
// apps/workers/cron/src/backup.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Daily backup of D1 to R2
    const d1Backup = await env.DB.backup()

    await env.BACKUPS.put(
      `d1/backup-${new Date().toISOString()}.sqlite`,
      d1Backup
    )

    // Trigger Supabase backup via API
    await fetch('https://api.supabase.com/v1/projects/xxx/backups', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    })

    // Retention: Keep daily backups for 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const oldBackups = await env.BACKUPS.list({ prefix: 'd1/backup-' })

    for (const backup of oldBackups.objects) {
      const backupDate = new Date(backup.key.split('backup-')[1].split('.')[0])
      if (backupDate.getTime() < thirtyDaysAgo) {
        await env.BACKUPS.delete(backup.key)
      }
    }
  },
}
```

### Failover Strategy

```typescript
// Multi-region failover for critical services
const FALLBACK_REGIONS = ['us-east', 'us-west', 'eu-west', 'ap-southeast']

async function fetchWithFailover(
  endpoint: string,
  options: RequestInit,
  env: Env
): Promise<Response> {
  for (const region of FALLBACK_REGIONS) {
    try {
      const response = await fetch(
        `https://${region}.api.miraichat.app${endpoint}`,
        {
          ...options,
          headers: {
            ...options.headers,
            'X-Preferred-Region': region,
          },
        }
      )

      if (response.ok) {
        return response
      }
    } catch (error) {
      console.warn(`Failover: ${region} failed`, error)
      continue
    }
  }

  throw new Error('All regions failed')
}
```

---

## Appendix

### Pricing Tiers

| Feature | Free | Premium ($9.99/mo) | Enterprise (Custom) |
|---------|------|-------------------|---------------------|
| Voice minutes/month | 100 | 1,000 | Unlimited |
| Characters owned | 3 | 20 | Unlimited |
| Marketplace access | ✓ | ✓ | ✓ |
| Custom characters | ✗ | ✓ | ✓ |
| Advanced memory | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✓ | ✓ |
| API access | ✗ | ✗ | ✓ |
| White-label | ✗ | ✗ | ✓ |

### Tech Stack Summary

**Frontend (Cloudflare Workers):**
- Vue 3 + TypeScript + Vite
- Vue SSR for SEO pages
- Live2D + Three.js for 3D rendering
- UnoCSS + Reka UI
- Hosted on Cloudflare Workers (not Pages)

**Backend (Cloudflare Edge):**
- Cloudflare Workers (API, SSR)
- Cloudflare Durable Objects (stateful sessions)
- Cloudflare D1 + Vectorize (data & memory)
- Cloudflare R2 (asset storage)

**Auth & Data:**
- Supabase Auth (Free tier, Auth only)
- Cloudflare D1 (Primary database)
- Cloudflare R2 (File storage)

**AI Services:**
- Workers AI (STT, embeddings)
- OpenRouter (LLM)
- Inworld (TTS)

**Payments & Tools:**
- Stripe
- Sentry
- Resend
- GitHub Actions

---

## Next Steps

1. **Phase 1: Core Infrastructure (Weeks 1-4)**
   - ✅ Setup Cloudflare account + domains
   - ✅ Deploy voice agent worker (from voice-agent.md)
   - ✅ Setup Supabase project + auth
   - ✅ Implement database schema
   - ✅ Deploy frontend to Cloudflare Pages

2. **Phase 2: Marketplace (Weeks 5-8)**
   - ✅ Build character upload system
   - ✅ Implement content moderation
   - ✅ Setup Stripe integration
   - ✅ Create marketplace UI

3. **Phase 3: Polish & Scale (Weeks 9-12)**
   - ✅ Performance optimization
   - ✅ Monitoring & analytics
   - ✅ Load testing (simulate 10K users)
   - ✅ Security audit
   - ✅ Beta launch

4. **Phase 4: Growth (Weeks 13+)**
   - Marketing & user acquisition
   - Creator onboarding
   - Feature expansion based on feedback

---

**Document Status:** Complete ✅
**Ready for Implementation:** Yes
**Estimated Timeline:** 12 weeks to production
**Target Launch:** Q2 2025

# AIRI SaaS Platform - System Architecture Document

**Version:** 1.0  
**Date:** September 1, 2025  
**Status:** Implementation Ready  
**Architect:** System Architecture Team  

---

## Executive Summary

### Project Overview
AIRI SaaS is a subscription-based AI companion platform that enables users to interact with personalized AI assistants through chat, voice, and gaming experiences. The platform supports multi-modal interactions with visual avatars and integrates with popular games like Minecraft and Factorio.

### Technology Stack Summary
- **Frontend**: Next.js 14 with React 18, TailwindCSS, TypeScript
- **Backend**: Vercel Edge Functions, Node.js runtime
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth with OAuth providers
- **Payments**: Stripe with webhook handling
- **Caching**: Upstash Redis for rate limiting and session storage
- **CDN**: CloudFlare for static assets and DDoS protection
- **Voice**: ElevenLabs TTS, OpenAI Whisper STT
- **LLM Providers**: OpenAI, Anthropic, Groq with failover logic

### System Component Overview
The architecture follows a serverless-first, microservices approach with managed services to enable rapid MVP deployment. Core components include the Next.js frontend, API gateway, authentication service, chat engine, gaming orchestration, and subscription management.

### Critical Constraints
- **Timeline**: 30-day MVP launch window
- **Scale**: Support 10K concurrent users at launch
- **Budget**: Optimize for managed services to reduce operational overhead
- **Compliance**: GDPR, COPPA, content moderation requirements

---

## High-Level Architecture Overview

### System Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   CloudFlare CDN                         │
│              (Static Assets, DDoS Protection)           │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                 Next.js Frontend                         │
│              (Vercel Edge Deployment)                    │
│          • React 18 + TypeScript                        │
│          • TailwindCSS + shadcn/ui                      │
│          • WebSocket for real-time chat                 │
│          • Live2D/VRM avatar rendering                  │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                API Gateway (Vercel)                      │
│          • Rate limiting middleware                      │
│          • Authentication middleware                     │
│          • Request/response validation                   │
│          • Error handling & logging                     │
└─────────────────────────────────────────────────────────┘
        │                     │                    │
┌──────────────┐  ┌───────────────────┐  ┌───────────────┐
│   Supabase   │  │    Upstash       │  │    Stripe     │
│   Database   │  │    Redis         │  │   Payments    │
│   + Auth     │  │  (Rate Limits)   │  │   + Webhooks  │
└──────────────┘  └───────────────────┘  └───────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                Background Services                       │
│          • LLM Provider Management                       │
│          • Voice Processing Pipeline                     │
│          • Gaming Server Orchestration                  │
│          • Usage Analytics & Billing                    │
└─────────────────────────────────────────────────────────┘
        │                     │                    │
┌──────────────┐  ┌───────────────────┐  ┌───────────────┐
│  LLM APIs    │  │   Voice APIs      │  │ Game Servers  │
│• OpenAI GPT  │  │• ElevenLabs TTS   │  │• Minecraft    │
│• Anthropic   │  │• OpenAI Whisper   │  │• Factorio     │
│• Groq        │  │• Azure Speech     │  │• Auto-scaling │
└──────────────┘  └───────────────────┘  └───────────────┘
```

### Technology Stack Decisions

#### Frontend Architecture
- **Framework**: Next.js 14 with App Router for optimal performance and SEO
- **State Management**: Zustand for client state, SWR for server state
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: TailwindCSS with CSS-in-JS for dynamic themes
- **Real-time**: Supabase Realtime for WebSocket connections
- **Avatar Rendering**: Three.js for 3D VRM models, Live2D SDK for 2D avatars

#### Backend Architecture
- **Runtime**: Node.js 18+ on Vercel Edge Functions
- **API Pattern**: RESTful APIs with tRPC for type safety
- **Authentication**: Supabase Auth with JWT tokens
- **Validation**: Zod for schema validation across API boundaries
- **Error Handling**: Centralized error middleware with structured logging

#### Database and Storage
- **Primary Database**: Supabase PostgreSQL with automatic backups
- **Caching Layer**: Upstash Redis for rate limiting and session storage
- **File Storage**: Supabase Storage for avatars, Cloudflare R2 for large assets
- **CDN**: CloudFlare for global asset distribution

#### Infrastructure Foundation
- **Hosting**: Vercel for frontend and API routes
- **Monitoring**: Vercel Analytics + Sentry for error tracking
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Environment Management**: Vercel environment variables with encryption

### Deployment Architecture

```
Production Environment:
┌─────────────────────────────────────────────────────────┐
│                    Vercel Production                     │
│  • Domain: app.airi.chat                               │
│  • Edge Functions: Global distribution                  │
│  • Environment: Production secrets                      │
└─────────────────────────────────────────────────────────┘

Staging Environment:
┌─────────────────────────────────────────────────────────┐
│                    Vercel Preview                       │
│  • Domain: staging.airi.chat                           │
│  • Branch: staging                                      │
│  • Environment: Staging secrets                         │
└─────────────────────────────────────────────────────────┘

Development Environment:
┌─────────────────────────────────────────────────────────┐
│                  Local Development                       │
│  • Domain: localhost:3000                              │
│  • Database: Local Supabase instance                    │
│  • Environment: .env.local                             │
└─────────────────────────────────────────────────────────┘
```

---

## Core Services Architecture

### API Gateway Design

```typescript
// Middleware stack for all API routes
export const apiMiddleware = [
  corsMiddleware,           // CORS handling
  authMiddleware,           // JWT validation
  rateLimitMiddleware,      // Rate limiting
  validationMiddleware,     // Request validation
  errorHandlingMiddleware,  // Centralized error handling
  loggingMiddleware        // Request/response logging
];

// Rate limiting configuration
const rateLimits = {
  '/api/chat': { limit: 100, window: '1h' },
  '/api/voice': { limit: 50, window: '1h' },
  '/api/auth': { limit: 10, window: '15m' },
  '/api/subscription': { limit: 20, window: '1h' }
};
```

### Authentication Service (Supabase)

```typescript
// Authentication flow
interface AuthConfig {
  providers: ['email', 'google', 'discord'];
  sessionTimeout: '7d';
  refreshThreshold: '1h';
  maxConcurrentSessions: 3;
}

// JWT token structure
interface JWTPayload {
  sub: string;           // User ID
  email: string;         // User email
  tier: 'free' | 'plus' | 'pro';
  exp: number;           // Expiration timestamp
  iat: number;           // Issued at timestamp
}
```

### Payment Service (Stripe)

```typescript
// Stripe integration architecture
interface SubscriptionTiers {
  free: {
    price: 0,
    limits: {
      messagesPerDay: 50,
      voiceMinutesPerDay: 5,
      gamingHoursPerDay: 0,
      customAvatars: 0
    }
  },
  plus: {
    price: 1499, // $14.99
    stripePriceId: 'price_plus_monthly',
    limits: {
      messagesPerDay: 500,
      voiceMinutesPerDay: 60,
      gamingHoursPerDay: 2,
      customAvatars: 5
    }
  },
  pro: {
    price: 2499, // $24.99
    stripePriceId: 'price_pro_monthly',
    limits: {
      messagesPerDay: -1, // unlimited
      voiceMinutesPerDay: -1,
      gamingHoursPerDay: -1,
      customAvatars: -1
    }
  }
}
```

### Chat Service with WebSocket

```typescript
// Real-time chat architecture
interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'voice' | 'image';
  timestamp: Date;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    voiceDuration?: number;
  };
}

// WebSocket event types
type WebSocketEvent = 
  | { type: 'message_start'; data: { conversationId: string } }
  | { type: 'message_delta'; data: { content: string } }
  | { type: 'message_complete'; data: ChatMessage }
  | { type: 'typing_start'; data: { userId: string } }
  | { type: 'typing_stop'; data: { userId: string } }
  | { type: 'error'; data: { message: string } };
```

### Gaming Orchestration Service

```typescript
// Gaming session management
interface GameSession {
  id: string;
  userId: string;
  companionId: string;
  gameType: 'minecraft' | 'factorio';
  serverId: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  maxDuration: number; // minutes
  connectionDetails: {
    serverAddress: string;
    port: number;
    accessCode?: string;
  };
}

// Server allocation strategy
interface ServerPool {
  minecraft: {
    availableServers: string[];
    maxConcurrentSessions: 20;
    autoScalingConfig: {
      minServers: 2,
      maxServers: 10,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    }
  };
}
```

### Rate Limiting Service

```typescript
// Redis-based rate limiting
interface RateLimitConfig {
  identifier: string; // user ID or IP
  resource: string;   // endpoint or feature
  limit: number;      // max requests
  window: number;     // time window in seconds
  strategy: 'sliding_window' | 'fixed_window' | 'token_bucket';
}

// Usage tracking for subscription tiers
interface UsageTracker {
  userId: string;
  resource: 'messages' | 'voice_minutes' | 'gaming_hours';
  currentUsage: number;
  limit: number;
  resetTime: Date;
  overageAllowed: boolean;
}
```

---

## Infrastructure Design

### Cloud Provider Architecture: Vercel + Supabase + AWS

```typescript
// Infrastructure as Code configuration
interface InfrastructureConfig {
  vercel: {
    project: 'airi-saas',
    framework: 'nextjs',
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    environmentVariables: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      STRIPE_SECRET_KEY: string;
      REDIS_URL: string;
    }
  },
  supabase: {
    project: 'airi-saas-prod',
    region: 'us-east-1',
    database: {
      version: 'postgresql-15',
      size: 'small',
      backups: {
        enabled: true,
        schedule: 'daily',
        retention: '7d'
      }
    },
    auth: {
      providers: ['email', 'google', 'discord'],
      sessionTimeout: '7d',
      emailConfirmation: false // MVP setting
    }
  }
}
```

### Container Strategy (Minimal for MVP)

```dockerfile
# Gaming server containers (Minecraft)
FROM openjdk:17-alpine
WORKDIR /app
COPY minecraft-server.jar .
COPY plugins/ plugins/
EXPOSE 25565
CMD ["java", "-Xmx2G", "-jar", "minecraft-server.jar", "nogui"]

# Health check and auto-scaling
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:8080/health || exit 1
```

### Auto-scaling Configuration

```typescript
// Vercel auto-scaling (managed)
interface VercelScaling {
  functions: {
    maxDuration: '10s',
    memory: '1024mb',
    maxConcurrency: 1000
  },
  edge: {
    runtime: 'edge',
    regions: ['all'], // Global distribution
    maxDuration: '30s'
  }
}

// Gaming server scaling
interface GameServerScaling {
  minInstances: 2,
  maxInstances: 10,
  scaleUpCriteria: {
    queueLength: 5,
    cpuThreshold: 70,
    responseTime: '5s'
  },
  scaleDownCriteria: {
    idleTime: '5m',
    cpuThreshold: 30
  }
}
```

### CDN Setup (CloudFlare)

```typescript
// CDN configuration
interface CDNConfig {
  zones: {
    'airi.chat': {
      ssl: 'full_strict',
      minTlsVersion: '1.2',
      caching: {
        browserTtl: 3600,
        edgeTtl: 86400,
        cacheLevel: 'aggressive'
      },
      security: {
        securityLevel: 'medium',
        challengePassage: 300,
        browserIntegrityCheck: true
      }
    }
  },
  pageRules: {
    '/api/*': { cache_level: 'bypass' },
    '/static/*': { cache_level: 'cache_everything', edge_ttl: 2592000 },
    '/_next/static/*': { cache_level: 'cache_everything', edge_ttl: 31536000 }
  }
}
```

---

## Data Flow Architecture

### Request Flow for Chat Messages

```typescript
// Complete chat message flow
const chatMessageFlow = {
  1: 'User sends message via WebSocket',
  2: 'Next.js API route receives and validates message',
  3: 'Rate limiting check against Redis',
  4: 'Content moderation via OpenAI Moderation API',
  5: 'Store message in Supabase database',
  6: 'Route to appropriate LLM provider',
  7: 'Stream response back via WebSocket',
  8: 'Update conversation history in database',
  9: 'Track usage metrics for billing'
};

// Message processing pipeline
interface MessagePipeline {
  input: {
    userId: string;
    content: string;
    conversationId: string;
    contentType: 'text' | 'voice';
  };
  processing: {
    rateLimitCheck: boolean;
    contentModeration: boolean;
    contextRetrieval: ChatMessage[];
    llmRouting: LLMProvider;
  };
  output: {
    response: string;
    tokensUsed: number;
    processingTime: number;
    model: string;
  };
}
```

### LLM Provider Abstraction

```typescript
// Multi-provider architecture with failover
interface LLMProvider {
  name: 'openai' | 'anthropic' | 'groq';
  endpoint: string;
  apiKey: string;
  models: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  priority: number;
  healthCheck: () => Promise<boolean>;
}

// Failover logic
class LLMService {
  providers: LLMProvider[];
  
  async sendMessage(message: string): Promise<string> {
    const sortedProviders = this.providers
      .filter(p => p.healthCheck())
      .sort((a, b) => a.priority - b.priority);
      
    for (const provider of sortedProviders) {
      try {
        return await this.callProvider(provider, message);
      } catch (error) {
        console.warn(`Provider ${provider.name} failed, trying next...`);
        continue;
      }
    }
    throw new Error('All LLM providers unavailable');
  }
}
```

### Gaming Session Management

```typescript
// Gaming session lifecycle
interface GameSessionFlow {
  creation: {
    validateUserTier: () => boolean;
    checkResourceAvailability: () => Promise<boolean>;
    allocateServer: () => Promise<GameServer>;
    generateAccessCode: () => string;
  };
  
  management: {
    monitorSession: () => void;
    handlePlayerJoin: (playerId: string) => void;
    processGameCommands: (command: string) => void;
    trackUsage: () => void;
  };
  
  termination: {
    gracefulShutdown: () => Promise<void>;
    saveProgress: () => Promise<void>;
    releaseResources: () => Promise<void>;
    updateUsageStats: () => Promise<void>;
  };
}
```

### Voice Streaming Pipeline

```typescript
// Real-time voice processing
interface VoiceProcessingPipeline {
  input: {
    audioStream: ReadableStream;
    sampleRate: 16000;
    format: 'wav' | 'mp3';
  };
  
  speechToText: {
    provider: 'openai_whisper' | 'azure_speech';
    language: 'auto' | string;
    confidence: number;
  };
  
  textProcessing: {
    llmProvider: LLMProvider;
    context: ChatMessage[];
    personality: CompanionPersonality;
  };
  
  textToSpeech: {
    provider: 'elevenlabs' | 'openai_tts';
    voice: string;
    speed: number;
    emotion: string;
  };
  
  output: {
    audioStream: ReadableStream;
    lipSyncData: LipSyncFrame[];
    duration: number;
  };
}
```

---

## Security Implementation

### API Security with JWT

```typescript
// JWT configuration and validation
interface JWTConfig {
  algorithm: 'HS256';
  secret: string; // From environment
  expiresIn: '7d';
  refreshThreshold: '1h';
  
  claims: {
    sub: string;      // User ID
    email: string;    // User email
    tier: string;     // Subscription tier
    permissions: string[]; // Feature permissions
  };
}

// API security middleware
const securityMiddleware = [
  // CORS configuration
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://airi.chat'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }),
  
  // Rate limiting
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // Security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"]
      }
    }
  })
];
```

### Rate Limiting with Redis

```typescript
// Redis-based rate limiting implementation
class RedisRateLimiter {
  constructor(private redis: Redis) {}
  
  async checkLimit(
    identifier: string,
    resource: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const key = `rate_limit:${identifier}:${resource}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    // Sliding window log
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const current = await this.redis.zcard(key);
    
    if (current >= limit) {
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = new Date(oldest[1] + windowSeconds * 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);
    
    return {
      allowed: true,
      remaining: limit - current - 1,
      resetTime: new Date(now + windowSeconds * 1000)
    };
  }
}
```

### Content Moderation Flow

```typescript
// Content moderation pipeline
interface ModerationService {
  moderateContent: (content: string, userId: string) => Promise<ModerationResult>;
  checkUserHistory: (userId: string) => Promise<UserModerationHistory>;
  escalateViolation: (userId: string, violation: Violation) => Promise<void>;
}

interface ModerationResult {
  allowed: boolean;
  flagged: boolean;
  categories: {
    harassment: boolean;
    hate: boolean;
    selfHarm: boolean;
    sexual: boolean;
    violence: boolean;
  };
  confidenceScore: number;
  action: 'allow' | 'warn' | 'block' | 'review';
}

// Automated moderation workflow
const moderationFlow = {
  1: 'Pre-process content (normalize, clean)',
  2: 'Check against blocked terms list',
  3: 'Call OpenAI Moderation API',
  4: 'Apply custom rules based on user age/tier',
  5: 'Log result and apply action',
  6: 'Track violations for pattern detection'
};
```

### Secret Management

```typescript
// Environment variable configuration
interface EnvironmentConfig {
  // Database
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Authentication
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  
  // Payments
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PUBLISHABLE_KEY: string;
  
  // LLM Providers
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GROQ_API_KEY: string;
  
  // Voice Services
  ELEVENLABS_API_KEY: string;
  OPENAI_TTS_API_KEY: string;
  
  // Infrastructure
  REDIS_URL: string;
  CLOUDFLARE_API_TOKEN: string;
  
  // Security
  ENCRYPTION_KEY: string;
  WEBHOOK_SECRET: string;
}

// Secret rotation strategy
interface SecretRotationPlan {
  apiKeys: {
    schedule: 'quarterly';
    notification: '30d_before';
    automation: true;
  };
  webhookSecrets: {
    schedule: 'monthly';
    rollover: true;
  };
  jwtSecrets: {
    schedule: 'annually';
    gracePeriod: '7d';
  };
}
```

---

## Integration Patterns

### LLM Provider Failover

```typescript
// Provider health monitoring
class ProviderHealthMonitor {
  private providers: Map<string, ProviderStatus> = new Map();
  
  async monitorProviders(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        const startTime = Date.now();
        await this.healthCheck(provider);
        const latency = Date.now() - startTime;
        
        this.updateStatus(name, {
          healthy: true,
          latency,
          lastCheck: new Date(),
          failureCount: 0
        });
      } catch (error) {
        this.updateStatus(name, {
          healthy: false,
          lastError: error.message,
          lastCheck: new Date(),
          failureCount: this.providers.get(name)?.failureCount + 1 || 1
        });
      }
    }
  }
  
  getHealthyProviders(): LLMProvider[] {
    return Array.from(this.providers.entries())
      .filter(([_, status]) => status.healthy && status.failureCount < 3)
      .map(([name, _]) => this.getProvider(name))
      .sort((a, b) => a.priority - b.priority);
  }
}

// Circuit breaker pattern
class CircuitBreaker {
  private failureCount = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime?: Date;
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldRetry()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private shouldRetry(): boolean {
    const timeout = 60000; // 1 minute
    return this.lastFailureTime && 
           Date.now() - this.lastFailureTime.getTime() > timeout;
  }
}
```

### Webhook Handling

```typescript
// Stripe webhook handler
export async function handleStripeWebhook(
  request: Request
): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      default:
        console.warn(`Unhandled webhook event: ${event.type}`);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 400 }
    );
  }
}

// Idempotent webhook processing
class WebhookProcessor {
  async processEvent(eventId: string, handler: () => Promise<void>): Promise<void> {
    const processedKey = `webhook:${eventId}`;
    const alreadyProcessed = await this.redis.exists(processedKey);
    
    if (alreadyProcessed) {
      console.log(`Webhook ${eventId} already processed, skipping`);
      return;
    }
    
    try {
      await handler();
      await this.redis.setex(processedKey, 86400, 'processed'); // 24h TTL
    } catch (error) {
      console.error(`Webhook processing failed for ${eventId}:`, error);
      throw error;
    }
  }
}
```

### Real-time Updates via WebSocket

```typescript
// Supabase Realtime configuration
interface RealtimeConfig {
  channels: {
    conversations: {
      table: 'messages';
      filter: 'conversation_id=eq.{conversation_id}';
      events: ['INSERT', 'UPDATE'];
    };
    usage: {
      table: 'usage_logs';
      filter: 'user_id=eq.{user_id}';
      events: ['INSERT'];
    };
    gaming: {
      table: 'gaming_sessions';
      filter: 'user_id=eq.{user_id}';
      events: ['UPDATE'];
    };
  };
}

// WebSocket message types
type RealtimeEvent = 
  | {
      type: 'message_created';
      payload: {
        conversation_id: string;
        message: ChatMessage;
      };
    }
  | {
      type: 'usage_updated';
      payload: {
        user_id: string;
        resource_type: string;
        current_usage: number;
        limit: number;
      };
    }
  | {
      type: 'gaming_status_changed';
      payload: {
        session_id: string;
        status: string;
        server_details?: any;
      };
    };

// Client-side WebSocket handling
class RealtimeClient {
  private supabase: SupabaseClient;
  private subscriptions: Map<string, any> = new Map();
  
  subscribeToConversation(conversationId: string, callback: (message: ChatMessage) => void) {
    const channel = this.supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, callback)
      .subscribe();
      
    this.subscriptions.set(conversationId, channel);
  }
  
  unsubscribeFromConversation(conversationId: string) {
    const channel = this.subscriptions.get(conversationId);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.subscriptions.delete(conversationId);
    }
  }
}
```

### Background Job Processing

```typescript
// Queue system for background jobs
interface JobQueue {
  name: string;
  concurrency: number;
  jobs: {
    'send-voice-response': {
      data: { userId: string; text: string; voiceId: string };
      options: { delay?: number; attempts: 3; backoff: 'exponential' };
    };
    'process-gaming-session': {
      data: { sessionId: string; action: string };
      options: { attempts: 2; timeout: 300000 };
    };
    'update-usage-metrics': {
      data: { userId: string; resourceType: string; amount: number };
      options: { attempts: 5; backoff: 'fixed' };
    };
    'cleanup-expired-sessions': {
      data: {};
      options: { repeat: { cron: '0 */6 * * *' } }; // Every 6 hours
    };
  };
}

// Job processing implementation (using Vercel Cron)
export async function processBackgroundJobs() {
  const jobs = await getQueuedJobs();
  
  for (const job of jobs) {
    try {
      switch (job.type) {
        case 'send-voice-response':
          await processVoiceResponse(job.data);
          break;
          
        case 'process-gaming-session':
          await processGamingSession(job.data);
          break;
          
        case 'update-usage-metrics':
          await updateUsageMetrics(job.data);
          break;
          
        case 'cleanup-expired-sessions':
          await cleanupExpiredSessions();
          break;
          
        default:
          console.warn(`Unknown job type: ${job.type}`);
      }
      
      await markJobCompleted(job.id);
      
    } catch (error) {
      console.error(`Job processing failed:`, error);
      await markJobFailed(job.id, error.message);
    }
  }
}
```

---

## DevOps Pipeline

### CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run type checking
        run: npm run type-check
        
      - name: Run linting
        run: npm run lint
        
      - name: Run unit tests
        run: npm run test
        
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          
      - name: Build application
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          
      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          
      - name: Notify deployment success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Deployment Strategy

```typescript
// Blue-green deployment configuration
interface DeploymentConfig {
  strategy: 'blue-green';
  environments: {
    blue: {
      url: 'blue.airi.chat';
      database: 'blue_db';
      trafficPercent: 0;
    };
    green: {
      url: 'green.airi.chat';
      database: 'green_db';
      trafficPercent: 100;
    };
  };
  
  rollback: {
    triggerConditions: {
      errorRate: '>5%';
      responseTime: '>2s';
      userComplaints: '>10/hour';
    };
    automaticRollback: true;
    rollbackTimeout: 300; // 5 minutes
  };
  
  canaryRelease: {
    enabled: true;
    trafficSplit: [95, 5]; // 95% stable, 5% canary
    promotionCriteria: {
      errorRate: '<1%';
      responseTime: '<1s';
      duration: '1h';
    };
  };
}
```

### Monitoring Setup

```typescript
// Comprehensive monitoring configuration
interface MonitoringStack {
  metrics: {
    provider: 'Vercel Analytics';
    dashboards: {
      performance: {
        metrics: ['response_time', 'throughput', 'error_rate'];
        alerts: {
          response_time: { threshold: '2s', severity: 'warning' };
          error_rate: { threshold: '5%', severity: 'critical' };
        };
      };
      
      business: {
        metrics: ['user_signups', 'conversion_rate', 'mrr'];
        alerts: {
          conversion_rate: { threshold: '<20%', severity: 'warning' };
          mrr_drop: { threshold: '10%', severity: 'critical' };
        };
      };
    };
  };
  
  logging: {
    provider: 'Vercel Logs + Sentry';
    retention: '30d';
    alerting: {
      errorThreshold: 10; // per minute
      channels: ['slack', 'email'];
    };
  };
  
  uptime: {
    provider: 'Vercel Monitoring';
    checks: [
      { url: 'https://airi.chat', interval: '1m' },
      { url: 'https://airi.chat/api/health', interval: '30s' },
      { url: 'https://airi.chat/api/auth/session', interval: '5m' }
    ];
  };
}

// Health check endpoints
export async function GET() {
  const healthChecks = await Promise.allSettled([
    checkDatabaseConnection(),
    checkRedisConnection(),
    checkLLMProviders(),
    checkStripeAPI()
  ]);
  
  const failures = healthChecks
    .filter(result => result.status === 'rejected')
    .map((result, index) => ({
      service: ['database', 'redis', 'llm', 'stripe'][index],
      error: result.reason
    }));
  
  return Response.json({
    status: failures.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    failures,
    uptime: process.uptime(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  }, {
    status: failures.length === 0 ? 200 : 503
  });
}
```

### Environment Management

```typescript
// Environment configuration matrix
interface EnvironmentMatrix {
  development: {
    database: 'local_supabase';
    redis: 'local_redis';
    llmProviders: 'test_keys';
    features: 'all_enabled';
    logLevel: 'debug';
  };
  
  staging: {
    database: 'supabase_staging';
    redis: 'upstash_staging';
    llmProviders: 'limited_quota';
    features: 'beta_features_enabled';
    logLevel: 'info';
  };
  
  production: {
    database: 'supabase_prod';
    redis: 'upstash_prod';
    llmProviders: 'full_quota';
    features: 'stable_only';
    logLevel: 'error';
  };
}

// Feature flag management
interface FeatureFlags {
  voice_chat: {
    enabled: boolean;
    rolloutPercentage: number;
    userSegments: string[];
  };
  
  gaming_integration: {
    enabled: boolean;
    betaUsers: string[];
    maxConcurrentSessions: number;
  };
  
  custom_avatars: {
    enabled: boolean;
    tierRestriction: 'plus' | 'pro';
    uploadLimit: number;
  };
}
```

---

## MVP Technical Decisions

### Monolithic Next.js App for Speed

```typescript
// Project structure optimized for rapid development
interface ProjectStructure {
  'app/': {
    '(auth)/': 'Authentication pages';
    '(dashboard)/': 'Main application';
    'api/': 'API routes';
    'globals.css': 'Global styles';
  };
  
  'components/': {
    'ui/': 'shadcn/ui components';
    'chat/': 'Chat interface components';
    'avatar/': 'Avatar rendering components';
    'subscription/': 'Billing components';
  };
  
  'lib/': {
    'supabase.ts': 'Database client';
    'stripe.ts': 'Payment processing';
    'llm.ts': 'LLM provider abstraction';
    'redis.ts': 'Caching and rate limiting';
    'validations.ts': 'Zod schemas';
  };
  
  'hooks/': {
    'use-chat.ts': 'Chat state management';
    'use-subscription.ts': 'Subscription management';
    'use-voice.ts': 'Voice chat functionality';
  };
}

// Monolithic benefits for MVP
const monolithicBenefits = {
  development: {
    faster_iteration: 'Single codebase, shared types',
    easier_debugging: 'All code in one place',
    simpler_deployment: 'Single deployment unit',
    reduced_complexity: 'No service boundaries'
  },
  
  infrastructure: {
    lower_costs: 'Single hosting bill',
    simpler_monitoring: 'One application to monitor',
    easier_scaling: 'Vercel handles automatically',
    fewer_dependencies: 'Managed services only'
  }
};
```

### Vercel for Hosting

```typescript
// Vercel configuration optimized for AIRI
interface VercelConfig {
  framework: 'nextjs';
  buildCommand: 'npm run build';
  outputDirectory: '.next';
  
  functions: {
    'app/api/**/route.ts': {
      runtime: 'nodejs18.x';
      memory: 1024;
      maxDuration: 10;
    };
  };
  
  edge: {
    'app/api/auth/**/route.ts': {
      runtime: 'edge';
      regions: ['all'];
    };
  };
  
  analytics: {
    enabled: true;
    webVitals: true;
  };
  
  speedInsights: {
    enabled: true;
  };
}

// Performance optimizations
const performanceConfig = {
  nextjs: {
    experimental: {
      appDir: true,
      serverComponentsExternalPackages: ['@supabase/supabase-js']
    },
    images: {
      domains: ['supabase.co', 'cloudflare.com'],
      formats: ['image/webp', 'image/avif']
    }
  },
  
  bundleAnalyzer: {
    enabled: process.env.ANALYZE === 'true'
  }
};
```

### Upstash Redis for Rate Limiting

```typescript
// Upstash Redis configuration
interface UpstashConfig {
  url: string; // From environment
  token: string; // From environment
  
  connectionPool: {
    maxConnections: 50;
    idleTimeout: 60000;
    connectionTimeout: 5000;
  };
  
  rateLimiting: {
    algorithms: ['sliding_window_log', 'token_bucket'];
    persistence: true;
    clustering: false; // Single region for MVP
  };
}

// Rate limiting strategies by resource
const rateLimitStrategies = {
  api_requests: {
    free: { limit: 1000, window: '1h' },
    plus: { limit: 5000, window: '1h' },
    pro: { limit: 50000, window: '1h' }
  },
  
  chat_messages: {
    free: { limit: 50, window: '1d' },
    plus: { limit: 500, window: '1d' },
    pro: { limit: -1, window: '1d' } // unlimited
  },
  
  voice_minutes: {
    free: { limit: 5, window: '1d' },
    plus: { limit: 60, window: '1d' },
    pro: { limit: -1, window: '1d' }
  },
  
  gaming_hours: {
    free: { limit: 0, window: '1d' },
    plus: { limit: 2, window: '1d' },
    pro: { limit: -1, window: '1d' }
  }
};
```

### Supabase Realtime for WebSocket

```typescript
// Supabase Realtime configuration
interface RealtimeSetup {
  database: {
    enableRealtimeForTables: [
      'messages',
      'conversations', 
      'gaming_sessions',
      'usage_logs'
    ];
    
    replicationSettings: {
      publications: 'supabase_realtime';
      filters: 'user_id';
    };
  };
  
  client: {
    reconnectInterval: 5000;
    heartbeatInterval: 30000;
    maxReconnectAttempts: 10;
    enableBinaryProtocol: true;
  };
  
  channels: {
    maxChannelsPerClient: 100;
    presenceEnabled: true;
    broadcastEnabled: true;
  };
}

// WebSocket connection management
class RealtimeManager {
  private client: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  
  async subscribeToUserUpdates(userId: string) {
    const channelName = `user:${userId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }
    
    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        this.handleMessageUpdate(payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'usage_logs',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        this.handleUsageUpdate(payload);
      })
      .subscribe();
    
    this.channels.set(channelName, channel);
    return channel;
  }
  
  cleanup() {
    for (const [name, channel] of this.channels) {
      this.client.removeChannel(channel);
      this.channels.delete(name);
    }
  }
}
```

### Direct LLM API Calls (No Queue Initially)

```typescript
// Simple LLM service for MVP
class MVPLLMService {
  private providers = [
    {
      name: 'openai',
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      priority: 1,
      cost: 0.002 // per 1K tokens
    },
    {
      name: 'anthropic', 
      client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      priority: 2,
      cost: 0.008
    },
    {
      name: 'groq',
      client: new Groq({ apiKey: process.env.GROQ_API_KEY }),
      priority: 3,
      cost: 0.0001 // much cheaper but less reliable
    }
  ];
  
  async sendMessage(
    messages: ChatMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      userId: string;
      companionId: string;
    }
  ): Promise<string> {
    // Simple failover - try each provider in order
    for (const provider of this.providers) {
      try {
        const response = await this.callProvider(provider, messages, options);
        
        // Track usage for billing
        await this.trackUsage({
          userId: options.userId,
          provider: provider.name,
          tokensUsed: response.usage?.total_tokens || 0,
          cost: (response.usage?.total_tokens || 0) * provider.cost / 1000
        });
        
        return response.choices[0].message.content;
        
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error);
        
        // If this is the last provider, throw
        if (provider === this.providers[this.providers.length - 1]) {
          throw new Error('All LLM providers failed');
        }
        
        continue;
      }
    }
    
    throw new Error('No LLM providers available');
  }
  
  private async callProvider(
    provider: any, 
    messages: ChatMessage[], 
    options: any
  ) {
    // Provider-specific logic
    switch (provider.name) {
      case 'openai':
        return await provider.client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: options.maxTokens || 150,
          temperature: options.temperature || 0.7
        });
        
      case 'anthropic':
        return await provider.client.messages.create({
          model: 'claude-3-haiku-20240307',
          messages,
          max_tokens: options.maxTokens || 150
        });
        
      case 'groq':
        return await provider.client.chat.completions.create({
          model: 'mixtral-8x7b-32768',
          messages,
          max_tokens: options.maxTokens || 150
        });
        
      default:
        throw new Error(`Unknown provider: ${provider.name}`);
    }
  }
}
```

---

## Code Architecture

### Project Structure

```
airi-saas/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/              # Main app layout
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   ├── avatar/
│   │   │   └── page.tsx
│   │   ├── gaming/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   ├── signup/
│   │   │   │   └── route.ts
│   │   │   └── login/
│   │   │       └── route.ts
│   │   ├── chat/
│   │   │   ├── conversations/
│   │   │   │   └── route.ts
│   │   │   └── messages/
│   │   │       └── route.ts
│   │   ├── subscription/
│   │   │   ├── create-checkout/
│   │   │   │   └── route.ts
│   │   │   └── webhook/
│   │   │       └── route.ts
│   │   ├── voice/
│   │   │   ├── tts/
│   │   │   │   └── route.ts
│   │   │   └── stt/
│   │   │       └── route.ts
│   │   └── gaming/
│   │       └── minecraft/
│   │           └── route.ts
│   │
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
│
├── components/                   # Reusable components
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   │
│   ├── chat/                     # Chat-specific components
│   │   ├── chat-interface.tsx
│   │   ├── message-bubble.tsx
│   │   ├── typing-indicator.tsx
│   │   └── voice-controls.tsx
│   │
│   ├── avatar/                   # Avatar components
│   │   ├── avatar-selector.tsx
│   │   ├── avatar-viewer.tsx
│   │   └── avatar-uploader.tsx
│   │
│   ├── subscription/             # Billing components
│   │   ├── pricing-table.tsx
│   │   ├── upgrade-modal.tsx
│   │   └── usage-meter.tsx
│   │
│   └── gaming/                   # Gaming components
│       ├── server-selector.tsx
│       ├── game-status.tsx
│       └── session-timer.tsx
│
├── lib/                          # Utility libraries
│   ├── supabase.ts               # Database client
│   ├── stripe.ts                 # Payment processing
│   ├── redis.ts                  # Caching client
│   ├── llm/                      # LLM providers
│   │   ├── index.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── groq.ts
│   ├── voice/                    # Voice processing
│   │   ├── tts.ts
│   │   └── stt.ts
│   ├── gaming/                   # Gaming integration
│   │   ├── minecraft.ts
│   │   └── session-manager.ts
│   ├── validations.ts            # Zod schemas
│   ├── auth.ts                   # Auth utilities
│   ├── rate-limiting.ts          # Rate limiting logic
│   ├── moderation.ts             # Content moderation
│   └── utils.ts                  # General utilities
│
├── hooks/                        # Custom React hooks
│   ├── use-chat.ts               # Chat state management
│   ├── use-subscription.ts       # Subscription state
│   ├── use-voice.ts              # Voice functionality
│   ├── use-gaming.ts             # Gaming sessions
│   ├── use-realtime.ts           # WebSocket connections
│   └── use-rate-limit.ts         # Rate limiting checks
│
├── types/                        # TypeScript definitions
│   ├── database.ts               # Supabase generated types
│   ├── stripe.ts                 # Stripe types
│   ├── chat.ts                   # Chat interfaces
│   ├── gaming.ts                 # Gaming interfaces
│   └── index.ts                  # Shared types
│
├── middleware.ts                 # Next.js middleware
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS config
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies
```

### API Route Organization

```typescript
// Standardized API route structure
export interface APIRoute<T = any> {
  GET?: (request: Request, context: RouteContext) => Promise<Response>;
  POST?: (request: Request, context: RouteContext) => Promise<Response>;
  PUT?: (request: Request, context: RouteContext) => Promise<Response>;
  DELETE?: (request: Request, context: RouteContext) => Promise<Response>;
  PATCH?: (request: Request, context: RouteContext) => Promise<Response>;
}

// API route middleware wrapper
export function createAPIRoute<T>(
  handlers: APIRoute<T>,
  options: {
    auth?: boolean;
    rateLimit?: string;
    validation?: ZodSchema;
  } = {}
) {
  return async function routeHandler(
    request: Request, 
    context: RouteContext
  ): Promise<Response> {
    try {
      // Apply middleware
      if (options.auth) {
        await authenticateRequest(request);
      }
      
      if (options.rateLimit) {
        await checkRateLimit(request, options.rateLimit);
      }
      
      if (options.validation && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const body = await request.json();
        options.validation.parse(body);
      }
      
      // Route to appropriate handler
      const method = request.method as keyof APIRoute;
      const handler = handlers[method];
      
      if (!handler) {
        return new Response('Method not allowed', { status: 405 });
      }
      
      return await handler(request, context);
      
    } catch (error) {
      return handleAPIError(error);
    }
  };
}

// Example usage
export const POST = createAPIRoute({
  POST: async (request, { params }) => {
    const body = await request.json();
    const result = await createChatMessage(body);
    return Response.json(result);
  }
}, {
  auth: true,
  rateLimit: 'chat_messages',
  validation: CreateMessageSchema
});
```

### Component Architecture

```typescript
// Component composition pattern
interface ChatInterfaceProps {
  conversationId: string;
  companionId: string;
  userId: string;
}

export function ChatInterface({ 
  conversationId, 
  companionId, 
  userId 
}: ChatInterfaceProps) {
  const { messages, sendMessage, isLoading } = useChat(conversationId);
  const { usage, checkLimit } = useRateLimit(userId);
  const { isConnected } = useRealtime(conversationId);
  
  const handleSendMessage = async (content: string) => {
    // Check rate limits
    const canSend = await checkLimit('chat_messages');
    if (!canSend) {
      toast.error('Daily message limit reached. Upgrade to continue.');
      return;
    }
    
    // Send message
    await sendMessage({
      content,
      conversationId,
      companionId
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      <ChatHeader 
        companionName={companion?.name}
        isConnected={isConnected}
      />
      
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        userId={userId}
      />
      
      <MessageInput 
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="Type a message..."
      />
      
      <UsageMeter 
        current={usage.messages}
        limit={usage.messagesLimit}
        type="messages"
      />
    </div>
  );
}

// Compound component pattern for complex UI
export const ChatInterface = {
  Root: ChatInterfaceRoot,
  Header: ChatHeader,
  MessageList: MessageList,
  Input: MessageInput,
  UsageMeter: UsageMeter,
  VoiceControls: VoiceControls
};
```

### State Management

```typescript
// Chat state management with Zustand
interface ChatState {
  conversations: Map<string, Conversation>;
  currentConversationId: string | null;
  messages: Map<string, ChatMessage[]>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
}

const useChatStore = create<ChatState>((set, get) => ({
  conversations: new Map(),
  currentConversationId: null,
  messages: new Map(),
  isLoading: false,
  error: null,
  
  setCurrentConversation: (id) => {
    set({ currentConversationId: id });
    get().loadMessages(id);
  },
  
  addMessage: (conversationId, message) => {
    const messages = get().messages;
    const conversationMessages = messages.get(conversationId) || [];
    messages.set(conversationId, [...conversationMessages, message]);
    set({ messages: new Map(messages) });
  },
  
  sendMessage: async ({ content, conversationId, companionId }) => {
    set({ isLoading: true, error: null });
    
    try {
      // Optimistic update
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId,
        role: 'user',
        content,
        timestamp: new Date()
      };
      
      get().addMessage(conversationId, userMessage);
      
      // Send to API
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          companionId,
          content
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const assistantMessage = await response.json();
      get().addMessage(conversationId, assistantMessage);
      
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  loadConversations: async () => {
    const response = await fetch('/api/chat/conversations');
    const conversations = await response.json();
    
    const conversationMap = new Map();
    conversations.forEach(conv => {
      conversationMap.set(conv.id, conv);
    });
    
    set({ conversations: conversationMap });
  },
  
  loadMessages: async (conversationId) => {
    const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
    const messages = await response.json();
    
    const messageMap = get().messages;
    messageMap.set(conversationId, messages);
    
    set({ messages: new Map(messageMap) });
  }
}));

// Custom hook wrapper
export function useChat(conversationId?: string) {
  const store = useChatStore();
  
  useEffect(() => {
    if (conversationId && conversationId !== store.currentConversationId) {
      store.setCurrentConversation(conversationId);
    }
  }, [conversationId, store]);
  
  const messages = conversationId 
    ? store.messages.get(conversationId) || []
    : [];
  
  return {
    messages,
    isLoading: store.isLoading,
    error: store.error,
    sendMessage: store.sendMessage,
    loadConversations: store.loadConversations
  };
}
```

---

## Launch Readiness Checklist

### Critical Path Items

#### Week 0: Infrastructure Setup
- [ ] **Domain Registration & SSL**
  - Register airi.chat domain
  - Configure CloudFlare DNS and SSL
  - Set up CDN and security rules
  
- [ ] **Hosting & Deployment**
  - Create Vercel project and configure deployment
  - Set up GitHub repository with CI/CD
  - Configure environment variables and secrets
  
- [ ] **Database & Auth**
  - Set up Supabase project (production)
  - Configure authentication providers (Google, Discord)
  - Run database migrations and RLS policies
  
- [ ] **Payment Processing** 
  - Set up Stripe account and webhook endpoints
  - Create product/price objects for subscription tiers
  - Test payment flows in sandbox environment

#### Week 1: Core Functionality
- [ ] **Authentication System**
  - Email/password signup and login
  - OAuth integration (Google, Discord)
  - JWT token management and refresh
  - Password reset functionality
  
- [ ] **Subscription Management**
  - Stripe Checkout integration
  - Customer portal for plan changes
  - Webhook handling for subscription events
  - Usage tracking and enforcement
  
- [ ] **Basic Chat Interface**
  - Message sending and receiving
  - Real-time updates via WebSocket
  - Rate limiting implementation
  - Basic error handling and retry logic

#### Week 2: Enhanced Features
- [ ] **Avatar System**
  - Preset avatar gallery and selection
  - Live2D integration for 2D avatars
  - Avatar display in chat interface
  - Custom avatar upload (premium feature)
  
- [ ] **Voice Chat**
  - Speech-to-text integration (OpenAI Whisper)
  - Text-to-speech with multiple voice options
  - Real-time voice processing pipeline
  - Usage tracking for voice minutes

#### Week 3: Gaming Integration
- [ ] **Minecraft Integration**
  - Server provisioning and management
  - Bot framework integration (Mineflayer)
  - Session management and resource allocation
  - In-game chat integration
  
- [ ] **Content Moderation**
  - OpenAI Moderation API integration
  - Custom filter rules and blocked terms
  - User violation tracking and penalties
  - Appeal process for false positives

### Performance Targets

#### Response Time Benchmarks
- **Page Load Time**: <2 seconds (Largest Contentful Paint)
- **Chat Response**: <2 seconds (95th percentile)
- **Voice Processing**: <1 second end-to-end latency
- **API Endpoints**: <500ms response time (95th percentile)
- **Database Queries**: <100ms average response time

#### Throughput Requirements
- **Concurrent Users**: Support 10,000 simultaneous users
- **Messages per Second**: Handle 1,000 chat messages/second
- **API Requests**: Process 50,000 requests/minute
- **WebSocket Connections**: Maintain 10,000 concurrent connections
- **Gaming Sessions**: Support 50 concurrent Minecraft sessions

#### Resource Utilization
- **Database Connections**: <80% of connection pool
- **Memory Usage**: <80% of allocated memory per function
- **CPU Utilization**: <70% average across all services
- **Cache Hit Rate**: >90% for frequently accessed data

### Security Requirements

#### Authentication & Authorization
- [ ] **JWT Token Security**
  - Secure token generation and validation
  - Appropriate token expiration (7 days max)
  - Refresh token rotation
  - Session invalidation on password change
  
- [ ] **API Security**
  - Rate limiting on all endpoints
  - Input validation and sanitization
  - SQL injection prevention
  - XSS protection headers
  
- [ ] **Data Protection**
  - Encryption at rest for sensitive data
  - HTTPS everywhere with strong SSL/TLS
  - Secure environment variable management
  - PII data handling compliance

#### Compliance & Governance
- [ ] **GDPR Compliance**
  - Data processing agreements
  - User consent mechanisms
  - Right to deletion implementation
  - Data portability features
  
- [ ] **COPPA Compliance**
  - Age verification during signup
  - Parental consent for users under 13
  - Limited data collection for minors
  - Special moderation rules for young users
  
- [ ] **Content Moderation**
  - Automated content filtering
  - Human review escalation process
  - Clear community guidelines
  - Transparent moderation actions

### Monitoring Setup

#### Application Monitoring
- [ ] **Performance Monitoring**
  - Vercel Analytics integration
  - Real User Monitoring (RUM)
  - Core Web Vitals tracking
  - API performance metrics
  
- [ ] **Error Tracking**
  - Sentry error monitoring setup
  - Error alerting and notification
  - Error rate thresholds and alerts
  - Automatic error grouping and deduplication
  
- [ ] **Business Metrics**
  - User registration and conversion tracking
  - Subscription tier distribution
  - Feature adoption rates
  - Revenue and billing metrics

#### Infrastructure Monitoring
- [ ] **Health Checks**
  - Automated uptime monitoring
  - Service dependency health checks
  - Database connection monitoring
  - Third-party service availability
  
- [ ] **Alert Configuration**
  - Error rate thresholds (>5% critical)
  - Response time alerts (>2s warning)
  - Database performance alerts
  - Payment processing failure alerts
  
- [ ] **Dashboard Setup**
  - Real-time operational dashboard
  - Business metrics dashboard
  - Security monitoring dashboard
  - Cost optimization dashboard

### Pre-Launch Testing

#### Functional Testing
- [ ] **End-to-End Tests**
  - User registration and authentication flow
  - Complete chat conversation flow
  - Subscription upgrade and payment flow
  - Voice chat functionality
  - Gaming session creation and management
  
- [ ] **Integration Testing**
  - LLM provider failover testing
  - Stripe webhook processing
  - Supabase realtime functionality
  - Rate limiting enforcement
  - Content moderation pipeline

#### Performance Testing
- [ ] **Load Testing**
  - Simulate 10K concurrent users
  - Test message processing under load
  - Database performance under stress
  - WebSocket connection scaling
  
- [ ] **Security Testing**
  - Penetration testing for common vulnerabilities
  - Authentication bypass attempts
  - SQL injection and XSS testing
  - Rate limiting bypass testing

### Go-Live Checklist

#### Final Pre-Launch (Day -1)
- [ ] **Production Deployment**
  - Deploy latest code to production
  - Run database migrations
  - Verify all environment variables
  - Test critical user flows in production
  
- [ ] **Team Readiness**
  - On-call schedule established
  - Incident response procedures documented
  - Customer support processes ready
  - Marketing materials finalized
  
- [ ] **Monitoring & Alerts**
  - All monitoring systems active
  - Alert thresholds configured
  - Escalation procedures tested
  - Dashboard access for team members

#### Launch Day (Day 0)
- [ ] **Soft Launch**
  - Limited user invitations (100 users max)
  - Monitor system performance closely
  - Gather initial user feedback
  - Fix critical issues immediately
  
- [ ] **System Validation**
  - Verify payment processing works
  - Confirm user registration flow
  - Test chat functionality end-to-end
  - Validate rate limiting and usage tracking
  
- [ ] **Communication**
  - Announce launch to beta users
  - Share on social media channels
  - Send press release to tech blogs
  - Update website and documentation

This comprehensive architecture document provides the foundation for implementing the AIRI SaaS platform within the 30-day MVP timeline. The focus on managed services, serverless architecture, and proven technology stacks ensures rapid development while maintaining scalability and reliability for the initial launch.

---

## For Backend Engineers

### API Specifications
The API follows RESTful conventions with the following key endpoints:

**Authentication Endpoints:**
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication  
- `POST /api/auth/logout` - Session termination
- `POST /api/auth/refresh` - Token refresh

**Chat Endpoints:**
- `GET /api/conversations` - List user conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id/messages` - Get conversation messages
- `POST /api/conversations/:id/messages` - Send message

**Subscription Endpoints:**
- `GET /api/subscription/current` - Get current subscription
- `POST /api/subscription/create-checkout` - Create Stripe checkout
- `POST /api/subscription/webhook` - Handle Stripe webhooks

### Database Schema
Use the provided Supabase schema with Row Level Security policies. Key tables include:
- `profiles` - User account information
- `companions` - AI companion configurations
- `conversations` - Chat conversation metadata  
- `messages` - Individual chat messages
- `subscriptions` - Stripe subscription data

### Business Logic Patterns
Implement the LLM provider abstraction with failover logic, rate limiting using Redis, and real-time updates via Supabase Realtime.

### Authentication Guide
Use Supabase Auth with JWT tokens. Implement middleware for protected routes and handle token refresh automatically.

### Error Handling
Centralized error handling with structured logging to Sentry. Implement graceful degradation for external service failures.

---

## For Frontend Engineers

### Component Architecture
Built with Next.js 14 App Router, React 18, and TailwindCSS. Use shadcn/ui for consistent component design.

### API Integration Patterns  
Use SWR for data fetching with automatic revalidation. Implement optimistic updates for chat messages.

### Routing Architecture
App Router with route groups for authentication and dashboard layouts. Implement middleware for route protection.

### Performance Optimization
Optimize for Core Web Vitals with image optimization, code splitting, and strategic pre-loading.

### Build Setup
Standard Next.js build with TypeScript, ESLint, and Prettier configuration.

---

## For QA Engineers

### Testable Boundaries
Focus testing on API endpoints, authentication flows, payment processing, and real-time chat functionality.

### Validation Requirements
Test rate limiting enforcement, content moderation, and subscription tier restrictions.

### Integration Points
Test LLM provider failover, Stripe webhook processing, and gaming server connections.

### Performance Benchmarks
Ensure <2s page loads, <2s chat responses, and <1s voice processing latency.

### Security Testing
Validate authentication, rate limiting, input sanitization, and content moderation systems.

---

## For Security Analysts

### Authentication Flow
JWT-based authentication with Supabase Auth, OAuth providers, and secure session management.

### Security Model
Implement OWASP Top 10 protections, rate limiting, input validation, and content moderation for safe user interactions.

The architecture prioritizes rapid MVP delivery while establishing a foundation for future scaling to millions of users. All technical decisions optimize for the 30-day launch timeline while maintaining security, reliability, and user experience standards.
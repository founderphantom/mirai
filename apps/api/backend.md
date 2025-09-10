# AIRI Platform Backend Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication & Authorization](#authentication--authorization)
7. [Core Services](#core-services)
8. [Integration Points](#integration-points)
9. [Security Measures](#security-measures)
10. [Environment Configuration](#environment-configuration)
11. [Current Implementation Status](#current-implementation-status)
12. [Known Issues & Technical Debt](#known-issues--technical-debt)
13. [Future Requirements](#future-requirements)
14. [Deployment Considerations](#deployment-considerations)
15. [Best Practices & Guidelines](#best-practices--guidelines)

---

## Architecture Overview

The AIRI Platform backend is a Next.js API application designed as a comprehensive AI assistant platform. It follows a service-oriented architecture with clear separation of concerns between API routes, business logic services, and data access layers.

### Key Architectural Decisions

- **Framework**: Next.js API Routes for serverless deployment compatibility
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **Real-time**: WebSocket support through Supabase Realtime
- **Caching**: Redis (Upstash) for rate limiting and response caching
- **Queue**: In-memory queuing with Redis backup for async tasks

### System Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Gateway   │────▶│   Services      │
│   (React/Vue)   │     │   (Next.js)     │     │   Layer         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                         │
                                ▼                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   Middleware    │     │   Database      │
                        │   - Auth        │     │   (Supabase)    │
                        │   - RateLimit   │     └─────────────────┘
                        │   - Validation  │              │
                        └─────────────────┘              ▼
                                │                ┌─────────────────┐
                                ▼                │   External      │
                        ┌─────────────────┐     │   Services      │
                        │   Cache Layer   │     │   - OpenAI      │
                        │   (Redis)       │     │   - Anthropic   │
                        └─────────────────┘     │   - Stripe      │
                                                 └─────────────────┘
```

---

## Technology Stack

### Core Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.15 | API framework and server |
| **TypeScript** | 5.3.3 | Type safety and developer experience |
| **Supabase** | 2.39.3 | Database, Auth, Realtime, Storage |
| **Redis (Upstash)** | 1.28.1 | Caching and rate limiting |
| **Stripe** | 14.10.0 | Payment processing |

### AI/LLM Providers

| Provider | SDK Version | Models Supported |
|----------|-------------|------------------|
| **OpenAI** | 4.24.7 | GPT-4, GPT-3.5-Turbo |
| **Anthropic** | 0.16.1 | Claude 3 (Opus, Sonnet, Haiku) |
| **Groq** | 0.3.3 | Mixtral, Llama2 |

### Security & Utilities

| Package | Purpose |
|---------|---------|
| **bcryptjs** | Password hashing |
| **helmet** | Security headers |
| **cors** | CORS configuration |
| **zod** | Schema validation |
| **winston** | Logging |
| **nanoid** | ID generation |

---

## Project Structure

```
apps/api/
├── pages/api/              # API Routes
│   ├── auth/              # Authentication endpoints
│   ├── conversations/     # Chat conversation management
│   ├── gaming/           # Gaming integration endpoints
│   ├── search/           # Search functionality
│   ├── subscription/     # Subscription management
│   ├── usage/           # Usage tracking
│   ├── users/           # User profile management
│   └── voice/           # Voice chat endpoints
├── src/
│   ├── lib/              # Core libraries and configs
│   │   ├── api-keys.ts   # API key management
│   │   ├── config.ts     # Environment configuration
│   │   ├── init.ts       # Initialization logic
│   │   ├── redis.ts      # Redis client setup
│   │   ├── stripe.ts     # Stripe configuration
│   │   └── supabase.ts   # Supabase clients
│   ├── middleware/       # Express-style middleware
│   │   ├── auth.ts       # Authentication middleware
│   │   ├── error.ts      # Error handling
│   │   ├── rateLimit.ts  # Rate limiting
│   │   ├── security.ts   # Security headers
│   │   └── validation.ts # Request validation
│   ├── services/         # Business logic layer
│   │   ├── auth.service.ts        # Authentication logic
│   │   ├── chat.service.ts        # Chat operations
│   │   ├── conversation.service.ts # Conversation management
│   │   ├── gaming.service.ts      # Gaming integrations
│   │   ├── llm.service.ts         # LLM provider abstraction
│   │   ├── moderation.service.ts  # Content moderation
│   │   ├── subscription.service.ts # Subscription handling
│   │   ├── usage.service.ts       # Usage tracking
│   │   └── voice.service.ts       # Voice services
│   ├── types/            # TypeScript type definitions
│   │   ├── database.ts   # Database types
│   │   ├── database.types.ts # Generated Supabase types
│   │   └── database.generated.ts # Auto-generated types
│   └── utils/            # Utility functions
│       ├── crypto.ts     # Encryption utilities
│       └── format.ts     # Formatting helpers
├── tests/                # Test suites
├── __mocks__/           # Test mocks
├── .env.example         # Environment template
├── jest.config.js       # Jest configuration
├── next.config.js       # Next.js configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── vercel.json         # Deployment config
```

---

## Database Schema

### Core Tables

#### User Management

**user_profiles**
- Primary user information and subscription data
- Links to Supabase Auth
- Stores subscription tier, status, and usage counts
- Includes preferences and metadata

**user_violations**
- Tracks policy violations and moderation actions
- Severity levels: warning, suspension, ban
- Includes expiration dates for temporary actions

#### Conversation & Messaging

**conversations**
- Chat conversation metadata
- Stores model preferences, system prompts
- Supports starring, archiving, and tagging
- Tracks token usage per conversation

**chat_messages**
- Individual messages within conversations
- Stores role (user/assistant/system)
- Tracks token counts and response times
- Supports attachments and tool calls
- Includes moderation flags and ratings

**chat_messages_partitioned** (Partitioned by month)
- Monthly partitions for scalability
- Automatic partition creation
- Optimized for time-based queries

**message_attachments**
- File attachments for messages
- Stores file metadata and storage paths
- Supports images, documents, audio

#### Subscription & Payments

**subscription_history**
- Historical subscription changes
- Tracks tier changes and billing periods
- Links to Stripe subscription IDs

**payment_history**
- Individual payment records
- Stores amounts, currencies, and statuses
- Links to Stripe payment intents

#### Usage & Analytics

**usage_logs**
- Detailed API usage tracking
- Stores request/response metadata
- Tracks token usage and costs
- Includes error logging

**usage_daily_aggregates**
- Daily usage summaries per user
- Token counts, costs, and model usage
- Optimized for billing and analytics

**analytics_events**
- General event tracking
- Flexible JSON event data
- Used for product analytics

#### System Tables

**rate_limits**
- User-specific rate limit tracking
- Daily message and conversation counts
- Auto-reset functionality

**api_keys**
- API key management for external access
- Hashed storage with prefix display
- IP whitelisting support
- Scope-based permissions

**cache_entries**
- Key-value cache with TTL
- Used for response caching
- Automatic expiration handling

**system_settings**
- Global configuration storage
- Public/private setting support
- Category-based organization

**provider_health**
- LLM provider status tracking
- Response times and success rates
- Used for failover decisions

### Database Views

**recent_conversations**
- Optimized view for conversation lists
- Includes last message preview
- Pre-computed message counts

**active_users_summary**
- User activity aggregations
- Daily/weekly/monthly active users

**feature_usage**
- Feature adoption metrics
- Model and provider usage stats

### Database Functions

Key stored procedures and functions:

- `get_conversation_messages()` - Paginated message retrieval
- `search_messages()` - Full-text message search
- `check_rate_limit()` - Rate limit validation
- `update_daily_usage_aggregate()` - Usage aggregation
- `cleanup_old_messages()` - Data retention management
- `create_monthly_partition()` - Automatic partitioning

### Relationships

```
user_profiles (1) ──────┬──▶ (N) conversations
                        ├──▶ (N) chat_messages
                        ├──▶ (N) usage_logs
                        ├──▶ (N) payment_history
                        └──▶ (N) subscription_history

conversations (1) ──────┬──▶ (N) chat_messages
                       └──▶ (N) chat_sessions

chat_messages (1) ──────▶ (N) message_attachments
```

---

## API Endpoints

### Authentication (`/api/auth/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/signup` | POST | User registration | No |
| `/api/auth/login` | POST | User login | No |
| `/api/auth/logout` | POST | User logout | Yes |
| `/api/auth/refresh` | POST | Refresh tokens | Yes |
| `/api/auth/session` | GET | Get current session | Yes |

### Conversations (`/api/conversations/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/conversations` | GET | List conversations | Yes |
| `/api/conversations` | POST | Create conversation | Yes |
| `/api/conversations/[id]` | GET | Get conversation details | Yes |
| `/api/conversations/[id]` | PUT | Update conversation | Yes |
| `/api/conversations/[id]` | DELETE | Delete conversation | Yes |
| `/api/conversations/[id]/messages` | GET | Get messages | Yes |
| `/api/conversations/[id]/messages` | POST | Send message | Yes |
| `/api/conversations/[id]/messages/[messageId]` | PUT | Edit message | Yes |
| `/api/conversations/[id]/messages/[messageId]` | DELETE | Delete message | Yes |

### Subscription (`/api/subscription/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/subscription/current` | GET | Get current subscription | Yes |
| `/api/subscription/create-checkout` | POST | Create Stripe checkout | Yes |
| `/api/subscription/cancel` | POST | Cancel subscription | Yes |
| `/api/subscription/webhook` | POST | Stripe webhook handler | No (Stripe sig) |

### Usage (`/api/usage/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/usage/summary` | GET | Get usage summary | Yes |

### Search (`/api/search/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/search/messages` | GET | Search messages | Yes |

### Voice (`/api/voice/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/voice/tts` | POST | Text-to-speech | Yes |
| `/api/voice/stt` | POST | Speech-to-text | Yes |

### Gaming (`/api/gaming/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/gaming/minecraft/create-session` | POST | Create Minecraft session | Yes |
| `/api/gaming/sessions/[id]` | GET | Get session details | Yes |

### User Profile (`/api/users/*`)

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/users/profile` | GET | Get user profile | Yes |
| `/api/users/profile` | PUT | Update profile | Yes |

---

## Authentication & Authorization

### Authentication Flow

1. **Registration**:
   - User provides email/password
   - Supabase Auth creates auth user
   - Database trigger creates user_profile
   - Welcome notification sent
   - JWT tokens returned

2. **Login**:
   - Credentials validated by Supabase Auth
   - User profile fetched
   - Violation checks performed
   - Session created with JWT tokens

3. **Token Management**:
   - Access token (1 hour expiry)
   - Refresh token (7 days expiry)
   - Automatic refresh on 401 responses
   - Secure httpOnly cookies for web

### Authorization Levels

| Level | Description | Capabilities |
|-------|-------------|--------------|
| **Anonymous** | No authentication | Health checks only |
| **Free User** | Basic authentication | Limited API access (20 msgs/day) |
| **Pro User** | Paid subscription | Enhanced limits (200 msgs/day) |
| **Enterprise** | Enterprise plan | Unlimited usage, API keys |
| **Admin** | System administrator | Full system access |

### Middleware Chain

```typescript
// Request flow through middleware
Request → CORS → Security Headers → Rate Limit → Auth → Validation → Handler
```

### API Key Authentication

- Alternative to JWT for programmatic access
- Scoped permissions system
- IP whitelisting support
- Usage tracking and limits

---

## Core Services

### 1. Auth Service (`auth.service.ts`)

**Responsibilities**:
- User registration and login
- Session management
- Token generation and validation
- Password reset flows
- Account verification

**Key Methods**:
```typescript
- signUp(email, password, metadata)
- signIn(email, password)
- signOut(userId)
- refreshSession(refreshToken)
- verifyEmail(token)
- resetPassword(email)
```

### 2. LLM Service (`llm.service.ts`)

**Responsibilities**:
- Provider abstraction (OpenAI, Anthropic, Groq)
- Model selection and fallback
- Token counting and cost calculation
- Response streaming
- Caching layer

**Provider Configuration**:
```typescript
{
  openai: {
    'gpt-4-turbo-preview': { maxTokens: 4096, costPer1kTokens: 0.01 },
    'gpt-4': { maxTokens: 8192, costPer1kTokens: 0.03 },
    'gpt-3.5-turbo': { maxTokens: 4096, costPer1kTokens: 0.0015 }
  },
  anthropic: {
    'claude-3-opus': { maxTokens: 4096, costPer1kTokens: 0.015 },
    'claude-3-sonnet': { maxTokens: 4096, costPer1kTokens: 0.003 }
  },
  groq: {
    'mixtral-8x7b': { maxTokens: 32768, costPer1kTokens: 0.0006 }
  }
}
```

### 3. Conversation Service (`conversation.service.ts`)

**Responsibilities**:
- Conversation lifecycle management
- Message history handling
- Context window management
- Conversation summarization
- Archive and search operations

**Key Features**:
- Automatic title generation
- Token usage tracking
- Conversation templates
- Export functionality

### 4. Chat Service (`chat.service.ts`)

**Responsibilities**:
- Message processing pipeline
- Stream handling
- Tool/function calling
- Response formatting
- Error recovery

**Message Flow**:
1. Validate input
2. Check rate limits
3. Moderate content
4. Process with LLM
5. Store response
6. Track usage
7. Return to client

### 5. Subscription Service (`subscription.service.ts`)

**Responsibilities**:
- Subscription tier management
- Usage limit enforcement
- Stripe integration
- Billing cycle management

**Subscription Tiers**:

| Tier | Daily Messages | Max Tokens | Features |
|------|----------------|------------|----------|
| **Free** | 20 | 2,000 | Basic chat, GPT-3.5 |
| **Pro** | 200 | 8,000 | GPT-4, Voice, Images |
| **Enterprise** | Unlimited | 32,000 | All features, API, Priority |

### 6. Moderation Service (`moderation.service.ts`)

**Responsibilities**:
- Content filtering
- Violation tracking
- Automatic actions
- Appeal handling

**Moderation Pipeline**:
1. Pre-flight content check
2. OpenAI moderation API
3. Custom rule application
4. Action determination
5. Violation logging

### 7. Usage Service (`usage.service.ts`)

**Responsibilities**:
- Request logging
- Token counting
- Cost calculation
- Daily aggregation
- Billing data preparation

### 8. Voice Service (`voice.service.ts`)

**Responsibilities**:
- Speech-to-text conversion
- Text-to-speech synthesis
- Audio processing
- Voice selection

**Status**: Partially implemented, requires:
- `voice_usage` table creation
- Provider integration completion
- Streaming support

### 9. Gaming Service (`gaming.service.ts`)

**Responsibilities**:
- Game session management
- AI companion integration
- Command processing
- State synchronization

**Status**: Stub implementation, requires:
- `gaming_sessions` table
- `game_commands` table  
- `ai_game_actions` table
- Actual game API integrations

---

## Integration Points

### Supabase

**Used For**:
- Database (PostgreSQL)
- Authentication
- Real-time subscriptions
- File storage
- Row Level Security

**Configuration**:
```typescript
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_KEY=[service_key]
```

### Stripe

**Used For**:
- Payment processing
- Subscription management
- Invoice generation
- Webhook events

**Webhook Events Handled**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Redis (Upstash)

**Used For**:
- Rate limiting
- Response caching
- Session storage
- Queue management

**Cache Strategy**:
- LLM responses: 5-minute TTL
- User profiles: 1-hour TTL
- Search results: 10-minute TTL

### LLM Providers

**OpenAI**:
- Primary provider
- Models: GPT-4, GPT-3.5
- Moderation API
- Embeddings

**Anthropic**:
- Secondary provider
- Models: Claude 3 variants
- Fallback for OpenAI

**Groq**:
- Fast inference provider
- Models: Mixtral, Llama
- Cost-effective option

---

## Security Measures

### Implemented Security

1. **Authentication & Authorization**:
   - JWT-based authentication
   - Refresh token rotation
   - Session invalidation
   - Role-based access control

2. **Data Protection**:
   - Password hashing (bcrypt)
   - Encryption at rest (Supabase)
   - TLS/SSL in transit
   - Sensitive data masking

3. **API Security**:
   - Rate limiting per endpoint
   - Request validation (Zod)
   - CORS configuration
   - Security headers (Helmet)

4. **Content Security**:
   - Input sanitization
   - SQL injection prevention (prepared statements)
   - XSS protection
   - Content moderation

5. **Monitoring & Logging**:
   - Request logging
   - Error tracking
   - Audit trails
   - Anomaly detection

### Security Headers

```typescript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'"
}
```

---

## Environment Configuration

### Required Variables

```bash
# Node Environment
NODE_ENV=development|test|production
PORT=3001

# Supabase (Required)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_KEY=[service_key]

# Frontend URL (Required in production)
FRONTEND_URL=https://your-frontend.com

# Redis (Recommended)
REDIS_URL=redis://default:[password]@[host]:[port]
REDIS_PASSWORD=[password]

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_[key]
STRIPE_WEBHOOK_SECRET=whsec_[secret]

# LLM Providers (At least one required)
OPENAI_API_KEY=sk-[key]
ANTHROPIC_API_KEY=sk-ant-[key]
GROQ_API_KEY=gsk_[key]

# Security (Required in production)
JWT_SECRET=[32+ character secret]
ENCRYPTION_KEY=[32+ character key]

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_WEBSOCKETS=true
ENABLE_FILE_UPLOADS=true
ENABLE_VOICE_CHAT=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration Validation

The system validates all environment variables on startup using Zod schemas. Missing required variables will prevent the application from starting.

---

## Current Implementation Status

### ✅ Fully Implemented

1. **Authentication System**:
   - User registration/login
   - JWT token management
   - Session handling
   - Password security

2. **Conversation Management**:
   - CRUD operations
   - Message history
   - Token tracking
   - Search functionality

3. **LLM Integration**:
   - Multi-provider support
   - Model selection
   - Streaming responses
   - Error handling with fallback

4. **Subscription System**:
   - Tier management
   - Usage limits
   - Stripe integration
   - Webhook handling

5. **Rate Limiting**:
   - Per-user limits
   - Endpoint-specific rules
   - Redis-backed counting

6. **Database Layer**:
   - Optimized queries
   - Partitioned tables
   - Stored procedures
   - Automatic maintenance

### ⚠️ Partially Implemented

1. **Voice Features**:
   - Basic TTS/STT endpoints exist
   - Missing `voice_usage` table
   - No streaming support
   - Limited provider options

2. **Gaming Integration**:
   - Stub services created
   - Database tables not created
   - No actual game connections
   - AI companion logic incomplete

3. **File Uploads**:
   - Attachment schema exists
   - Upload endpoints missing
   - Storage integration incomplete

### ❌ Not Implemented

1. **Real-time Features**:
   - WebSocket connections
   - Live message streaming
   - Presence indicators
   - Collaborative features

2. **Team Features**:
   - Multi-user organizations
   - Shared conversations
   - Permission management
   - Team billing

3. **Advanced Analytics**:
   - Detailed usage reports
   - Cost breakdowns
   - Performance metrics
   - User behavior tracking

---

## Known Issues & Technical Debt

### Critical Issues

1. **Table Name Mismatches** (FIXED):
   - Previously had mismatched table names
   - Fixed: `user_profiles` vs `profiles`
   - All references now consistent

2. **Type Safety Issues** (FIXED):
   - Generated types now match database
   - Proper type imports throughout

### Technical Debt

1. **Gaming Tables Missing**:
   ```sql
   -- Need to create:
   - gaming_sessions
   - game_commands
   - ai_game_actions
   ```

2. **Voice Usage Table Missing**:
   ```sql
   -- Need to create:
   - voice_usage
   ```

3. **Error Handling Inconsistency**:
   - Some endpoints use try-catch
   - Others use async handlers
   - Need standardization

4. **Caching Strategy**:
   - Inconsistent TTL values
   - Missing cache invalidation
   - No cache warming

5. **Test Coverage**:
   - Unit tests incomplete
   - Integration tests missing
   - No E2E test suite

6. **Documentation**:
   - API documentation incomplete
   - Missing OpenAPI/Swagger spec
   - No developer guides

### Performance Concerns

1. **N+1 Query Issues**:
   - Some conversation fetches
   - User profile lookups
   - Need query optimization

2. **Missing Indexes**:
   - Search operations slow
   - Need index analysis

3. **Memory Leaks**:
   - Potential in streaming handlers
   - WebSocket connection cleanup

---

## Future Requirements

### Immediate Priorities

1. **Complete Voice Integration**:
   - Create `voice_usage` table
   - Implement streaming
   - Add more providers
   - Usage tracking

2. **Gaming Features**:
   - Create required tables
   - Minecraft integration
   - Roblox integration
   - AI companion logic

3. **File Upload System**:
   - Complete upload endpoints
   - Virus scanning
   - Image processing
   - Document parsing

### Medium-term Goals

1. **Real-time Features**:
   - WebSocket implementation
   - Live collaboration
   - Presence system
   - Push notifications

2. **Team Functionality**:
   - Organization management
   - Role-based permissions
   - Shared resources
   - Team analytics

3. **Enhanced Security**:
   - 2FA implementation
   - API key rotation
   - Audit logging
   - Compliance features

### Long-term Vision

1. **Platform Expansion**:
   - Plugin system
   - Marketplace
   - Custom models
   - White-label options

2. **Advanced AI Features**:
   - Fine-tuning support
   - RAG implementation
   - Agent frameworks
   - Memory systems

3. **Enterprise Features**:
   - SSO/SAML
   - Advanced analytics
   - SLA monitoring
   - Custom deployments

---

## Deployment Considerations

### Current Deployment

- **Platform**: Vercel (Next.js optimized)
- **Database**: Supabase (managed PostgreSQL)
- **Cache**: Upstash Redis (edge-compatible)
- **CDN**: Vercel Edge Network

### Environment-Specific Configurations

**Development**:
```javascript
{
  cors: { origin: 'http://localhost:5173' },
  rateLimit: { disabled: true },
  logging: { level: 'debug' }
}
```

**Production**:
```javascript
{
  cors: { origin: process.env.FRONTEND_URL },
  rateLimit: { enabled: true },
  logging: { level: 'error' }
}
```

### Scaling Considerations

1. **Database**:
   - Connection pooling configured
   - Read replicas for queries
   - Partitioning for messages
   - Regular vacuum operations

2. **Caching**:
   - Edge caching for static content
   - Redis for dynamic content
   - CDN for assets

3. **Rate Limiting**:
   - Per-user limits
   - IP-based limits
   - Endpoint-specific rules

### Monitoring & Observability

1. **Metrics**:
   - Response times
   - Error rates
   - Token usage
   - Cost tracking

2. **Logging**:
   - Structured logging (Winston)
   - Error tracking (Sentry ready)
   - Audit trails

3. **Health Checks**:
   - `/api/health` endpoint
   - Database connectivity
   - Provider status
   - Cache availability

---

## Best Practices & Guidelines

### Code Organization

1. **Service Layer Pattern**:
   - Business logic in services
   - Thin API route handlers
   - Reusable components

2. **Error Handling**:
   ```typescript
   try {
     // Operation
   } catch (error) {
     logger.error('Context', error);
     throw new AppError('User message', 500);
   }
   ```

3. **Type Safety**:
   - Use generated types
   - Avoid `any` types
   - Validate inputs with Zod

### Database Guidelines

1. **Query Optimization**:
   - Use indexes appropriately
   - Avoid N+1 queries
   - Use stored procedures for complex operations

2. **Data Integrity**:
   - Use transactions for multi-table operations
   - Implement soft deletes
   - Maintain audit trails

3. **Performance**:
   - Pagination for large datasets
   - Batch operations when possible
   - Regular maintenance tasks

### API Design

1. **RESTful Principles**:
   - Proper HTTP methods
   - Meaningful status codes
   - Consistent response format

2. **Response Format**:
   ```typescript
   // Success
   {
     success: true,
     data: { ... },
     meta: { ... }
   }
   
   // Error
   {
     success: false,
     error: {
       code: 'ERROR_CODE',
       message: 'User-friendly message',
       details: { ... }
     }
   }
   ```

3. **Versioning Strategy**:
   - URL versioning (`/api/v1/`)
   - Backward compatibility
   - Deprecation notices

### Security Guidelines

1. **Input Validation**:
   - Validate all inputs
   - Sanitize user content
   - Use parameterized queries

2. **Authentication**:
   - Validate tokens on every request
   - Implement token refresh
   - Log authentication events

3. **Data Protection**:
   - Encrypt sensitive data
   - Mask PII in logs
   - Implement data retention policies

---

## Migration Scripts Needed

### Gaming Features Tables

```sql
-- gaming_sessions table
CREATE TABLE gaming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  game VARCHAR(50) NOT NULL,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- game_commands table
CREATE TABLE game_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES gaming_sessions(id) ON DELETE CASCADE,
  command_type VARCHAR(50) NOT NULL,
  command_data JSONB NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_game_actions table
CREATE TABLE ai_game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES gaming_sessions(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL,
  ai_response TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Voice Usage Table

```sql
-- voice_usage table
CREATE TABLE voice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL, -- 'tts' or 'stt'
  provider VARCHAR(50),
  model VARCHAR(100),
  input_length INTEGER,
  output_length INTEGER,
  duration_seconds NUMERIC(10,2),
  cost NUMERIC(10,4),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for usage queries
CREATE INDEX idx_voice_usage_user_date ON voice_usage(user_id, created_at DESC);
```

---

## Conclusion

The AIRI Platform backend is a robust, scalable API service built on modern technologies. While core features are fully implemented and production-ready, several advanced features (gaming, voice, real-time) require completion. The architecture supports future expansion while maintaining security and performance standards.

### Key Strengths
- Solid authentication and authorization system
- Multi-provider LLM support with fallback
- Comprehensive database schema with optimization
- Well-structured service layer architecture
- Production-ready subscription and payment system

### Areas for Improvement
- Complete gaming and voice integrations
- Implement real-time features
- Expand test coverage
- Standardize error handling
- Complete API documentation

### Recommended Next Steps
1. Create missing database tables (gaming, voice)
2. Complete voice service implementation
3. Implement file upload system
4. Add comprehensive testing
5. Deploy monitoring and alerting
6. Create API documentation

This documentation serves as the single source of truth for the backend architecture and should be updated as the system evolves.

---

*Last Updated: September 2024*
*Version: 1.0.0*
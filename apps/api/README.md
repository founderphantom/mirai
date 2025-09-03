# AIRI API Server

Production-ready backend API server for the AIRI SaaS platform, built with Next.js API routes, Supabase, and deployed on Vercel Edge Functions.

## Features

- **Authentication & Authorization**: JWT-based auth with Supabase Auth
- **Multi-Provider LLM Integration**: OpenAI, Anthropic, and Groq with automatic failover
- **Subscription Management**: Stripe integration for payments and billing
- **Rate Limiting**: Redis-based rate limiting with Upstash
- **Real-time Communication**: WebSocket support via Supabase Realtime
- **Voice Services**: Text-to-speech and speech-to-text capabilities
- **Gaming Integration**: Support for Minecraft, Roblox, and Fortnite sessions
- **Comprehensive Error Handling**: Centralized error management and logging
- **Type Safety**: Full TypeScript implementation with Zod validation

## Tech Stack

- **Runtime**: Node.js 18+ on Vercel Edge Functions
- **Framework**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **Payments**: Stripe
- **Cache/Rate Limiting**: Upstash Redis
- **LLM Providers**: OpenAI, Anthropic, Groq
- **Validation**: Zod schemas
- **Logging**: Winston

## Project Structure

```
/apps/api/
├── pages/api/          # API route endpoints
│   ├── auth/          # Authentication endpoints
│   ├── conversations/ # Chat conversation endpoints
│   ├── subscription/  # Subscription management
│   ├── voice/        # Voice services
│   └── gaming/       # Gaming integration
├── src/
│   ├── lib/          # External service clients
│   ├── services/     # Business logic services
│   ├── middleware/   # API middleware
│   ├── types/        # TypeScript definitions
│   └── utils/        # Helper utilities
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.example
```

## Installation

1. Clone the repository and navigate to the API directory:
```bash
cd apps/api
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env` (see Configuration section)

5. Run database migrations:
```bash
pnpm migrate
```

6. Start development server:
```bash
pnpm dev
```

## Configuration

### Required Environment Variables

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# LLM Providers (at least one required)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GROQ_API_KEY=your_groq_api_key
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Sign in user |
| POST | `/api/auth/logout` | Sign out user |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/session` | Get current session |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List user conversations |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/[id]/messages` | Get conversation messages |
| POST | `/api/conversations/[id]/messages` | Send message to conversation |

### Subscription

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/current` | Get current subscription |
| POST | `/api/subscription/create-checkout` | Create Stripe checkout session |
| POST | `/api/subscription/cancel` | Cancel subscription |
| POST | `/api/subscription/webhook` | Stripe webhook handler |

### Voice

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/tts` | Convert text to speech |
| POST | `/api/voice/stt` | Convert speech to text |

### Gaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gaming/minecraft/create-session` | Create Minecraft session |
| GET | `/api/gaming/sessions/[id]` | Get session details |
| DELETE | `/api/gaming/sessions/[id]` | End gaming session |

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

Tokens are also set as HTTP-only cookies for web clients.

## Rate Limiting

Rate limits are based on subscription tier:
- **Free**: 100 requests/hour
- **Basic**: 500 requests/hour
- **Pro**: 1000 requests/hour
- **Enterprise**: 10000 requests/hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "errors": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

Common status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## WebSocket Support

Real-time features use Supabase Realtime. Connect to channels for live updates:

```javascript
// Subscribe to conversation updates
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    console.log('New message:', payload);
  })
  .subscribe();
```

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm type-check
```

### Linting
```bash
pnpm lint
```

### Building for Production
```bash
pnpm build
```

## Deployment

The API is designed for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with:
```bash
vercel --prod
```

### Vercel Configuration

The API uses Edge Functions for optimal performance. Configuration is in `next.config.js`.

## Security

- All sensitive data is encrypted at rest and in transit
- API keys are hashed and stored securely
- Input validation and sanitization on all endpoints
- SQL injection protection via parameterized queries
- XSS protection through content security policies
- Rate limiting to prevent abuse
- CORS configured for allowed origins only

## Monitoring

- Comprehensive logging with Winston
- Error tracking with Sentry (optional)
- Performance monitoring headers
- Health check endpoint at `/api/health`

## LLM Provider Failover

The API automatically fails over between LLM providers if one is unavailable:
1. Primary: Configured default provider
2. Secondary: Next available provider
3. Tertiary: Final fallback provider

## Subscription Tiers

| Feature | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Messages/month | 100 | 1,000 | 10,000 | Unlimited |
| Voice minutes/month | 10 | 60 | 300 | Unlimited |
| Custom personalities | 1 | 3 | 10 | Unlimited |
| Gaming integration | ❌ | ✅ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ |

## Support

For issues or questions:
- Create an issue in the repository
- Contact support at support@airi.app
- Check documentation at docs.airi.app

## License

Proprietary - All rights reserved
# Mirai API Server

Backend API server for the Mirai AIRI SaaS platform.

## Architecture

The API server is built with Node.js, Express, and TypeScript, integrating with Supabase for database and authentication.

### Key Features

- **Authentication & Authorization**: JWT-based auth with Supabase Auth integration
- **Multi-tier Subscription System**: Free, Plus, Pro, and Enterprise tiers
- **AI Provider Integration**: Support for OpenAI, Anthropic, Google, and Groq
- **Real-time Communication**: WebSocket support for streaming chat responses
- **Rate Limiting**: Tier-based rate limiting and usage tracking
- **Caching**: Redis caching for improved performance
- **Comprehensive Logging**: Structured logging with Winston
- **Error Handling**: Centralized error handling with custom error types

## Project Structure

```
api/
├── src/
│   ├── index.ts                 # Server entry point
│   ├── config/                  # Configuration management
│   │   └── index.ts
│   ├── controllers/             # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── conversation.controller.ts
│   │   └── ...
│   ├── middleware/              # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── ...
│   ├── routes/                  # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── chat.routes.ts
│   │   └── ...
│   ├── services/                # Business logic services
│   │   ├── ai-provider.service.ts
│   │   ├── redis.service.ts
│   │   └── ...
│   ├── database/                # Database connection and queries
│   │   └── connection.ts
│   ├── websocket/               # WebSocket server
│   │   └── index.ts
│   ├── types/                   # TypeScript type definitions
│   │   └── database.types.ts
│   └── utils/                   # Utility functions
│       ├── logger.ts
│       └── errors.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- Redis (optional, for caching)
- Supabase project with database configured

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations (if needed):
```bash
npm run migrate
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Production Build

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token

### Chat Endpoints

- `POST /api/v1/chat/messages` - Send message and get AI response
- `POST /api/v1/chat/messages/regenerate` - Regenerate last AI response
- `PATCH /api/v1/chat/messages/:id` - Update/rate message
- `DELETE /api/v1/chat/messages/:id` - Delete message
- `POST /api/v1/chat/completion` - Direct chat completion
- `GET /api/v1/chat/models` - Get available AI models

### Conversation Endpoints

- `GET /api/v1/conversations` - Get user's conversations
- `POST /api/v1/conversations` - Create new conversation
- `GET /api/v1/conversations/:id` - Get specific conversation
- `PATCH /api/v1/conversations/:id` - Update conversation
- `DELETE /api/v1/conversations/:id` - Delete conversation
- `GET /api/v1/conversations/:id/messages` - Get conversation messages

### Subscription Endpoints

- `GET /api/v1/subscriptions/current` - Get current subscription
- `GET /api/v1/subscriptions/plans` - Get available plans
- `POST /api/v1/subscriptions/subscribe` - Subscribe to plan
- `POST /api/v1/subscriptions/cancel` - Cancel subscription

### WebSocket Events

Connect to WebSocket server with authentication token:

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### Events

- `chat:stream` - Stream chat responses
- `conversation:join` - Join conversation room
- `typing:start` - Send typing indicator
- `voice:start` - Start voice chat (Plus+)

## Environment Variables

Key environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service key
- `DATABASE_URL` - Direct database connection string
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

See `.env.example` for complete list.

## Security

- JWT-based authentication with refresh tokens
- Rate limiting per tier
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS protection via helmet
- CORS configuration
- Request logging and monitoring

## Testing

Run tests:
```bash
npm test
```

## Deployment

The API server can be deployed to:

- **Docker**: Use the provided Dockerfile
- **Vercel**: Deploy as serverless functions
- **Railway/Render**: Direct deployment
- **AWS/GCP/Azure**: Container or VM deployment

### Docker Deployment

Build image:
```bash
docker build -t mirai-api .
```

Run container:
```bash
docker run -p 3000:3000 --env-file .env mirai-api
```

## Monitoring

- Health check: `GET /api/v1/health`
- Readiness probe: `GET /api/v1/health/ready`
- Liveness probe: `GET /api/v1/health/live`
- Provider status: `GET /api/v1/health/providers`

## License

MIT
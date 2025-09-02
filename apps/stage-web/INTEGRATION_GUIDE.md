# Frontend-Backend Integration Guide

## Overview

This guide provides comprehensive instructions for running the Mirai SaaS platform with both frontend and backend components working together seamlessly.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Vue Frontend   │────▶│   Node.js API   │────▶│    Supabase     │
│  (Port 5173)    │     │   (Port 3000)   │     │   (Database)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        └───── WebSocket ───────┘
            (Real-time)
```

## Prerequisites

- Node.js 18+ and pnpm
- Supabase account and project
- Redis (optional for production)
- API keys for AI providers (OpenAI, Anthropic, etc.)

## Quick Start

### 1. Environment Setup

#### Backend Configuration (`apps/stage-web/api/.env`)

```bash
# Copy the example file
cp apps/stage-web/api/.env.example apps/stage-web/api/.env

# Edit with your values:
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://...

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...

# Security
JWT_SECRET=generate-a-32-char-secret
CORS_ORIGINS=http://localhost:5173
```

#### Frontend Configuration (`apps/stage-web/.env`)

```bash
# Copy the example file
cp apps/stage-web/.env.example apps/stage-web/.env

# Edit with your values:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

### 2. Install Dependencies

```bash
# From project root
pnpm install
```

### 3. Database Setup

#### Create Supabase Tables

Run these SQL commands in your Supabase SQL editor:

```sql
-- User profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  daily_message_count INT DEFAULT 0,
  voice_minutes_used INT DEFAULT 0,
  last_message_reset_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  system_prompt TEXT,
  model_id TEXT DEFAULT 'gpt-4o-mini',
  provider_id TEXT DEFAULT 'openai',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 2000,
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  attachments JSONB,
  model_id TEXT,
  provider_id TEXT,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  rating INT,
  feedback TEXT,
  regenerated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_messages_created_at ON chat_messages(created_at);
```

### 4. Start Development Servers

```bash
# Terminal 1: Start Backend API
cd apps/stage-web/api
pnpm dev

# Terminal 2: Start Frontend
cd apps/stage-web
pnpm dev
```

## API Integration

### Frontend API Client Usage

The frontend uses the API client library at `src/lib/api-client.ts`:

```typescript
import { api } from '@/lib/api-client'

// Authentication
const { data } = await api.auth.login(email, password)

// Chat operations
const response = await api.chat.sendMessage({
  conversation_id: 'uuid',
  content: 'Hello AI',
  stream: true
})

// Conversations
const { conversations } = await api.conversations.list()
```

### WebSocket Integration

For real-time features:

```typescript
import { io } from 'socket.io-client'

const socket = io('ws://localhost:3000', {
  auth: {
    token: supabaseSession.access_token
  }
})

// Join conversation room
socket.emit('conversation:join', conversationId)

// Send streaming message
socket.emit('chat:stream', {
  conversationId,
  content: message,
  model: 'gpt-4'
})

// Listen for tokens
socket.on('chat:token', ({ content }) => {
  // Append to message
})
```

## Critical User Flows

### 1. Authentication Flow

```
User Registration/Login
├── Frontend: Supabase Auth UI
├── Supabase: Creates auth.users record
├── Backend: Creates user_profile on first login
└── Frontend: Redirects to dashboard
```

### 2. Chat Message Flow

```
Send Message
├── Frontend: api.chat.sendMessage()
├── Backend: Validates user & conversation
├── Backend: Stores user message
├── Backend: Calls AI provider
├── Backend: Stores AI response
├── Backend: Updates usage counters
└── Frontend: Displays response
```

### 3. Subscription Upgrade Flow

```
Upgrade Subscription
├── Frontend: Select plan
├── Backend: Create Stripe checkout
├── Stripe: Process payment
├── Webhook: Update user profile
└── Frontend: Unlock features
```

## Development Tips

### 1. Testing API Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Test with auth token
curl -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  http://localhost:3000/api/v1/users/profile
```

### 2. Debugging WebSocket

```javascript
// Enable Socket.IO debug mode
localStorage.debug = 'socket.io-client:*'
```

### 3. Mock AI Responses (Development)

Set in backend `.env`:
```bash
DEV_MOCK_AI_RESPONSES=true
```

## Production Deployment

### Backend Deployment (Railway/Render)

1. Set environment variables
2. Configure start script:
   ```json
   "start": "node dist/index.js"
   ```
3. Build command:
   ```bash
   pnpm build
   ```

### Frontend Deployment (Vercel/Netlify)

1. Set environment variables
2. Build command:
   ```bash
   pnpm build
   ```
3. Output directory: `dist`

### Environment Variables

Production variables to configure:

```bash
# Backend
NODE_ENV=production
FRONTEND_URL=https://your-app.com
CORS_ORIGINS=https://your-app.com

# Frontend
VITE_API_URL=https://api.your-app.com/api/v1
VITE_WS_URL=wss://api.your-app.com
```

## Monitoring & Logging

### Backend Logs

Logs are written to:
- Console (development)
- `logs/api.log` (production)

### Error Tracking

Configure Sentry (optional):
```bash
SENTRY_DSN=your-sentry-dsn
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `CORS_ORIGINS` in backend `.env`
   - Ensure frontend URL matches exactly

2. **Authentication Failures**
   - Verify Supabase keys match between frontend/backend
   - Check token expiration

3. **WebSocket Connection Failed**
   - Ensure backend is running
   - Check firewall/proxy settings
   - Verify WebSocket URL in frontend

4. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check Supabase service role key

### Debug Mode

Enable debug logging:

```bash
# Backend
LOG_LEVEL=debug

# Frontend
VITE_DEBUG=true
```

## Security Considerations

1. **API Keys**: Never expose backend API keys to frontend
2. **CORS**: Restrict to specific origins in production
3. **Rate Limiting**: Configure based on load
4. **Authentication**: Always verify tokens server-side
5. **Input Validation**: Sanitize all user inputs

## Performance Optimization

1. **Database Indexes**: Add indexes for frequently queried fields
2. **Caching**: Enable Redis for session/query caching
3. **CDN**: Serve static assets via CDN
4. **Compression**: Enable gzip/brotli compression
5. **Connection Pooling**: Configure database connection pools

## Support

For issues or questions:
1. Check error logs
2. Review this documentation
3. Check Supabase dashboard for database issues
4. Monitor API response times

## Next Steps

1. Configure payment processing (Stripe)
2. Set up monitoring (Sentry, analytics)
3. Implement backup strategy
4. Configure CI/CD pipeline
5. Set up staging environment
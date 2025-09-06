# MIRAI Database Schema Documentation

## Overview

The MIRAI SaaS platform uses Supabase (PostgreSQL) as its primary database. The schema is designed for a lean startup approach, focusing on essential features while maintaining scalability for future growth.

## Current Implementation (Startup Essentials)

### 🚀 Core Philosophy
- **Lean & Cost-Effective**: $0/month on Supabase free tier
- **Product-Market Fit Focus**: Built-in analytics and feedback systems
- **Abuse Prevention**: Rate limiting for free tier users
- **User Engagement**: Notifications and activity tracking
- **Future-Ready**: Structure supports scaling when needed

### 📊 Analytics & Insights

#### `analytics_events` Table
Lightweight event tracking for product decisions.
- **Purpose**: Track user behavior without external services
- **Events**: signup, login, message_sent, conversation_created
- **Storage**: 30-day retention with automatic cleanup
- **Cost**: Free (no external analytics service needed)

#### `user_feedback` Table
Critical for understanding user needs.
- **Types**: bug reports, feature requests, general feedback
- **Rating**: 1-5 star ratings
- **Context**: Links to specific conversations
- **Usage**: Prioritize development based on user input

#### Views for Insights
- **`active_users_summary`**: Daily/weekly/monthly active users
- **`feature_usage`**: Message counts and token usage trends

### 🔒 Rate Limiting & Abuse Prevention

#### `rate_limits` Table
Simple but effective rate limiting.
- **Free Tier Limits**: 
  - 100 messages per day
  - 10 new conversations per day
- **Auto-reset**: Daily at midnight
- **Function**: `check_rate_limit()` for enforcement

### 📬 User Engagement

#### `notifications` Table
In-app notification system.
- **Types**: system, feature announcements, limit warnings
- **Auto-welcome**: New users get welcome message
- **Cleanup**: Read notifications deleted after 7 days

#### `waitlist` Table
Pre-launch and feature waitlist management.
- **Tracking**: Referral sources (twitter, producthunt, etc.)
- **Conversion**: Tracks when waitlist users become active
- **Interest Areas**: API access, teams, enterprise features

## Core Tables (Existing)

### 📝 Chat History Storage

#### `conversations` Table
Stores conversation threads between users and AI.

**Key Fields:**
- `id`: UUID primary key
- `user_id`: References auth.users
- `title`: Conversation title
- `model`: AI model used (gpt-4, etc.)
- `created_at`, `updated_at`: Timestamps
- `last_message_at`: Denormalized for performance
- `is_starred`, `is_archived`: Organization features
- `deleted_at`: Soft delete support
- `message_count`: Denormalized count
- `total_tokens`: Total token usage

**Indexes:**
- `idx_conversations_user_id`
- `idx_conversations_last_message_at`
- `idx_conversations_is_archived`

#### `chat_messages` Table
Individual messages within conversations.

**Key Fields:**
- `id`: UUID primary key
- `conversation_id`: References conversations
- `user_id`: References auth.users
- `role`: 'user' or 'assistant'
- `content`: Message text (unlimited length)
- `model`: Model used for this message
- `token_count`: Tokens used (now properly tracked)
- `created_at`: Timestamp
- `deleted_at`: Soft delete

**Indexes:**
- `idx_chat_messages_conversation_id`
- `idx_chat_messages_created_at`
- `idx_chat_messages_content_search` (GIN for full-text)

#### `message_attachments` Table
File attachments for messages.
- References to files in Supabase Storage
- Metadata for images and media
- Multiple attachments per message

### 👤 User Management

#### `user_profiles` Table
Extended user information.

**Key Fields:**
- `id`: References auth.users
- `email`: User email
- `full_name`: Display name
- `avatar_url`: Profile picture
- `subscription_tier`: free/pro/enterprise
- `subscription_status`: active/canceled/past_due
- `stripe_customer_id`, `stripe_subscription_id`: Billing
- `daily_message_count`, `total_message_count`: Usage tracking
- `last_seen_at`: Activity tracking (NEW)
- `settings`: JSONB for preferences
- `created_at`, `updated_at`: Timestamps

### 💰 Billing & Usage

#### `usage_logs` Table
Detailed usage tracking per API call.
- Request/response metadata
- Token consumption
- Model used
- Response time

#### `usage_daily_aggregates` Table
Pre-computed daily summaries.
- Reduces dashboard query load
- Daily token totals by model
- Message counts

#### `subscription_history` Table
Historical subscription changes.
- Plan changes
- Billing events
- Revenue tracking

#### `payment_history` Table
Payment records.
- Stripe payment intent links
- Amount and currency
- Payment status

### 🛡️ Moderation

#### `moderation_logs` Table
Content moderation tracking.
- OpenAI moderation API results
- Flagged content categories
- Action taken

#### `user_violations` Table
Policy violation tracking.
- Progressive enforcement
- Auto-expiring suspensions
- Violation history

## Helper Functions

### Core Functions
- **`get_user_stats(user_id)`**: Returns user dashboard statistics
- **`track_event(event_type, data)`**: Records analytics events
- **`check_rate_limit(user_id, type)`**: Enforces rate limits
- **`daily_cleanup()`**: Maintenance tasks

### Search Functions
- **`search_messages()`**: Full-text search across messages
- **`get_conversations_with_last_message()`**: Optimized conversation list

## Automatic Triggers

### Activity Tracking
- **`track_new_conversation`**: Records conversation creation events
- **`update_user_last_seen`**: Updates last activity timestamp
- **`welcome_new_user`**: Sends welcome notification

## Security Model

### Row Level Security (RLS)
All tables have RLS enabled with optimized policies:

- **User Data**: Users can only access their own data
- **Conversations**: Full CRUD for owned conversations
- **Messages**: Create/read for user's own messages
- **Analytics**: Read-only access to own events
- **Notifications**: Full control over own notifications

### Policy Optimization
Using `(SELECT auth.uid())` instead of `auth.uid()` prevents re-evaluation per row, significantly improving performance.

## Migration History

1. **001_initial_schema.sql**: Core tables setup
2. **002_chat_search_functions.sql**: Search functionality
3. **003_chat_optimization.sql**: Performance improvements
4. **004_security_fixes.sql**: RLS policies
5. **005_performance_optimizations.sql**: Index optimization
6. **006_startup_essentials.sql**: Analytics, feedback, rate limiting

## Storage Estimates (Free Tier)

For up to 100 active users:
- **Conversations**: ~5,000 rows (~1 MB)
- **Messages**: ~50,000 rows (~50 MB)
- **Analytics Events**: ~30,000 rows (~10 MB)
- **Total Database Size**: < 100 MB (well within 500 MB free tier)

## Maintenance Schedule

### Automated Tasks
- **Every Day**: `daily_cleanup()` removes old analytics and notifications
- **Real-time**: Activity tracking via triggers
- **On-demand**: Statistics calculation via functions

## Future Scaling Path

When you reach key milestones, refer to `/project-documentation/scaling-roadmap.md` for:

- **Phase 1 (10-100 users)**: Current implementation sufficient
- **Phase 2 (100-1,000 users)**: Add caching, upgrade to Pro tier
- **Phase 3 (1,000-10,000 users)**: Team features, advanced analytics
- **Phase 4 (10,000+ users)**: Enterprise features from archived migrations

## Quick Start Queries

```sql
-- Check user statistics
SELECT * FROM get_user_stats(auth.uid());

-- View active users
SELECT * FROM active_users_summary;

-- Check rate limits for a user
SELECT check_rate_limit('user-uuid', 'messages');

-- Track custom event
SELECT track_event('feature_used', '{"feature": "export"}'::jsonb);

-- Get user feedback
SELECT * FROM user_feedback 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Cost Analysis

**Current Monthly Cost**: $0
- Supabase Free Tier: 500 MB database, 2 GB bandwidth
- No external services required
- Rate limiting prevents abuse

**When to Upgrade**: 
- At ~50 active daily users
- When needing team features
- When requiring higher rate limits

---

*Last Updated: 2025-01-09*
*Next Review: When reaching 50 active users*
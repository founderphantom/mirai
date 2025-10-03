# Unified Database Schema - MiraiChat
## Production-Ready Schema for 10k+ Users with Voice AI

**Version:** 4.0 - Unified Architecture
**Last Updated:** January 2025
**Target Scale:** 10,000+ concurrent users, 1M+ conversations/month

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Core User & Profile Tables](#core-user--profile-tables)
3. [Character & Marketplace Tables](#character--marketplace-tables)
4. [Relationship & Emotional State Tables](#relationship--emotional-state-tables)
5. [Conversation & Memory Tables](#conversation--memory-tables)
6. [Voice Session Tables](#voice-session-tables)
7. [Billing & Subscriptions](#billing--subscriptions)
8. [Analytics & Metrics](#analytics--metrics)
9. [Moderation & Safety](#moderation--safety)
10. [Indexes & Performance](#indexes--performance)
11. [Data Retention & Archival](#data-retention--archival)
12. [Migration from Legacy Schema](#migration-from-legacy-schema)

---

## Schema Overview

### Architecture Decisions

**Why Cloudflare D1 (SQLite)?**
- Global edge distribution (330+ datacenters)
- Sub-50ms query latency
- No egress fees (D1 → Workers = FREE)
- Automatic replication
- $5/mo for 25M reads + 50M writes

**Schema Design Principles**
1. **Denormalization for performance** - Pre-compute aggregates
2. **Time-based partitioning** - Separate hot/cold data
3. **Composite indexes** - Optimize multi-column queries
4. **JSON for flexibility** - Store complex objects when schema varies
5. **Worker-enforced constraints** - D1 has no foreign keys, handle in code

### Data Flow

```
User Auth (Supabase) → Profile Creation (D1) → Character Purchase (D1 + Stripe)
                                                        ↓
                                                Voice Session (Durable Objects)
                                                        ↓
                                    ┌──────────────────┴───────────────────┐
                                    ↓                                      ↓
                            Conversations (D1)                    Relationships (D1)
                                    ↓                                      ↓
                            Vectorize Embeddings              Emotional State Updates
                                    ↓                                      ↓
                            Memory Highlights (D1)            Analytics (D1)
```

---

## Core User & Profile Tables

### profiles
User profile data (id from Supabase Auth)

```sql
CREATE TABLE profiles (
  -- Identity (from Supabase Auth)
  id TEXT PRIMARY KEY,              -- Supabase user.id
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,                  -- R2 URL

  -- User type
  is_creator INTEGER DEFAULT 0,     -- Boolean: 0/1
  is_premium INTEGER DEFAULT 0,     -- Boolean: 0/1
  is_admin INTEGER DEFAULT 0,       -- Boolean: 0/1

  -- Preferences (JSON)
  preferences TEXT,                 -- {theme, language, notifications}

  -- Stats (denormalized for fast access)
  total_conversations INTEGER DEFAULT 0,
  total_voice_minutes INTEGER DEFAULT 0,
  total_characters_owned INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER NOT NULL,      -- Unix timestamp
  updated_at INTEGER NOT NULL,      -- Unix timestamp
  last_active_at INTEGER            -- Unix timestamp
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_creator ON profiles(is_creator) WHERE is_creator = 1;
CREATE INDEX idx_profiles_last_active ON profiles(last_active_at DESC);
```

### creator_profiles
Extended data for marketplace creators

```sql
CREATE TABLE creator_profiles (
  id TEXT PRIMARY KEY,              -- Same as profiles.id

  -- Creator info
  creator_name TEXT NOT NULL,
  bio TEXT,
  banner_url TEXT,                  -- R2 URL
  social_links TEXT,                -- JSON: {twitter, discord, website}

  -- Verification
  verified INTEGER DEFAULT 0,       -- Boolean: 0/1
  verified_at INTEGER,              -- Unix timestamp

  -- Stats (updated by triggers/workers)
  total_characters INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  avg_rating REAL DEFAULT 0,

  -- Payout info (encrypted)
  stripe_account_id TEXT,
  payout_method TEXT,               -- 'stripe', 'paypal'

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_creator_verified ON creator_profiles(verified) WHERE verified = 1;
CREATE INDEX idx_creator_rating ON creator_profiles(avg_rating DESC);
```

---

## Character & Marketplace Tables

### marketplace_characters
Base character templates (sold in marketplace)

```sql
CREATE TABLE marketplace_characters (
  id TEXT PRIMARY KEY,

  -- Creator
  creator_id TEXT NOT NULL,         -- References profiles(id)

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  tagline TEXT,

  -- Pricing
  price REAL NOT NULL,              -- USD
  is_free INTEGER DEFAULT 0,        -- Boolean: 0/1

  -- Assets (R2 URLs)
  model_url TEXT NOT NULL,          -- Live2D model.json
  thumbnail_url TEXT,
  preview_video_url TEXT,

  -- Personality (JSON)
  personality TEXT NOT NULL,        -- {traits, backstory, speaking_style, interests}
  default_emotional_state TEXT,     -- {primary, secondary, intensity, baseline_mood}

  -- Voice settings (JSON)
  voice_config TEXT,                -- {inworld_character_id, voice_id, emotion_range}

  -- Categories & Tags
  category TEXT,                    -- 'anime', 'realistic', 'fantasy', etc.
  tags TEXT,                        -- JSON array: ["tag1", "tag2"]

  -- Stats (denormalized)
  total_purchases INTEGER DEFAULT 0,
  total_owners INTEGER DEFAULT 0,   -- Unique users who own it
  rating REAL DEFAULT 0,            -- Average rating
  review_count INTEGER DEFAULT 0,

  -- Visibility
  is_published INTEGER DEFAULT 0,   -- Boolean: 0/1
  is_featured INTEGER DEFAULT 0,    -- Boolean: 0/1
  published_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_marketplace_creator ON marketplace_characters(creator_id);
CREATE INDEX idx_marketplace_category ON marketplace_characters(category);
CREATE INDEX idx_marketplace_price ON marketplace_characters(price);
CREATE INDEX idx_marketplace_published ON marketplace_characters(is_published, published_at DESC);
CREATE INDEX idx_marketplace_rating ON marketplace_characters(rating DESC);
CREATE INDEX idx_marketplace_popularity ON marketplace_characters(total_purchases DESC);
```

### user_characters
User-owned character instances (purchased or created)

```sql
CREATE TABLE user_characters (
  id TEXT PRIMARY KEY,

  -- Ownership
  user_id TEXT NOT NULL,            -- References profiles(id)
  character_id TEXT NOT NULL,       -- References marketplace_characters(id)

  -- Customization (overrides marketplace defaults)
  custom_name TEXT,                 -- User can rename
  custom_personality TEXT,          -- JSON: Override personality traits
  custom_voice_config TEXT,         -- JSON: Voice customization

  -- Current State (updated in real-time by voice agent)
  current_emotional_state TEXT,     -- JSON: Current emotion state
  current_mood TEXT,                -- 'happy', 'sad', 'neutral', etc.
  last_emotion_update INTEGER,      -- Unix timestamp

  -- Stats
  total_interactions INTEGER DEFAULT 0,
  total_voice_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  -- Timestamps
  acquired_at INTEGER NOT NULL,     -- When user got this character
  last_interaction_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_user_characters_unique ON user_characters(user_id, character_id);
CREATE INDEX idx_user_characters_user ON user_characters(user_id);
CREATE INDEX idx_user_characters_character ON user_characters(character_id);
CREATE INDEX idx_user_characters_last_interaction ON user_characters(user_id, last_interaction_at DESC);
```

---

## Relationship & Emotional State Tables

### relationships
**NEW TABLE** - Relationship state between user and character

```sql
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,

  -- Relationship
  user_id TEXT NOT NULL,            -- References profiles(id)
  character_id TEXT NOT NULL,       -- References user_characters(id)

  -- Relationship Metrics (0-100 scale)
  level INTEGER DEFAULT 0,          -- Overall relationship level
  affection REAL DEFAULT 0,         -- Emotional closeness
  trust REAL DEFAULT 0,             -- Built over consistent interactions
  familiarity REAL DEFAULT 0,       -- How well they know each other

  -- Interaction Stats
  interaction_count INTEGER DEFAULT 0,
  total_conversation_time INTEGER DEFAULT 0,  -- Seconds
  longest_conversation INTEGER DEFAULT 0,     -- Seconds

  -- Relationship Type (evolves over time)
  relationship_type TEXT DEFAULT 'stranger',  -- 'stranger', 'acquaintance', 'friend', 'close_friend', 'best_friend'

  -- Milestones (JSON array of unlocked milestones)
  milestones TEXT DEFAULT '[]',     -- [{level, name, unlocked_at}, ...]

  -- Traits (JSON - relationship-specific personality traits that develop)
  relationship_traits TEXT,         -- {playful: 0.8, protective: 0.6, shy: 0.2}

  -- Timestamps
  first_interaction_at INTEGER NOT NULL,
  last_interaction_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(user_id, character_id)
);

CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_relationships_character ON relationships(character_id);
CREATE INDEX idx_relationships_level ON relationships(user_id, level DESC);
CREATE INDEX idx_relationships_last_interaction ON relationships(last_interaction_at DESC);
```

### emotional_states
**NEW TABLE** - Track emotional state changes over time

```sql
CREATE TABLE emotional_states (
  id TEXT PRIMARY KEY,

  -- Context
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,       -- References user_characters(id)
  session_id TEXT,                  -- References voice_sessions(id) or NULL for text

  -- Emotional State
  primary_emotion TEXT NOT NULL,    -- 'happy', 'sad', 'excited', 'calm', etc.
  secondary_emotion TEXT,           -- Underlying emotion
  intensity REAL NOT NULL,          -- 0.0 - 1.0

  -- Triggers (what caused this emotion)
  trigger_event TEXT,               -- 'user_message', 'topic_change', 'memory_recalled'
  trigger_content TEXT,             -- The actual message/event

  -- Duration tracking
  duration_seconds INTEGER,         -- How long in this state
  trend TEXT,                       -- 'rising', 'falling', 'stable'

  -- Timestamp
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_emotional_states_user_char ON emotional_states(user_id, character_id);
CREATE INDEX idx_emotional_states_session ON emotional_states(session_id);
CREATE INDEX idx_emotional_states_timestamp ON emotional_states(created_at DESC);
-- Composite index for recent emotions by character
CREATE INDEX idx_emotional_states_recent ON emotional_states(character_id, created_at DESC);
```

---

## Conversation & Memory Tables

### conversation_sessions
**UPDATED** - Voice or text conversation sessions

```sql
CREATE TABLE conversation_sessions (
  id TEXT PRIMARY KEY,

  -- Participants
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,       -- References user_characters(id)

  -- Session Type
  session_type TEXT NOT NULL,       -- 'voice' or 'text'

  -- Voice-specific (NULL for text sessions)
  voice_session_id TEXT,            -- References voice_sessions(id)
  meeting_id TEXT,                  -- RealtimeKit meeting ID

  -- Session Metrics
  total_messages INTEGER DEFAULT 0,
  user_messages INTEGER DEFAULT 0,
  character_messages INTEGER DEFAULT 0,

  -- Timing
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_seconds INTEGER,

  -- Quality Metrics (for voice)
  avg_latency_ms INTEGER,
  interruption_count INTEGER DEFAULT 0,

  -- Summary (generated post-session)
  summary TEXT,                     -- AI-generated summary
  key_topics TEXT,                  -- JSON array of topics discussed
  emotional_arc TEXT,               -- JSON: Start and end emotions

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_conv_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_conv_sessions_character ON conversation_sessions(character_id);
CREATE INDEX idx_conv_sessions_type ON conversation_sessions(session_type);
CREATE INDEX idx_conv_sessions_start ON conversation_sessions(start_time DESC);
-- Composite index for user's recent sessions
CREATE INDEX idx_conv_sessions_user_recent ON conversation_sessions(user_id, start_time DESC);
```

### conversations
**UPDATED** - Individual messages (supports both voice and text)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,

  -- Context
  session_id TEXT NOT NULL,         -- References conversation_sessions(id)
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,

  -- Message
  role TEXT NOT NULL,               -- 'user' or 'assistant'
  content TEXT NOT NULL,

  -- Emotion & Context (for character messages)
  emotion TEXT,                     -- Primary emotion
  emotion_intensity REAL,           -- 0.0 - 1.0
  emotional_state_id TEXT,          -- References emotional_states(id)

  -- Voice-specific metadata
  audio_url TEXT,                   -- R2 URL for voice recording (optional)
  transcription_confidence REAL,    -- STT confidence score
  speech_duration_ms INTEGER,       -- Length of audio

  -- Memory importance (for Vectorize storage decision)
  importance_score REAL DEFAULT 0.5, -- 0.0 - 1.0
  is_memory_highlight INTEGER DEFAULT 0,  -- Boolean: stored in Vectorize
  vector_id TEXT,                   -- Vectorize ID if stored

  -- Metadata
  metadata TEXT,                    -- JSON: {stt_model, llm_model, tts_voice, etc.}

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_character ON conversations(character_id);
CREATE INDEX idx_conversations_timestamp ON conversations(created_at DESC);
CREATE INDEX idx_conversations_importance ON conversations(importance_score DESC);
-- Composite index for session messages in order
CREATE INDEX idx_conversations_session_order ON conversations(session_id, created_at);
-- Composite index for user-character conversation history
CREATE INDEX idx_conversations_user_char_history ON conversations(user_id, character_id, created_at DESC);
```

### memory_highlights
**UPDATED** - Important memories stored in both D1 and Vectorize

```sql
CREATE TABLE memory_highlights (
  id TEXT PRIMARY KEY,

  -- Context
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  conversation_id TEXT,             -- References conversations(id) - source message

  -- Memory Content
  content TEXT NOT NULL,
  summary TEXT,                     -- Condensed version for context window

  -- Classification
  memory_type TEXT,                 -- 'personal_info', 'shared_experience', 'preference', 'event'
  topics TEXT,                      -- JSON array: ["topic1", "topic2"]

  -- Importance & Retrieval
  importance REAL NOT NULL,         -- 0.0 - 1.0
  access_count INTEGER DEFAULT 0,   -- How often retrieved
  last_accessed INTEGER,            -- Unix timestamp

  -- Vectorize Integration
  vector_id TEXT UNIQUE,            -- Vectorize ID
  embedding_model TEXT,             -- Model used for embedding

  -- Context (JSON)
  context TEXT,                     -- {emotional_state, relationship_level, location, etc.}

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_memory_user_character ON memory_highlights(user_id, character_id);
CREATE INDEX idx_memory_importance ON memory_highlights(importance DESC);
CREATE INDEX idx_memory_type ON memory_highlights(memory_type);
CREATE INDEX idx_memory_last_accessed ON memory_highlights(last_accessed DESC);
-- Composite index for recent important memories
CREATE INDEX idx_memory_recent_important ON memory_highlights(user_id, character_id, importance DESC, created_at DESC);
```

---

## Voice Session Tables

### voice_sessions
**NEW TABLE** - Real-time voice session state (managed by Durable Objects)

```sql
CREATE TABLE voice_sessions (
  id TEXT PRIMARY KEY,

  -- Participants
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,

  -- RealtimeKit Connection
  meeting_id TEXT UNIQUE NOT NULL,
  auth_token TEXT NOT NULL,
  ice_servers TEXT,                 -- JSON array of ICE server configs

  -- Session State
  status TEXT DEFAULT 'active',     -- 'active', 'ended', 'error'

  -- Durable Object
  durable_object_id TEXT,           -- DO stub ID
  durable_object_location TEXT,     -- Edge location

  -- Audio Configuration
  audio_config TEXT,                -- JSON: {sampleRate, channels, codec}

  -- Real-time Metrics (updated by DO)
  current_emotion TEXT,
  current_latency_ms INTEGER,
  total_exchanges INTEGER DEFAULT 0,
  total_interruptions INTEGER DEFAULT 0,

  -- Timing
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  last_activity_at INTEGER,

  -- Error Handling
  error_message TEXT,
  error_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_voice_sessions_user ON voice_sessions(user_id);
CREATE INDEX idx_voice_sessions_character ON voice_sessions(character_id);
CREATE INDEX idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX idx_voice_sessions_meeting ON voice_sessions(meeting_id);
CREATE INDEX idx_voice_sessions_started ON voice_sessions(started_at DESC);
```

### voice_session_events
**NEW TABLE** - Granular events during voice sessions (for analytics)

```sql
CREATE TABLE voice_session_events (
  id TEXT PRIMARY KEY,

  session_id TEXT NOT NULL,         -- References voice_sessions(id)

  -- Event Type
  event_type TEXT NOT NULL,         -- 'user_spoke', 'character_responded', 'interruption', 'error', 'emotion_change'

  -- Event Data (JSON)
  event_data TEXT,                  -- {latency, emotion, error_code, etc.}

  -- Metrics
  latency_ms INTEGER,               -- For performance tracking

  -- Timestamp
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_voice_events_session ON voice_session_events(session_id);
CREATE INDEX idx_voice_events_type ON voice_session_events(event_type);
CREATE INDEX idx_voice_events_timestamp ON voice_session_events(created_at DESC);
-- Composite index for session event timeline
CREATE INDEX idx_voice_events_session_timeline ON voice_session_events(session_id, created_at);
```

---

## Billing & Subscriptions

### subscriptions
User subscription state

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,    -- One subscription per user

  -- Tier
  tier TEXT NOT NULL,               -- 'free', 'premium', 'enterprise'
  status TEXT DEFAULT 'active',     -- 'active', 'cancelled', 'past_due', 'trialing'

  -- Stripe Integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,

  -- Billing Period
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at INTEGER,

  -- Usage Limits
  monthly_voice_minutes_limit INTEGER,
  monthly_voice_minutes_used INTEGER DEFAULT 0,
  monthly_messages_limit INTEGER,
  monthly_messages_used INTEGER DEFAULT 0,

  -- Features
  max_characters INTEGER,           -- How many characters user can own
  can_create_characters INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
```

### purchases
Marketplace purchases

```sql
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,

  -- Transaction
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,       -- References marketplace_characters(id)

  -- Payment
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Stripe
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending',    -- 'pending', 'completed', 'refunded', 'failed'

  -- Revenue Split (80% creator, 20% platform)
  creator_revenue REAL,
  platform_revenue REAL,
  creator_id TEXT,                  -- References creator_profiles(id)

  -- Timestamps
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_character ON purchases(character_id);
CREATE INDEX idx_purchases_creator ON purchases(creator_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_completed ON purchases(completed_at DESC);
```

### usage_logs
**UPDATED** - Detailed usage tracking for billing

```sql
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,

  -- User
  user_id TEXT NOT NULL,

  -- Resource
  resource_type TEXT NOT NULL,      -- 'voice_minutes', 'messages', 'storage_mb', 'api_calls'
  amount REAL NOT NULL,

  -- Context
  session_id TEXT,                  -- References conversation_sessions(id) or voice_sessions(id)
  character_id TEXT,

  -- Cost Tracking
  cost_usd REAL,                    -- Actual cost (for internal accounting)

  -- Timestamp
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_usage_user_resource ON usage_logs(user_id, resource_type);
CREATE INDEX idx_usage_session ON usage_logs(session_id);
CREATE INDEX idx_usage_timestamp ON usage_logs(created_at DESC);
-- Composite index for billing queries
CREATE INDEX idx_usage_billing ON usage_logs(user_id, created_at DESC, resource_type);
```

---

## Analytics & Metrics

### character_analytics
Daily character performance metrics

```sql
CREATE TABLE character_analytics (
  id TEXT PRIMARY KEY,

  character_id TEXT NOT NULL,
  date INTEGER NOT NULL,            -- Unix timestamp (midnight UTC)

  -- Engagement
  unique_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_voice_minutes INTEGER DEFAULT 0,

  -- Marketplace
  views INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,

  -- Quality
  avg_session_duration_seconds INTEGER DEFAULT 0,
  avg_user_rating REAL DEFAULT 0,

  UNIQUE(character_id, date)
);

CREATE INDEX idx_char_analytics_character ON character_analytics(character_id, date DESC);
CREATE INDEX idx_char_analytics_revenue ON character_analytics(revenue DESC);
```

### user_engagement_metrics
**NEW TABLE** - User engagement and retention

```sql
CREATE TABLE user_engagement_metrics (
  id TEXT PRIMARY KEY,

  user_id TEXT NOT NULL,
  date INTEGER NOT NULL,            -- Unix timestamp (midnight UTC)

  -- Daily Activity
  sessions_count INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  voice_minutes INTEGER DEFAULT 0,
  characters_used INTEGER DEFAULT 0, -- Unique characters interacted with

  -- Engagement Quality
  avg_session_duration_seconds INTEGER DEFAULT 0,
  longest_session_seconds INTEGER DEFAULT 0,

  -- Retention Signals
  days_since_signup INTEGER,
  days_active_this_week INTEGER DEFAULT 0,
  is_retained INTEGER DEFAULT 1,    -- Boolean: active this period

  UNIQUE(user_id, date)
);

CREATE INDEX idx_user_engagement_user ON user_engagement_metrics(user_id, date DESC);
CREATE INDEX idx_user_engagement_retention ON user_engagement_metrics(is_retained, date);
```

### voice_quality_metrics
**NEW TABLE** - Voice session quality and performance

```sql
CREATE TABLE voice_quality_metrics (
  id TEXT PRIMARY KEY,

  session_id TEXT NOT NULL UNIQUE,  -- References voice_sessions(id)

  -- Latency Metrics (milliseconds)
  avg_e2e_latency INTEGER,          -- End-to-end average
  p95_e2e_latency INTEGER,          -- 95th percentile
  avg_stt_latency INTEGER,
  avg_llm_latency INTEGER,
  avg_tts_latency INTEGER,

  -- Quality Metrics
  avg_stt_confidence REAL,          -- Transcription accuracy
  interruption_rate REAL,           -- Interruptions per minute
  error_count INTEGER DEFAULT 0,

  -- Usage
  total_user_speech_seconds INTEGER,
  total_character_speech_seconds INTEGER,
  total_silence_seconds INTEGER,

  -- Network
  avg_bandwidth_kbps INTEGER,
  packet_loss_rate REAL,

  -- Timestamp
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_voice_quality_session ON voice_quality_metrics(session_id);
CREATE INDEX idx_voice_quality_latency ON voice_quality_metrics(avg_e2e_latency);
CREATE INDEX idx_voice_quality_created ON voice_quality_metrics(created_at DESC);
```

### platform_analytics
Daily platform-wide metrics

```sql
CREATE TABLE platform_analytics (
  id TEXT PRIMARY KEY,
  date INTEGER NOT NULL UNIQUE,    -- Unix timestamp (midnight UTC)

  -- User Metrics
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,   -- DAU
  new_users INTEGER DEFAULT 0,

  -- Engagement
  total_sessions INTEGER DEFAULT 0,
  total_voice_minutes INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  -- Revenue
  total_revenue REAL DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  total_subscriptions INTEGER DEFAULT 0,

  -- Performance
  avg_voice_latency_ms INTEGER,
  error_rate REAL                   -- Errors per 1000 requests
);

CREATE INDEX idx_platform_analytics_date ON platform_analytics(date DESC);
```

---

## Moderation & Safety

### character_reviews
User reviews for marketplace characters

```sql
CREATE TABLE character_reviews (
  id TEXT PRIMARY KEY,

  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,

  -- Review
  rating INTEGER NOT NULL,          -- 1-5
  review_text TEXT,

  -- Moderation
  is_flagged INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(user_id, character_id)
);

CREATE INDEX idx_reviews_character ON character_reviews(character_id);
CREATE INDEX idx_reviews_rating ON character_reviews(rating DESC);
CREATE INDEX idx_reviews_flagged ON character_reviews(is_flagged) WHERE is_flagged = 1;
```

### moderation_queue
Content moderation queue

```sql
CREATE TABLE moderation_queue (
  id TEXT PRIMARY KEY,

  -- Content Reference
  content_type TEXT NOT NULL,       -- 'character', 'review', 'message', 'profile'
  content_id TEXT NOT NULL,

  -- Flagging
  status TEXT DEFAULT 'pending',    -- 'pending', 'approved', 'rejected'
  auto_flagged INTEGER DEFAULT 0,   -- Boolean: auto vs manual flag
  flag_reasons TEXT,                -- JSON array: ["reason1", "reason2"]
  severity TEXT,                    -- 'low', 'medium', 'high', 'critical'

  -- Review
  reviewer_id TEXT,                 -- References profiles(id)
  review_notes TEXT,
  reviewed_at INTEGER,

  -- Action Taken
  action_taken TEXT,                -- 'approved', 'edited', 'removed', 'user_warned', 'user_banned'

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_moderation_status ON moderation_queue(status);
CREATE INDEX idx_moderation_type ON moderation_queue(content_type);
CREATE INDEX idx_moderation_severity ON moderation_queue(severity, status);
CREATE INDEX idx_moderation_created ON moderation_queue(created_at DESC);
```

### user_reports
**NEW TABLE** - User-submitted reports

```sql
CREATE TABLE user_reports (
  id TEXT PRIMARY KEY,

  -- Reporter
  reporter_id TEXT NOT NULL,        -- References profiles(id)

  -- Reported Content
  reported_type TEXT NOT NULL,      -- 'character', 'user', 'message'
  reported_id TEXT NOT NULL,

  -- Report Details
  reason TEXT NOT NULL,             -- 'inappropriate', 'spam', 'harassment', 'copyright'
  description TEXT,

  -- Status
  status TEXT DEFAULT 'pending',    -- 'pending', 'investigating', 'resolved', 'dismissed'
  resolution TEXT,                  -- Action taken
  resolved_by TEXT,                 -- References profiles(id)
  resolved_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_reports_reporter ON user_reports(reporter_id);
CREATE INDEX idx_reports_reported ON user_reports(reported_type, reported_id);
CREATE INDEX idx_reports_status ON user_reports(status);
CREATE INDEX idx_reports_created ON user_reports(created_at DESC);
```

---

## Indexes & Performance

### Composite Indexes for Common Queries

```sql
-- User's character library (sorted by last interaction)
CREATE INDEX idx_user_library ON user_characters(user_id, last_interaction_at DESC);

-- User's recent conversations with a character
CREATE INDEX idx_user_char_conversations ON conversations(user_id, character_id, created_at DESC);

-- User's relationship progress
CREATE INDEX idx_user_relationships ON relationships(user_id, level DESC);

-- Marketplace browse (published, sorted by popularity)
CREATE INDEX idx_marketplace_browse ON marketplace_characters(is_published, total_purchases DESC) WHERE is_published = 1;

-- Marketplace browse by rating
CREATE INDEX idx_marketplace_top_rated ON marketplace_characters(is_published, rating DESC) WHERE is_published = 1;

-- Creator's characters
CREATE INDEX idx_creator_characters ON marketplace_characters(creator_id, created_at DESC);

-- Session messages in chronological order
CREATE INDEX idx_session_messages ON conversations(session_id, created_at);

-- User's voice sessions
CREATE INDEX idx_user_voice_sessions ON voice_sessions(user_id, started_at DESC);

-- Recent memory highlights by importance
CREATE INDEX idx_recent_memories ON memory_highlights(user_id, character_id, importance DESC, last_accessed DESC);

-- Billing period usage
CREATE INDEX idx_billing_usage ON usage_logs(user_id, created_at DESC) WHERE resource_type IN ('voice_minutes', 'messages');
```

### Partial Indexes (SQLite 3.8+)

```sql
-- Active subscriptions only
CREATE INDEX idx_active_subscriptions ON subscriptions(user_id) WHERE status = 'active';

-- Published characters only
CREATE INDEX idx_published_characters ON marketplace_characters(category, total_purchases DESC) WHERE is_published = 1;

-- Flagged content for moderation
CREATE INDEX idx_flagged_content ON moderation_queue(content_type, created_at DESC) WHERE status = 'pending';

-- Active voice sessions
CREATE INDEX idx_active_voice_sessions ON voice_sessions(character_id, started_at DESC) WHERE status = 'active';
```

---

## Data Retention & Archival

### Retention Policy

```sql
-- Conversation messages: 90 days hot, 1 year archive, then delete
-- Voice sessions: 30 days hot, 6 months archive
-- Analytics: Aggregate daily → weekly → monthly, keep monthly forever
-- Error logs: 7 days
```

### archived_conversations
**NEW TABLE** - Older conversations (read-only, cheaper storage)

```sql
CREATE TABLE archived_conversations (
  id TEXT PRIMARY KEY,

  -- Same schema as conversations, but for messages older than 90 days
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  emotion TEXT,
  emotion_intensity REAL,

  -- Compressed metadata
  metadata_json TEXT,               -- All metadata in one JSON field

  created_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL
);

CREATE INDEX idx_archived_user_char ON archived_conversations(user_id, character_id, created_at DESC);
```

### data_retention_jobs
**NEW TABLE** - Track archival and cleanup jobs

```sql
CREATE TABLE data_retention_jobs (
  id TEXT PRIMARY KEY,

  job_type TEXT NOT NULL,           -- 'archive', 'delete', 'aggregate'
  table_name TEXT NOT NULL,

  -- Date Range
  date_from INTEGER NOT NULL,
  date_to INTEGER NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending',    -- 'pending', 'running', 'completed', 'failed'

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_archived INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,

  error_message TEXT,

  -- Timing
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_retention_jobs_status ON data_retention_jobs(status, created_at);
```

---

## Migration from Legacy Schema

### Migration Strategy

**Phase 1: Add New Tables**
```sql
-- Add all new tables: relationships, emotional_states, voice_sessions, etc.
-- Existing tables continue to work
```

**Phase 2: Dual Write**
```typescript
// Update Workers to write to both old and new schemas
async function saveConversation(message: Message) {
  await Promise.all([
    // Old schema (voice-agent.md)
    saveToLegacyConversations(message),

    // New unified schema
    saveToConversations(message),
    saveToEmotionalStates(message.emotion),
    updateRelationship(message.userId, message.characterId)
  ]);
}
```

**Phase 3: Backfill Data**
```sql
-- Migrate existing data to new tables
INSERT INTO relationships (user_id, character_id, level, affection, trust, interaction_count, created_at, updated_at)
SELECT
  user_id,
  companion_id as character_id,
  level,
  affection,
  trust,
  interaction_count,
  created_at,
  updated_at
FROM old_relationships;
```

**Phase 4: Switch to New Schema**
```typescript
// Update Workers to only use new schema
// Old tables become read-only for historical queries
```

**Phase 5: Archive Legacy Tables**
```sql
-- Rename old tables
ALTER TABLE old_conversations RENAME TO legacy_conversations_backup;

-- Keep for 30 days, then drop
DROP TABLE legacy_conversations_backup;
```

---

## Application-Layer Constraints

**IMPORTANT:** D1 (SQLite) has no foreign keys or triggers. Implement in Workers:

```typescript
// 1. Updated_at timestamps
await env.DB.prepare(
  'UPDATE profiles SET display_name = ?, updated_at = ? WHERE id = ?'
).bind(newName, Date.now(), userId).run();

// 2. Denormalized stats (character rating)
async function updateCharacterRating(characterId: string) {
  const stats = await env.DB.prepare(`
    SELECT
      AVG(rating) as avg_rating,
      COUNT(*) as review_count
    FROM character_reviews
    WHERE character_id = ?
  `).bind(characterId).first();

  await env.DB.prepare(`
    UPDATE marketplace_characters
    SET rating = ?, review_count = ?, updated_at = ?
    WHERE id = ?
  `).bind(stats.avg_rating, stats.review_count, Date.now(), characterId).run();
}

// 3. Transaction batching
const results = await env.DB.batch([
  env.DB.prepare('INSERT INTO conversations ...').bind(...),
  env.DB.prepare('UPDATE relationships ...').bind(...),
  env.DB.prepare('INSERT INTO emotional_states ...').bind(...)
]);
```

---

## Performance Optimization Tips

### 1. Query Optimization
```typescript
// BAD: N+1 query problem
for (const char of characters) {
  const relationship = await getRelationship(userId, char.id);
  // ...
}

// GOOD: Join or batch query
const relationships = await env.DB.prepare(`
  SELECT r.*, c.name, c.avatar_url
  FROM relationships r
  JOIN user_characters c ON r.character_id = c.id
  WHERE r.user_id = ?
`).bind(userId).all();
```

### 2. Caching Strategy
```typescript
// Cache frequently accessed data in KV
const CACHE_TTL = 3600; // 1 hour

async function getCharacterPersonality(characterId: string) {
  // Check cache first
  const cached = await env.CACHE.get(`personality:${characterId}`, 'json');
  if (cached) return cached;

  // Query D1
  const personality = await env.DB.prepare('...');

  // Cache result
  await env.CACHE.put(
    `personality:${characterId}`,
    JSON.stringify(personality),
    { expirationTtl: CACHE_TTL }
  );

  return personality;
}
```

### 3. Pagination
```typescript
// Use cursor-based pagination for large datasets
async function getConversationHistory(
  userId: string,
  characterId: string,
  cursor?: string,
  limit = 50
) {
  let query = env.DB.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ? AND character_id = ?
    ${cursor ? 'AND created_at < ?' : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const bindings = cursor
    ? [userId, characterId, cursor, limit]
    : [userId, characterId, limit];

  const results = await query.bind(...bindings).all();

  return {
    messages: results.results,
    nextCursor: results.results[results.results.length - 1]?.created_at
  };
}
```

---

## Schema Versioning

```sql
-- Track schema version for migrations
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at INTEGER NOT NULL
);

INSERT INTO schema_version (version, description, applied_at)
VALUES (4, 'Unified schema with voice AI support', unixepoch());
```

---

## Next Steps

1. **Review this schema** with your team
2. **Update voice-agent.md** to reference this unified schema
3. **Update production-saas-architecture.md** to use this schema
4. **Create migration scripts** for existing data
5. **Update Worker code** to use new tables
6. **Add schema validation** in Workers (use Zod)
7. **Create seed data** for development/testing
8. **Set up automated backups** (D1 → R2)

---

**Questions? Concerns? Let's discuss the schema before implementing!**

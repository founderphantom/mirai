-- AIRI SaaS Platform Database Schema
-- Version: 1.0.0
-- Description: Initial schema setup for user management, chat history, and usage tracking

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For embeddings (pgvector)
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For compound indexes

-- =============================================
-- USER MANAGEMENT
-- =============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'pro', 'enterprise')),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    daily_message_count INTEGER DEFAULT 0,
    total_message_count BIGINT DEFAULT 0,
    last_message_reset_at TIMESTAMPTZ DEFAULT NOW(),
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user profiles
CREATE INDEX idx_user_profiles_subscription_tier ON public.user_profiles(subscription_tier);
CREATE INDEX idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);

-- =============================================
-- CHAT HISTORY STORAGE
-- =============================================

-- Chat conversations (conversation threads)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255),
    summary TEXT,
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    avatar_id VARCHAR(100),
    voice_id VARCHAR(100),
    personality_template VARCHAR(100),
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    settings JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages (individual messages in conversations)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function', 'tool')),
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'video', 'file', 'code')),
    attachments JSONB DEFAULT '[]', -- Array of attachment objects
    
    -- Token tracking
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Model information
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    
    -- Response metadata
    response_time_ms INTEGER, -- Time taken to generate response
    finish_reason VARCHAR(50), -- stop, length, content_filter, etc.
    
    -- Moderation
    flagged_for_moderation BOOLEAN DEFAULT FALSE,
    moderation_results JSONB DEFAULT '{}',
    
    -- Function/Tool calls
    function_call JSONB, -- For function calling features
    tool_calls JSONB[], -- For multiple tool calls
    
    -- User feedback
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- For semantic search (requires pgvector)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ -- Soft delete
);

-- Message attachments (files, images, etc.)
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for chat tables
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_conversations_is_archived ON public.conversations(is_archived);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_role ON public.chat_messages(role);
CREATE INDEX idx_chat_messages_content_search ON public.chat_messages USING gin(to_tsvector('english', content));

-- =============================================
-- USAGE TRACKING AND ANALYTICS
-- =============================================

-- API usage logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Token usage
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Cost tracking
    provider_id VARCHAR(50),
    model_id VARCHAR(100),
    estimated_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Performance metrics
    response_time_ms INTEGER,
    queue_time_ms INTEGER,
    processing_time_ms INTEGER,
    
    -- Request/Response data
    request_headers JSONB,
    request_body JSONB,
    response_headers JSONB,
    response_size_bytes INTEGER,
    
    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily usage aggregates (for faster queries)
CREATE TABLE IF NOT EXISTS public.usage_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Message counts
    message_count INTEGER DEFAULT 0,
    conversation_count INTEGER DEFAULT 0,
    
    -- Token usage
    total_prompt_tokens BIGINT DEFAULT 0,
    total_completion_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    
    -- Cost tracking
    total_estimated_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Provider breakdown
    provider_usage JSONB DEFAULT '{}', -- {openai: 100, anthropic: 50, ...}
    model_usage JSONB DEFAULT '{}', -- {gpt-4: 50, claude-3: 50, ...}
    
    -- Feature usage
    voice_minutes_used INTEGER DEFAULT 0,
    image_generations INTEGER DEFAULT 0,
    function_calls INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- Create indexes for usage tables
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_endpoint ON public.usage_logs(endpoint);
CREATE INDEX idx_usage_logs_status_code ON public.usage_logs(status_code);

CREATE INDEX idx_usage_daily_aggregates_user_id_date ON public.usage_daily_aggregates(user_id, date DESC);

-- =============================================
-- SUBSCRIPTION AND BILLING
-- =============================================

-- Subscription history
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history
CREATE TABLE IF NOT EXISTS public.payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for billing tables
CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_stripe_subscription_id ON public.subscription_history(stripe_subscription_id);
CREATE INDEX idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX idx_payment_history_stripe_payment_intent_id ON public.payment_history(stripe_payment_intent_id);

-- =============================================
-- MODERATION AND SAFETY
-- =============================================

-- Moderation logs
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    flagged BOOLEAN DEFAULT FALSE,
    categories JSONB DEFAULT '{}',
    scores JSONB DEFAULT '{}',
    action_taken VARCHAR(50), -- warned, blocked, suspended, etc.
    reviewed_by UUID REFERENCES public.user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User violations
CREATE TABLE IF NOT EXISTS public.user_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    action_taken VARCHAR(50),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for moderation tables
CREATE INDEX idx_moderation_logs_user_id ON public.moderation_logs(user_id);
CREATE INDEX idx_moderation_logs_flagged ON public.moderation_logs(flagged);
CREATE INDEX idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);
CREATE INDEX idx_user_violations_user_id ON public.user_violations(user_id);
CREATE INDEX idx_user_violations_severity ON public.user_violations(severity);

-- =============================================
-- SYSTEM CONFIGURATION
-- =============================================

-- System settings (for dynamic configuration)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider health status
CREATE TABLE IF NOT EXISTS public.provider_health (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'maintenance')),
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    success_rate DECIMAL(5,2),
    average_response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_daily_aggregates_updated_at BEFORE UPDATE ON public.usage_daily_aggregates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_health_updated_at BEFORE UPDATE ON public.provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment message count and update last_message_at
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        message_count = message_count + 1,
        last_message_at = NEW.created_at,
        total_tokens_used = total_tokens_used + COALESCE(NEW.total_tokens, 0)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_stats_on_message AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Function to update user daily message count
CREATE OR REPLACE FUNCTION update_user_message_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset daily count if it's a new day
    UPDATE public.user_profiles
    SET 
        daily_message_count = CASE 
            WHEN DATE(last_message_reset_at) < CURRENT_DATE THEN 1
            ELSE daily_message_count + 1
        END,
        total_message_count = total_message_count + 1,
        last_message_reset_at = CASE 
            WHEN DATE(last_message_reset_at) < CURRENT_DATE THEN NOW()
            ELSE last_message_reset_at
        END
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_message_count_on_message AFTER INSERT ON public.chat_messages
    FOR EACH ROW 
    WHEN (NEW.role = 'user')
    EXECUTE FUNCTION update_user_message_count();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON public.conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view their own messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for usage_logs
CREATE POLICY "Users can view their own usage logs" ON public.usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for usage_daily_aggregates
CREATE POLICY "Users can view their own usage aggregates" ON public.usage_daily_aggregates
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for subscription_history
CREATE POLICY "Users can view their own subscription history" ON public.subscription_history
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for payment_history
CREATE POLICY "Users can view their own payment history" ON public.payment_history
    FOR SELECT USING (auth.uid() = user_id);

-- Public read access for system settings (only public ones)
CREATE POLICY "Public can view public system settings" ON public.system_settings
    FOR SELECT USING (is_public = true);

-- Public read access for provider health
CREATE POLICY "Public can view provider health" ON public.provider_health
    FOR SELECT USING (true);

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description, category, is_public) VALUES
    ('rate_limits', '{"free": {"messages_per_day": 50, "requests_per_hour": 100}, "plus": {"messages_per_day": 500, "requests_per_hour": 500}, "pro": {"messages_per_day": -1, "requests_per_hour": 5000}}', 'Rate limiting configuration per tier', 'limits', true),
    ('subscription_tiers', '{"free": {"price": 0, "features": ["basic_chat", "50_messages"]}, "plus": {"price": 25, "features": ["advanced_chat", "500_messages", "voice", "custom_avatar"]}, "pro": {"price": 99, "features": ["unlimited_chat", "priority_support", "api_access", "gaming"]}}', 'Subscription tier configuration', 'billing', true),
    ('maintenance_mode', '{"enabled": false, "message": null}', 'Maintenance mode settings', 'system', true),
    ('moderation_thresholds', '{"hate": 0.7, "violence": 0.8, "sexual": 0.7, "self_harm": 0.8}', 'Content moderation thresholds', 'moderation', false)
ON CONFLICT (key) DO NOTHING;

-- Insert initial provider health records
INSERT INTO public.provider_health (id, name, status) VALUES
    ('openai', 'OpenAI', 'healthy'),
    ('anthropic', 'Anthropic', 'healthy'),
    ('google', 'Google AI', 'healthy'),
    ('groq', 'Groq', 'healthy'),
    ('elevenlabs', 'ElevenLabs', 'healthy')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- GRANTS (for service account)
-- =============================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read access to anonymous users for public data
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT ON public.provider_health TO anon;
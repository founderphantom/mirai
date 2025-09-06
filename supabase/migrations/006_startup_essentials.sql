-- Migration: Startup Essentials - Lean & Cost-Effective
-- Date: 2025-01-09
-- Description: Minimal essential features for pre-revenue startup
-- Priority: HIGH - Just enough to launch and iterate

-- =============================================
-- SCHEMA UPDATES FOR EXISTING TABLES
-- =============================================

-- Add last_seen_at column to user_profiles if it doesn't exist
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Add token_count column to chat_messages if it doesn't exist
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;

-- =============================================
-- BASIC ANALYTICS (No external services needed)
-- =============================================

-- Simple analytics events table (lighter than full audit logging)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- 'signup', 'login', 'message_sent', 'conversation_created', etc.
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic index for queries
CREATE INDEX idx_analytics_user_event ON public.analytics_events(user_id, event_type, created_at DESC);
-- Use created_at directly for daily queries (will use date_trunc in queries instead)
CREATE INDEX idx_analytics_daily ON public.analytics_events(created_at, event_type);

-- =============================================
-- USER FEEDBACK (Critical for product-market fit)
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    feedback_type TEXT NOT NULL, -- 'bug', 'feature_request', 'general'
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    conversation_id UUID REFERENCES public.conversations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_type ON public.user_feedback(feedback_type, created_at DESC);

-- =============================================
-- WAITLIST (For building pre-launch momentum)
-- =============================================

CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    referral_source TEXT, -- 'twitter', 'producthunt', 'friend', etc.
    interested_in TEXT[], -- ['api', 'teams', 'enterprise']
    created_at TIMESTAMPTZ DEFAULT NOW(),
    converted_to_user_at TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_waitlist_email ON public.waitlist(email);
CREATE INDEX idx_waitlist_source ON public.waitlist(referral_source);

-- =============================================
-- SIMPLE RATE LIMITING (Prevent abuse on free tier)
-- =============================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    daily_messages INTEGER DEFAULT 0,
    daily_conversations INTEGER DEFAULT 0,
    last_reset_at DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_limit_type TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
    v_last_reset DATE;
BEGIN
    -- Get current counts
    SELECT 
        CASE p_limit_type 
            WHEN 'messages' THEN daily_messages
            WHEN 'conversations' THEN daily_conversations
        END,
        last_reset_at
    INTO v_count, v_last_reset
    FROM public.rate_limits
    WHERE user_id = p_user_id;
    
    -- Create record if doesn't exist
    IF NOT FOUND THEN
        INSERT INTO public.rate_limits (user_id) VALUES (p_user_id);
        v_count := 0;
        v_last_reset := CURRENT_DATE;
    END IF;
    
    -- Reset if new day
    IF v_last_reset < CURRENT_DATE THEN
        UPDATE public.rate_limits
        SET daily_messages = 0,
            daily_conversations = 0,
            last_reset_at = CURRENT_DATE
        WHERE user_id = p_user_id;
        v_count := 0;
    END IF;
    
    -- Check limits based on subscription (hardcoded for now)
    v_limit := CASE p_limit_type
        WHEN 'messages' THEN 100  -- Free tier: 100 messages/day
        WHEN 'conversations' THEN 10  -- Free tier: 10 new conversations/day
    END;
    
    -- Update count if under limit
    IF v_count + p_increment <= v_limit THEN
        UPDATE public.rate_limits
        SET 
            daily_messages = CASE p_limit_type 
                WHEN 'messages' THEN daily_messages + p_increment 
                ELSE daily_messages 
            END,
            daily_conversations = CASE p_limit_type 
                WHEN 'conversations' THEN daily_conversations + p_increment 
                ELSE daily_conversations 
            END,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BASIC USER INSIGHTS (For product decisions)
-- =============================================

-- Simple view for active users (no materialized view overhead)
CREATE OR REPLACE VIEW public.active_users_summary AS
SELECT 
    DATE(created_at) as signup_date,
    COUNT(*) as total_users,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '1 day' THEN 1 END) as daily_active,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN 1 END) as weekly_active,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '30 days' THEN 1 END) as monthly_active
FROM public.user_profiles
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

-- Simple view for feature usage
CREATE OR REPLACE VIEW public.feature_usage AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
    COUNT(CASE WHEN role = 'assistant' THEN 1 END) as ai_responses,
    AVG(token_count) as avg_tokens_per_message
FROM public.chat_messages
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- =============================================
-- SIMPLE NOTIFICATION SYSTEM
-- =============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type TEXT NOT NULL, -- 'system', 'feature', 'limit_warning'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================
-- HELPER FUNCTIONS FOR COMMON QUERIES
-- =============================================

-- Get user stats (for dashboard)
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_conversations', COUNT(DISTINCT c.id),
        'total_messages', COUNT(DISTINCT m.id),
        'conversations_this_week', COUNT(DISTINCT CASE 
            WHEN c.created_at > NOW() - INTERVAL '7 days' THEN c.id 
        END),
        'messages_today', COUNT(DISTINCT CASE 
            WHEN m.created_at > NOW() - INTERVAL '1 day' THEN m.id 
        END),
        'total_tokens_used', COALESCE(SUM(m.token_count), 0)
    ) INTO v_stats
    FROM public.conversations c
    LEFT JOIN public.chat_messages m ON m.conversation_id = c.id
    WHERE c.user_id = p_user_id
        AND c.deleted_at IS NULL
        AND m.deleted_at IS NULL;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql STABLE;

-- Track important events
CREATE OR REPLACE FUNCTION public.track_event(
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.analytics_events (user_id, event_type, event_data)
    VALUES (auth.uid(), p_event_type, p_event_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS FOR AUTOMATIC TRACKING
-- =============================================

-- Track new conversations
CREATE OR REPLACE FUNCTION public.track_conversation_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.analytics_events (user_id, event_type, event_data)
    VALUES (
        NEW.user_id, 
        'conversation_created',
        jsonb_build_object('conversation_id', NEW.id, 'model', NEW.model)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER track_new_conversation
    AFTER INSERT ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.track_conversation_created();

-- Track user activity
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET last_seen_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_user_last_seen
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- =============================================
-- RLS POLICIES FOR NEW TABLES
-- =============================================

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users view own analytics" ON public.analytics_events
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users manage own feedback" ON public.user_feedback
    FOR ALL USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users view own rate limits" ON public.rate_limits
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users manage own notifications" ON public.notifications
    FOR ALL USING (user_id = (SELECT auth.uid()));

-- =============================================
-- CLEANUP & OPTIMIZATION
-- =============================================

-- Simple cleanup function (runs daily)
CREATE OR REPLACE FUNCTION public.daily_cleanup()
RETURNS VOID AS $$
BEGIN
    -- Delete old analytics events (keep 30 days)
    DELETE FROM public.analytics_events
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete read notifications older than 7 days
    DELETE FROM public.notifications
    WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '7 days';
    
    -- Update basic statistics
    ANALYZE public.chat_messages;
    ANALYZE public.conversations;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Add welcome notification for new users
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        NEW.id,
        'system',
        'Welcome to MIRAI!',
        'Thanks for joining! Start by creating your first conversation. Need help? Just ask!'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER welcome_new_user
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.send_welcome_notification();

COMMENT ON TABLE public.analytics_events IS 'Lightweight event tracking for product analytics';
COMMENT ON TABLE public.user_feedback IS 'User feedback for product improvement';
COMMENT ON TABLE public.waitlist IS 'Pre-launch waitlist and conversion tracking';
COMMENT ON TABLE public.rate_limits IS 'Simple rate limiting for free tier users';
COMMENT ON TABLE public.notifications IS 'In-app notifications for users';
COMMENT ON FUNCTION public.check_rate_limit IS 'Check and update rate limits for free tier';
COMMENT ON FUNCTION public.get_user_stats IS 'Get basic user statistics for dashboard';
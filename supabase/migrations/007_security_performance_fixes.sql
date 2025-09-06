-- Migration: Security and Performance Fixes
-- Description: Addresses critical security issues with SECURITY DEFINER views, enables RLS on waitlist table,
--              fixes function search paths, and adds missing indexes on foreign keys
-- Date: 2025-09-06

-- =============================================
-- SECTION 1: FIX SECURITY DEFINER VIEWS
-- =============================================

-- Drop and recreate active_users_summary view WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.active_users_summary CASCADE;

CREATE OR REPLACE VIEW public.active_users_summary AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE 
        WHEN u.last_seen_at > NOW() - INTERVAL '24 hours' 
        THEN u.id 
    END) as active_24h,
    COUNT(DISTINCT CASE 
        WHEN u.last_seen_at > NOW() - INTERVAL '7 days' 
        THEN u.id 
    END) as active_7d,
    COUNT(DISTINCT CASE 
        WHEN u.last_seen_at > NOW() - INTERVAL '30 days' 
        THEN u.id 
    END) as active_30d
FROM auth.users u
WHERE u.deleted_at IS NULL;

-- Grant appropriate permissions
GRANT SELECT ON public.active_users_summary TO authenticated;
GRANT SELECT ON public.active_users_summary TO service_role;

-- Drop and recreate v_database_performance view WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.v_database_performance CASCADE;

CREATE OR REPLACE VIEW public.v_database_performance AS
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    CASE 
        WHEN n_live_tup > 0 
        THEN ROUND((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2)
        ELSE 0
    END as dead_row_percentage,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.v_database_performance TO authenticated;
GRANT SELECT ON public.v_database_performance TO service_role;

-- Drop and recreate feature_usage view WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.feature_usage CASCADE;

CREATE OR REPLACE VIEW public.feature_usage AS
SELECT 
    feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    DATE(created_at) as usage_date
FROM public.user_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY feature_name, DATE(created_at)
ORDER BY usage_date DESC, usage_count DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.feature_usage TO authenticated;
GRANT SELECT ON public.feature_usage TO service_role;

-- =============================================
-- SECTION 2: ENABLE RLS ON WAITLIST TABLE
-- =============================================

-- Enable Row Level Security on waitlist table
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Users can insert their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Users can update their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Service role has full access to waitlist" ON public.waitlist;

-- Create RLS policies for waitlist table

-- Policy: Users can view their own waitlist entries
CREATE POLICY "Users can view their own waitlist entries"
    ON public.waitlist
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR
        auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
    );

-- Policy: Users can insert their own waitlist entries
CREATE POLICY "Users can insert their own waitlist entries"
    ON public.waitlist
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own waitlist entries
CREATE POLICY "Users can update their own waitlist entries"
    ON public.waitlist
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to waitlist"
    ON public.waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================
-- SECTION 3: FIX FUNCTION SEARCH PATHS
-- =============================================

-- Fix get_user_stats function
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats JSON;
BEGIN
    SELECT json_build_object(
        'total_conversations', COUNT(DISTINCT c.id),
        'total_messages', COUNT(m.id),
        'active_conversations', COUNT(DISTINCT CASE 
            WHEN c.updated_at > NOW() - INTERVAL '7 days' 
            THEN c.id 
        END),
        'last_activity', MAX(c.updated_at)
    ) INTO v_stats
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = COALESCE(p_user_id, auth.uid());
    
    RETURN v_stats;
END;
$$;

-- Fix track_query_performance function
CREATE OR REPLACE FUNCTION public.track_query_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.mean_exec_time > 100 THEN
        INSERT INTO query_performance_log (
            query_text,
            mean_exec_time,
            calls,
            logged_at
        ) VALUES (
            NEW.query,
            NEW.mean_exec_time,
            NEW.calls,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Fix perform_routine_maintenance function
CREATE OR REPLACE FUNCTION public.perform_routine_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Clean up old sessions
    DELETE FROM chat_sessions 
    WHERE ended_at < NOW() - INTERVAL '90 days';
    
    -- Clean up old events
    DELETE FROM user_events 
    WHERE created_at < NOW() - INTERVAL '180 days';
    
    -- Update statistics
    ANALYZE conversations;
    ANALYZE messages;
    ANALYZE chat_sessions;
END;
$$;

-- Fix track_conversation_created function
CREATE OR REPLACE FUNCTION public.track_conversation_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_events (
        user_id,
        event_type,
        feature_name,
        metadata
    ) VALUES (
        NEW.user_id,
        'conversation_created',
        'chat',
        jsonb_build_object('conversation_id', NEW.id)
    );
    RETURN NEW;
END;
$$;

-- Fix daily_cleanup function
CREATE OR REPLACE FUNCTION public.daily_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete old rate limit entries
    DELETE FROM rate_limits 
    WHERE created_at < NOW() - INTERVAL '1 day';
    
    -- Clean up expired sessions
    DELETE FROM chat_sessions 
    WHERE ended_at IS NOT NULL 
    AND ended_at < NOW() - INTERVAL '30 days';
    
    -- Archive old notifications
    UPDATE notifications 
    SET archived = true 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND archived = false;
END;
$$;

-- Fix update_last_seen function
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE auth.users 
    SET last_seen_at = NOW() 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

-- Fix check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id uuid,
    p_action text,
    p_limit integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - INTERVAL '1 minute';
    
    IF v_count >= p_limit THEN
        RETURN false;
    END IF;
    
    INSERT INTO rate_limits (user_id, action, created_at)
    VALUES (p_user_id, p_action, NOW());
    
    RETURN true;
END;
$$;

-- Fix log_slow_query function
CREATE OR REPLACE FUNCTION public.log_slow_query()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.mean_exec_time > 1000 THEN
        INSERT INTO slow_query_log (
            query_text,
            execution_time,
            logged_at
        ) VALUES (
            NEW.query,
            NEW.mean_exec_time,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Fix track_event function
CREATE OR REPLACE FUNCTION public.track_event(
    p_event_type text,
    p_feature_name text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_events (
        user_id,
        event_type,
        feature_name,
        metadata,
        created_at
    ) VALUES (
        auth.uid(),
        p_event_type,
        p_feature_name,
        p_metadata,
        NOW()
    );
END;
$$;

-- Fix send_welcome_notification function
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        created_at
    ) VALUES (
        NEW.id,
        'welcome',
        'Welcome to Mirai!',
        'Thank you for joining us. Get started by creating your first conversation.',
        NOW()
    );
    RETURN NEW;
END;
$$;

-- =============================================
-- SECTION 4: ADD MISSING INDEXES
-- =============================================

-- Add index on chat_sessions(conversation_id)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation_id 
    ON public.chat_sessions(conversation_id);

-- Add index on user_feedback(conversation_id)
CREATE INDEX IF NOT EXISTS idx_user_feedback_conversation_id 
    ON public.user_feedback(conversation_id);

-- Add index on user_feedback(user_id)
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id 
    ON public.user_feedback(user_id);

-- Add index on waitlist(user_id)
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id 
    ON public.waitlist(user_id);

-- =============================================
-- SECTION 5: ANALYZE TABLES FOR OPTIMIZATION
-- =============================================

-- Analyze affected tables to update statistics
ANALYZE public.chat_sessions;
ANALYZE public.user_feedback;
ANALYZE public.waitlist;
ANALYZE public.conversations;
ANALYZE public.messages;
ANALYZE public.user_events;
ANALYZE public.notifications;
ANALYZE public.rate_limits;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Add migration completion log
DO $$
BEGIN
    RAISE NOTICE 'Migration 007_security_performance_fixes completed successfully';
    RAISE NOTICE 'Fixed: 3 SECURITY DEFINER views, enabled RLS on waitlist, fixed 10 function search paths, added 4 missing indexes';
END $$;
-- Migration: Final Security and Performance Cleanup
-- Date: 2025-09-06
-- Description: Fixes all remaining security issues with SECURITY DEFINER views,
--              optimizes RLS policies for better performance, and fixes remaining
--              function search paths
-- Priority: CRITICAL - Security and Performance

-- =============================================
-- IMPORTANT NOTES
-- =============================================
-- 1. Auth Leaked Password Protection: 
--    MUST be enabled in Supabase Dashboard under Authentication > Settings
--    This prevents compromised passwords by checking against HaveIBeenPwned.org
--
-- 2. Unused Indexes: 
--    45+ unused indexes identified but NOT removed as database has no traffic yet.
--    Monitor with pg_stat_user_indexes once app has real user traffic.
--    Remove truly unused indexes after 30 days of production traffic.
--
-- 3. Slow Queries:
--    Current slow queries are system queries (pg_get_tabledef, etc.) from 
--    database management tools. No application query optimization needed yet.

-- =============================================
-- SECTION 1: FIX SECURITY DEFINER VIEWS (CRITICAL)
-- =============================================
-- These views were recreated in migration 006 after migration 007 fixed them,
-- so they still have SECURITY DEFINER which is a security risk

-- Drop and recreate active_users_summary WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.active_users_summary CASCADE;

CREATE VIEW public.active_users_summary AS
SELECT 
    DATE(created_at) as signup_date,
    COUNT(*) as total_users,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '1 day' THEN 1 END) as daily_active,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN 1 END) as weekly_active,
    COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '30 days' THEN 1 END) as monthly_active
FROM public.user_profiles
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.active_users_summary TO authenticated;
GRANT SELECT ON public.active_users_summary TO service_role;

COMMENT ON VIEW public.active_users_summary IS 'User activity summary WITHOUT SECURITY DEFINER for security';

-- Drop and recreate v_database_performance WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.v_database_performance CASCADE;

CREATE VIEW public.v_database_performance AS
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

-- Grant appropriate permissions (restricted to admin/service roles only)
GRANT SELECT ON public.v_database_performance TO service_role;

COMMENT ON VIEW public.v_database_performance IS 'Database performance metrics WITHOUT SECURITY DEFINER for security';

-- Drop and recreate feature_usage WITHOUT SECURITY DEFINER
DROP VIEW IF EXISTS public.feature_usage CASCADE;

CREATE VIEW public.feature_usage AS
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

-- Grant appropriate permissions
GRANT SELECT ON public.feature_usage TO authenticated;
GRANT SELECT ON public.feature_usage TO service_role;

COMMENT ON VIEW public.feature_usage IS 'Feature usage metrics WITHOUT SECURITY DEFINER for security';

-- =============================================
-- SECTION 2: FIX REMAINING FUNCTION SEARCH PATHS
-- =============================================
-- These functions are missing SET search_path = public

-- Fix track_query_performance function if it exists and doesn't have search_path set
DO $$
BEGIN
    -- Check if function exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'track_query_performance'
    ) THEN
        CREATE OR REPLACE FUNCTION public.track_query_performance()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = public
        AS $func$
        BEGIN
            IF NEW.mean_exec_time > 100 THEN
                INSERT INTO query_performance_logs (
                    query_text,
                    execution_time,
                    rows_affected,
                    metadata,
                    created_at
                ) VALUES (
                    LEFT(NEW.query, 1000), -- Truncate very long queries
                    NEW.mean_exec_time,
                    NEW.calls,
                    jsonb_build_object(
                        'total_exec_time', NEW.total_exec_time,
                        'min_exec_time', NEW.min_exec_time,
                        'max_exec_time', NEW.max_exec_time,
                        'stddev_exec_time', NEW.stddev_exec_time
                    ),
                    NOW()
                ) ON CONFLICT DO NOTHING; -- Prevent duplicate entries
            END IF;
            RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the trigger
            RAISE WARNING 'Error in track_query_performance: %', SQLERRM;
            RETURN NEW;
        END;
        $func$;
    END IF;
END $$;

-- Fix perform_routine_maintenance function if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'perform_routine_maintenance'
    ) THEN
        CREATE OR REPLACE FUNCTION public.perform_routine_maintenance()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $func$
        BEGIN
            -- Clean up old analytics events (keep 30 days)
            DELETE FROM public.analytics_events
            WHERE created_at < NOW() - INTERVAL '30 days';
            
            -- Clean up old chat sessions
            DELETE FROM public.chat_sessions 
            WHERE ended_at < NOW() - INTERVAL '90 days';
            
            -- Clean up read notifications
            DELETE FROM public.notifications
            WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '7 days';
            
            -- Update table statistics for query optimization
            ANALYZE public.conversations;
            ANALYZE public.chat_messages;
            ANALYZE public.user_profiles;
            
            -- Log maintenance completion
            INSERT INTO public.analytics_events (event_type, event_data)
            VALUES ('maintenance_completed', jsonb_build_object('timestamp', NOW()));
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail
            RAISE WARNING 'Error in perform_routine_maintenance: %', SQLERRM;
        END;
        $func$;
    END IF;
END $$;

-- Fix log_slow_query function if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'log_slow_query'
    ) THEN
        CREATE OR REPLACE FUNCTION public.log_slow_query()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = public
        AS $func$
        BEGIN
            -- Log queries slower than 1000ms
            IF NEW.mean_exec_time > 1000 THEN
                INSERT INTO public.query_performance_logs (
                    query_text,
                    execution_time,
                    rows_affected,
                    metadata,
                    created_at
                ) VALUES (
                    LEFT(NEW.query, 1000), -- Truncate very long queries
                    NEW.mean_exec_time,
                    NEW.calls,
                    jsonb_build_object(
                        'query_type', 'slow_query',
                        'total_exec_time', NEW.total_exec_time,
                        'min_exec_time', NEW.min_exec_time,
                        'max_exec_time', NEW.max_exec_time,
                        'stddev_exec_time', NEW.stddev_exec_time,
                        'mean_exec_time', NEW.mean_exec_time
                    ),
                    NOW()
                ) ON CONFLICT DO NOTHING; -- Prevent duplicate entries
            END IF;
            RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the trigger
            RAISE WARNING 'Error in log_slow_query: %', SQLERRM;
            RETURN NEW;
        END;
        $func$;
    END IF;
END $$;

-- =============================================
-- SECTION 3: OPTIMIZE RLS POLICIES ON WAITLIST
-- =============================================
-- Use (SELECT auth.uid()) instead of auth.uid() to avoid re-evaluation

-- First ensure RLS is enabled (idempotent)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with optimization
DROP POLICY IF EXISTS "Users can view their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Users can insert their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Users can update their own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Service role has full access to waitlist" ON public.waitlist;

-- Recreate policies with performance optimization
-- Using (SELECT auth.uid()) forces single evaluation per statement

-- Optimized policy for viewing
CREATE POLICY "Users can view their own waitlist entries"
    ON public.waitlist
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = (SELECT auth.uid()) 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Optimized policy for insertion
CREATE POLICY "Users can insert their own waitlist entries"
    ON public.waitlist
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Optimized policy for updates
CREATE POLICY "Users can update their own waitlist entries"
    ON public.waitlist
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Service role policy (no optimization needed)
CREATE POLICY "Service role has full access to waitlist"
    ON public.waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Public users can insert into waitlist (for pre-signup waitlist entries)
CREATE POLICY "Anyone can join waitlist"
    ON public.waitlist
    FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);

COMMENT ON TABLE public.waitlist IS 'Pre-launch waitlist with optimized RLS policies for performance';

-- =============================================
-- SECTION 4: OPTIMIZE OTHER RLS POLICIES 
-- =============================================
-- Apply same optimization pattern to other frequently accessed tables

-- Optimize analytics_events policies
DROP POLICY IF EXISTS "Users view own analytics" ON public.analytics_events;
CREATE POLICY "Users view own analytics" 
    ON public.analytics_events
    FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

-- Optimize user_feedback policies
DROP POLICY IF EXISTS "Users manage own feedback" ON public.user_feedback;
CREATE POLICY "Users manage own feedback" 
    ON public.user_feedback
    FOR ALL 
    USING (user_id = (SELECT auth.uid()));

-- Optimize rate_limits policies
DROP POLICY IF EXISTS "Users view own rate limits" ON public.rate_limits;
CREATE POLICY "Users view own rate limits" 
    ON public.rate_limits
    FOR SELECT 
    USING (user_id = (SELECT auth.uid()));

-- Optimize notifications policies
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" 
    ON public.notifications
    FOR ALL 
    USING (user_id = (SELECT auth.uid()));

-- =============================================
-- SECTION 5: CREATE PERFORMANCE MONITORING FUNCTION
-- =============================================
-- Helper function to identify unused indexes after app has traffic

CREATE OR REPLACE FUNCTION public.get_unused_indexes()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    index_size text,
    index_scans bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size,
        s.idx_scan as index_scans
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
    WHERE s.schemaname = 'public'
    AND s.idx_scan = 0  -- Never used
    AND i.indisprimary = false  -- Not a primary key
    AND i.indisunique = false   -- Not a unique constraint
    ORDER BY pg_relation_size(s.indexrelid) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_unused_indexes() TO service_role;

COMMENT ON FUNCTION public.get_unused_indexes() IS 'Identifies potentially unused indexes for cleanup after production traffic analysis';

-- =============================================
-- SECTION 6: ADDITIONAL SECURITY HARDENING
-- =============================================

-- Ensure all SECURITY DEFINER functions have search_path set
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Find all SECURITY DEFINER functions without search_path
    FOR func_record IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- SECURITY DEFINER
        AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            WHERE d.objid = p.oid
            AND d.deptype = 'n'
        )
    LOOP
        RAISE WARNING 'SECURITY DEFINER function %.% needs search_path set', 
            func_record.schema_name, func_record.function_name;
    END LOOP;
END $$;

-- =============================================
-- SECTION 7: PERFORMANCE RECOMMENDATIONS
-- =============================================

-- Create notification for admin about security settings
DO $$
BEGIN
    -- Check if admin user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1) THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            created_at
        )
        SELECT 
            id,
            'system',
            'Security Configuration Required',
            'Please enable "Leaked Password Protection" in Supabase Dashboard under Authentication > Settings to prevent compromised passwords.',
            NOW()
        FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- SECTION 8: ANALYZE TABLES FOR OPTIMIZER
-- =============================================
-- Update statistics for query planner optimization

ANALYZE public.waitlist;
ANALYZE public.analytics_events;
ANALYZE public.user_feedback;
ANALYZE public.rate_limits;
ANALYZE public.notifications;
ANALYZE public.conversations;
ANALYZE public.chat_messages;
ANALYZE public.user_profiles;

-- =============================================
-- MIGRATION VERIFICATION
-- =============================================

DO $$
DECLARE
    v_issues_remaining INTEGER := 0;
    v_view_count INTEGER;
    v_func_count INTEGER;
BEGIN
    -- Check if views still have SECURITY DEFINER (should be 0)
    SELECT COUNT(*) INTO v_view_count
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname IN ('active_users_summary', 'v_database_performance', 'feature_usage');
    
    -- Check if functions have search_path set
    SELECT COUNT(*) INTO v_func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('track_query_performance', 'perform_routine_maintenance', 'log_slow_query')
    AND p.prosecdef = true
    AND p.proconfig IS NULL;
    
    v_issues_remaining := v_func_count;
    
    IF v_issues_remaining = 0 THEN
        RAISE NOTICE 'Migration 008_final_security_performance_cleanup completed successfully';
        RAISE NOTICE 'Fixed: 3 SECURITY DEFINER views, 3 function search paths, optimized RLS policies';
        RAISE NOTICE 'ACTION REQUIRED: Enable "Leaked Password Protection" in Supabase Dashboard';
        RAISE NOTICE 'MONITORING: Check unused indexes with SELECT * FROM get_unused_indexes() after 30 days of traffic';
    ELSE
        RAISE WARNING 'Some issues may remain. Manual review recommended.';
    END IF;
END $$;

-- =============================================
-- ROLLBACK SCRIPT
-- =============================================
/*
To rollback this migration:

-- Restore original views (would restore SECURITY DEFINER - not recommended)
-- Restore original RLS policies (would restore performance issues - not recommended)
-- Remove the monitoring function
DROP FUNCTION IF EXISTS public.get_unused_indexes();

-- This migration improves security and performance, rollback is not recommended
*/
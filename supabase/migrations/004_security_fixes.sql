-- Migration: Security Fixes for RLS Issues
-- Date: 2025-09-04
-- Description: Enable RLS on exposed tables and add missing policies
-- Priority: CRITICAL - Security vulnerabilities

-- =============================================
-- 1. ENABLE RLS ON EXPOSED TABLES
-- =============================================

-- Enable RLS on partition tables
ALTER TABLE public.chat_messages_y2025m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_y2025m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_partitioned ENABLE ROW LEVEL SECURITY;

-- Enable RLS on session and cache tables
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on system tables (already have policies but RLS disabled)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. ADD MISSING RLS POLICIES
-- =============================================

-- Policies for message_attachments (RLS enabled but no policies)
CREATE POLICY "Users can view attachments for their messages" ON public.message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_messages 
            WHERE chat_messages.id = message_attachments.message_id 
            AND chat_messages.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can create attachments for their messages" ON public.message_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_messages 
            WHERE chat_messages.id = message_attachments.message_id 
            AND chat_messages.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can delete attachments for their messages" ON public.message_attachments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.chat_messages 
            WHERE chat_messages.id = message_attachments.message_id 
            AND chat_messages.user_id = (SELECT auth.uid())
        )
    );

-- Policies for moderation_logs (RLS enabled but no policies)
CREATE POLICY "Users can view their own moderation logs" ON public.moderation_logs
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role can manage moderation logs" ON public.moderation_logs
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies for user_violations (RLS enabled but no policies)
CREATE POLICY "Users can view their own violations" ON public.user_violations
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role can manage user violations" ON public.user_violations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- 3. POLICIES FOR PARTITION TABLES
-- =============================================

-- Policies for chat message partitions (inherit from parent)
CREATE POLICY "Users can view their own messages" ON public.chat_messages_y2025m01
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own messages" ON public.chat_messages_y2025m01
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own messages" ON public.chat_messages_y2025m01
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own messages" ON public.chat_messages_y2025m02
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own messages" ON public.chat_messages_y2025m02
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own messages" ON public.chat_messages_y2025m02
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Policies for parent partition table
CREATE POLICY "Users can view their own messages" ON public.chat_messages_partitioned
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own messages" ON public.chat_messages_partitioned
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own messages" ON public.chat_messages_partitioned
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- =============================================
-- 4. POLICIES FOR SESSION AND CACHE TABLES
-- =============================================

-- Policies for chat_sessions
CREATE POLICY "Users can view their own sessions" ON public.chat_sessions
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own sessions" ON public.chat_sessions
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own sessions" ON public.chat_sessions
    FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Policies for cache_entries (service role only)
CREATE POLICY "Service role can manage cache entries" ON public.cache_entries
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies for query_performance_logs
CREATE POLICY "Users can view their own query logs" ON public.query_performance_logs
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role can manage query logs" ON public.query_performance_logs
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- 5. FIX FUNCTION SEARCH PATHS
-- =============================================

-- Set search_path for all functions to prevent search path injection
ALTER FUNCTION public.cleanup_expired_cache() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_or_set_cache(text, jsonb, interval) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversation_summary(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_inactive_sessions() SET search_path = public, pg_catalog;
ALTER FUNCTION public.log_query_performance(text, integer, integer, jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.refresh_recent_conversations() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_popular_topics(uuid, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_old_messages(integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_monthly_partition() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_conversation_stats() SET search_path = public, pg_catalog;
ALTER FUNCTION public.archive_old_conversations(uuid, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.export_conversation_json(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_user_usage_stats(uuid, date, date) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversation_messages(uuid, uuid, integer, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_daily_usage_aggregate() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversations_with_last_message(uuid, integer, integer, boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.search_messages(uuid, text, integer, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_user_message_count() SET search_path = public, pg_catalog;

-- =============================================
-- 6. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =============================================

-- Add indexes for unindexed foreign keys (performance improvement)
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id 
    ON public.message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_message_id 
    ON public.moderation_logs(message_id);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_reviewed_by 
    ON public.moderation_logs(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_query_performance_logs_user_id 
    ON public.query_performance_logs(user_id);

-- =============================================
-- ROLLBACK SCRIPT
-- =============================================
-- To rollback this migration, run:
/*
-- Disable RLS on tables
ALTER TABLE public.chat_messages_y2025m01 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_y2025m02 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_partitioned DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health DISABLE ROW LEVEL SECURITY;

-- Drop created policies
DROP POLICY IF EXISTS "Users can view attachments for their messages" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can create attachments for their messages" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can delete attachments for their messages" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can view their own moderation logs" ON public.moderation_logs;
DROP POLICY IF EXISTS "Service role can manage moderation logs" ON public.moderation_logs;
DROP POLICY IF EXISTS "Users can view their own violations" ON public.user_violations;
DROP POLICY IF EXISTS "Service role can manage user violations" ON public.user_violations;
-- ... (continue for all policies)

-- Drop indexes
DROP INDEX IF EXISTS idx_message_attachments_message_id;
DROP INDEX IF EXISTS idx_moderation_logs_message_id;
DROP INDEX IF EXISTS idx_moderation_logs_reviewed_by;
DROP INDEX IF EXISTS idx_query_performance_logs_user_id;
*/
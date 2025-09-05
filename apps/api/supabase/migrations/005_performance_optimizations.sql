-- Migration: Performance Optimizations for RLS Policies
-- Date: 2025-09-04
-- Description: Optimize RLS policies to prevent re-evaluation of auth functions for each row
-- Priority: HIGH - Performance impact at scale

-- =============================================
-- OPTIMIZE RLS POLICIES FOR PERFORMANCE
-- =============================================
-- Replace auth.uid() with (SELECT auth.uid()) to prevent re-evaluation per row
-- This creates an InitPlan that evaluates once per query, not once per row

-- Drop and recreate policies for user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (id = (SELECT auth.uid()));

-- Drop and recreate policies for conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations" ON public.conversations
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own conversations" ON public.conversations
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own conversations" ON public.conversations
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own conversations" ON public.conversations
    FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Drop and recreate policies for chat_messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.chat_messages;

CREATE POLICY "Users can view their own messages" ON public.chat_messages
    FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own messages" ON public.chat_messages
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own messages" ON public.chat_messages
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Drop and recreate policies for usage_logs
DROP POLICY IF EXISTS "Users can view their own usage logs" ON public.usage_logs;

CREATE POLICY "Users can view their own usage logs" ON public.usage_logs
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Drop and recreate policies for usage_daily_aggregates
DROP POLICY IF EXISTS "Users can view their own usage aggregates" ON public.usage_daily_aggregates;

CREATE POLICY "Users can view their own usage aggregates" ON public.usage_daily_aggregates
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Drop and recreate policies for subscription_history
DROP POLICY IF EXISTS "Users can view their own subscription history" ON public.subscription_history;

CREATE POLICY "Users can view their own subscription history" ON public.subscription_history
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Drop and recreate policies for payment_history
DROP POLICY IF EXISTS "Users can view their own payment history" ON public.payment_history;

CREATE POLICY "Users can view their own payment history" ON public.payment_history
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- =============================================
-- ADDITIONAL PERFORMANCE INDEXES
-- =============================================

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_conversations_user_last_message 
    ON public.conversations(user_id, last_message_at DESC)
    WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created 
    ON public.chat_messages(conversation_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created 
    ON public.usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date 
    ON public.usage_daily_aggregates(user_id, date DESC);

-- Partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_conversations_starred 
    ON public.conversations(user_id)
    WHERE is_starred = true;

CREATE INDEX IF NOT EXISTS idx_chat_messages_flagged 
    ON public.chat_messages(user_id, created_at DESC)
    WHERE flagged_for_moderation = true;

-- =============================================
-- OPTIMIZE MATERIALIZED VIEW REFRESH
-- =============================================

-- Add indexes to support materialized view refresh
CREATE INDEX IF NOT EXISTS idx_conversations_for_recent_view 
    ON public.conversations(created_at DESC)
    WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days');

-- =============================================
-- CLEANUP UNUSED INDEXES
-- =============================================
-- Note: These indexes were identified as unused by the performance advisor
-- Only drop them if you're certain they're not needed

-- Consider dropping these after monitoring:
-- DROP INDEX IF EXISTS idx_user_profiles_subscription_tier;
-- DROP INDEX IF EXISTS idx_user_profiles_stripe_customer_id;
-- DROP INDEX IF EXISTS idx_user_profiles_username;

-- =============================================
-- VACUUM AND ANALYZE
-- =============================================
-- Run these commands after migration to update statistics
-- Note: These commands cannot be run inside a transaction

-- VACUUM ANALYZE public.user_profiles;
-- VACUUM ANALYZE public.conversations;
-- VACUUM ANALYZE public.chat_messages;
-- VACUUM ANALYZE public.usage_logs;
-- VACUUM ANALYZE public.usage_daily_aggregates;

-- =============================================
-- MONITORING QUERIES
-- =============================================

-- Query to check for slow queries after optimization
/*
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%chat_messages%' 
   OR query LIKE '%conversations%'
ORDER BY mean_exec_time DESC
LIMIT 20;
*/

-- Query to check index usage after optimization
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
*/

-- =============================================
-- ROLLBACK SCRIPT
-- =============================================
-- To rollback this migration, run:
/*
-- Revert RLS policies to use auth.uid() directly (not recommended)
-- This would restore the performance issues

-- Drop optimized indexes
DROP INDEX IF EXISTS idx_conversations_user_last_message;
DROP INDEX IF EXISTS idx_chat_messages_conversation_created;
DROP INDEX IF EXISTS idx_usage_logs_user_created;
DROP INDEX IF EXISTS idx_usage_daily_user_date;
DROP INDEX IF EXISTS idx_conversations_starred;
DROP INDEX IF EXISTS idx_chat_messages_flagged;
DROP INDEX IF EXISTS idx_conversations_for_recent_view;
*/
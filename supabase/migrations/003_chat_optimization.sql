-- Chat Performance Optimization
-- Version: 1.0.0
-- Description: Optimizations for chat history retrieval and real-time operations

-- =============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================

-- Materialized view for recent conversations (last 7 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.recent_conversations AS
SELECT 
    c.id,
    c.user_id,
    c.title,
    c.model_id,
    c.provider_id,
    c.last_message_at,
    c.message_count,
    c.is_starred,
    c.is_archived,
    c.created_at,
    -- Last message preview
    (
        SELECT jsonb_build_object(
            'content', LEFT(content, 200),
            'role', role,
            'created_at', created_at
        )
        FROM public.chat_messages
        WHERE conversation_id = c.id
        AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    ) AS last_message
FROM public.conversations c
WHERE c.last_message_at > NOW() - INTERVAL '7 days'
AND c.is_archived = FALSE;

-- Create indexes on materialized view
CREATE INDEX idx_recent_conversations_user_id ON public.recent_conversations(user_id);
CREATE INDEX idx_recent_conversations_last_message_at ON public.recent_conversations(last_message_at DESC);

-- Function to refresh materialized view (to be called periodically)
CREATE OR REPLACE FUNCTION refresh_recent_conversations()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.recent_conversations;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PARTITIONING FOR LARGE TABLES
-- =============================================

-- Create partitioned table for chat messages (by month)
-- This is for future scalability when message volume grows
CREATE TABLE IF NOT EXISTS public.chat_messages_partitioned (
    LIKE public.chat_messages INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE IF NOT EXISTS public.chat_messages_y2025m01 
    PARTITION OF public.chat_messages_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS public.chat_messages_y2025m02 
    PARTITION OF public.chat_messages_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'chat_messages_y' || TO_CHAR(start_date, 'YYYY') || 'm' || TO_CHAR(start_date, 'MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.chat_messages_partitioned FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- OPTIMIZED QUERY FUNCTIONS
-- =============================================

-- Function to get paginated conversations with last message
CREATE OR REPLACE FUNCTION get_conversations_with_last_message(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    conversation_id UUID,
    title VARCHAR(255),
    last_message_content TEXT,
    last_message_role VARCHAR(20),
    last_message_at TIMESTAMPTZ,
    message_count INTEGER,
    is_starred BOOLEAN,
    is_archived BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH last_messages AS (
        SELECT DISTINCT ON (conversation_id)
            conversation_id,
            content,
            role,
            created_at AS msg_created_at
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id
            AND deleted_at IS NULL
        ORDER BY conversation_id, created_at DESC
    )
    SELECT 
        c.id AS conversation_id,
        c.title,
        LEFT(lm.content, 200) AS last_message_content,
        lm.role AS last_message_role,
        c.last_message_at,
        c.message_count,
        c.is_starred,
        c.is_archived,
        c.created_at
    FROM public.conversations c
    LEFT JOIN last_messages lm ON lm.conversation_id = c.id
    WHERE 
        c.user_id = p_user_id
        AND (p_include_archived OR c.is_archived = FALSE)
    ORDER BY 
        c.is_starred DESC,
        c.last_message_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages for a conversation (optimized with cursor pagination)
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_before_id UUID DEFAULT NULL
)
RETURNS TABLE (
    message_id UUID,
    role VARCHAR(20),
    content TEXT,
    content_type VARCHAR(20),
    attachments JSONB,
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    total_tokens INTEGER,
    rating INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verify user owns the conversation
    IF NOT EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = p_conversation_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Conversation not found or access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        m.id AS message_id,
        m.role,
        m.content,
        m.content_type,
        m.attachments,
        m.model_id,
        m.provider_id,
        m.total_tokens,
        m.rating,
        m.created_at
    FROM public.chat_messages m
    WHERE 
        m.conversation_id = p_conversation_id
        AND m.deleted_at IS NULL
        AND (p_before_id IS NULL OR m.created_at < (
            SELECT created_at FROM public.chat_messages 
            WHERE id = p_before_id
        ))
    ORDER BY m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REAL-TIME SUBSCRIPTIONS SUPPORT
-- =============================================

-- Table for tracking active chat sessions (for presence)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'idle', 'typing')),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for chat sessions
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_conversation_id ON public.chat_sessions(conversation_id);
CREATE INDEX idx_chat_sessions_last_activity ON public.chat_sessions(last_activity_at DESC);

-- Function to clean up inactive sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.chat_sessions
    WHERE last_activity_at < NOW() - INTERVAL '30 minutes';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CACHING TABLES
-- =============================================

-- Table for caching expensive computations
CREATE TABLE IF NOT EXISTS public.cache_entries (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache expiration
CREATE INDEX idx_cache_entries_expires_at ON public.cache_entries(expires_at);

-- Function to get or set cache
CREATE OR REPLACE FUNCTION get_or_set_cache(
    p_key VARCHAR(255),
    p_compute_function TEXT,
    p_ttl_seconds INTEGER DEFAULT 3600
)
RETURNS JSONB AS $$
DECLARE
    v_cached_value JSONB;
    v_computed_value JSONB;
BEGIN
    -- Try to get from cache
    SELECT value INTO v_cached_value
    FROM public.cache_entries
    WHERE key = p_key AND expires_at > NOW();
    
    IF v_cached_value IS NOT NULL THEN
        RETURN v_cached_value;
    END IF;
    
    -- Compute the value
    EXECUTE p_compute_function INTO v_computed_value;
    
    -- Store in cache
    INSERT INTO public.cache_entries (key, value, expires_at)
    VALUES (p_key, v_computed_value, NOW() + (p_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at;
    
    RETURN v_computed_value;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.cache_entries
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PERFORMANCE MONITORING
-- =============================================

-- Table for query performance logs
CREATE TABLE IF NOT EXISTS public.query_performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_name VARCHAR(255),
    execution_time_ms INTEGER,
    rows_returned INTEGER,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX idx_query_performance_logs_query_name ON public.query_performance_logs(query_name);
CREATE INDEX idx_query_performance_logs_execution_time ON public.query_performance_logs(execution_time_ms DESC);
CREATE INDEX idx_query_performance_logs_created_at ON public.query_performance_logs(created_at DESC);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
    p_query_name VARCHAR(255),
    p_start_time TIMESTAMPTZ,
    p_rows_returned INTEGER DEFAULT 0,
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.query_performance_logs (
        query_name,
        execution_time_ms,
        rows_returned,
        user_id,
        metadata
    ) VALUES (
        p_query_name,
        EXTRACT(MILLISECONDS FROM (NOW() - p_start_time))::INTEGER,
        p_rows_returned,
        p_user_id,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SCHEDULED JOBS (using pg_cron or external scheduler)
-- =============================================

-- Job: Refresh recent conversations view (every 5 minutes)
-- Job: Clean up inactive sessions (every 30 minutes)
-- Job: Clean up expired cache (every hour)
-- Job: Update daily aggregates (daily at 2 AM)
-- Job: Archive old conversations (weekly)
-- Job: Create new monthly partition (monthly on the 25th)

-- Note: These jobs should be scheduled using pg_cron extension or an external scheduler
-- Example pg_cron setup:
-- SELECT cron.schedule('refresh-recent-conversations', '*/5 * * * *', 'SELECT refresh_recent_conversations();');
-- SELECT cron.schedule('cleanup-sessions', '*/30 * * * *', 'SELECT cleanup_inactive_sessions();');
-- SELECT cron.schedule('cleanup-cache', '0 * * * *', 'SELECT cleanup_expired_cache();');

-- =============================================
-- GRANTS
-- =============================================

GRANT EXECUTE ON FUNCTION get_conversations_with_last_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_recent_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_set_cache TO authenticated;
GRANT EXECUTE ON FUNCTION log_query_performance TO authenticated;
-- Database functions for optimized queries

-- Function to get conversations with last message
CREATE OR REPLACE FUNCTION get_conversations_with_last_message(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    model TEXT,
    provider TEXT,
    total_tokens INT,
    message_count INT,
    is_starred BOOLEAN,
    is_archived BOOLEAN,
    last_message_at TIMESTAMPTZ,
    last_message_content TEXT,
    last_message_role TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.model,
        c.provider::TEXT,
        c.total_tokens,
        c.message_count,
        c.is_starred,
        c.is_archived,
        c.last_message_at,
        lm.content AS last_message_content,
        lm.role::TEXT AS last_message_role,
        c.created_at,
        c.updated_at
    FROM conversations c
    LEFT JOIN LATERAL (
        SELECT cm.content, cm.role
        FROM chat_messages cm
        WHERE cm.conversation_id = c.id
          AND cm.deleted_at IS NULL
        ORDER BY cm.created_at DESC
        LIMIT 1
    ) lm ON true
    WHERE c.user_id = p_user_id
    ORDER BY 
        CASE WHEN c.last_message_at IS NULL THEN 0 ELSE 1 END DESC,
        c.last_message_at DESC,
        c.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Function to get conversation messages
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    content_type TEXT,
    model TEXT,
    provider TEXT,
    total_tokens INT,
    attachments JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.role::TEXT,
        cm.content,
        cm.content_type::TEXT,
        cm.model,
        cm.provider::TEXT,
        cm.total_tokens,
        cm.attachments,
        cm.created_at
    FROM chat_messages cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.deleted_at IS NULL
    ORDER BY cm.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Function to search messages using full-text search (fallback when embeddings not available)
CREATE OR REPLACE FUNCTION search_messages(
    p_user_id UUID,
    p_query TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    message_id UUID,
    conversation_id UUID,
    conversation_title TEXT,
    content TEXT,
    role TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- If embeddings are available, use vector similarity search
    -- For now, use full-text search as fallback
    RETURN QUERY
    SELECT 
        cm.id AS message_id,
        c.id AS conversation_id,
        c.title AS conversation_title,
        cm.content,
        cm.role::TEXT,
        ts_rank(to_tsvector('english', cm.content), plainto_tsquery('english', p_query))::FLOAT AS similarity,
        cm.created_at
    FROM chat_messages cm
    INNER JOIN conversations c ON c.id = cm.conversation_id
    WHERE c.user_id = p_user_id
      AND cm.deleted_at IS NULL
      AND to_tsvector('english', cm.content) @@ plainto_tsquery('english', p_query)
    ORDER BY similarity DESC, cm.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to get user usage summary
CREATE OR REPLACE FUNCTION get_user_usage_summary(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_messages BIGINT,
    total_tokens BIGINT,
    total_cost NUMERIC,
    daily_breakdown JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_daily_breakdown JSONB;
BEGIN
    -- Get daily breakdown
    SELECT jsonb_object_agg(
        date::TEXT,
        jsonb_build_object(
            'messages', total_messages,
            'tokens', total_tokens,
            'cost', total_cost
        )
    )
    INTO v_daily_breakdown
    FROM usage_daily_aggregates
    WHERE user_id = p_user_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE;

    -- Return summary with daily breakdown
    RETURN QUERY
    SELECT 
        COALESCE(SUM(uda.total_messages), 0)::BIGINT AS total_messages,
        COALESCE(SUM(uda.total_tokens), 0)::BIGINT AS total_tokens,
        COALESCE(SUM(uda.total_cost), 0)::NUMERIC AS total_cost,
        COALESCE(v_daily_breakdown, '{}'::JSONB) AS daily_breakdown
    FROM usage_daily_aggregates uda
    WHERE uda.user_id = p_user_id
      AND uda.date >= p_start_date::DATE
      AND uda.date <= p_end_date::DATE;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_last_message 
    ON conversations(user_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id_created 
    ON chat_messages(conversation_id, created_at ASC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_content_tsvector 
    ON chat_messages USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id_created 
    ON usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_daily_aggregates_user_date 
    ON usage_daily_aggregates(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id 
    ON moderation_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_violations_user_id 
    ON user_violations(user_id, created_at DESC) 
    WHERE expires_at IS NULL OR expires_at > NOW();

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_conversations_with_last_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION search_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_summary TO authenticated;
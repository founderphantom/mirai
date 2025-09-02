-- Chat Search and Analytics Functions
-- Version: 1.0.0
-- Description: Advanced search and analytics functions for chat history

-- =============================================
-- FULL TEXT SEARCH FUNCTIONS
-- =============================================

-- Function to search messages across all conversations
CREATE OR REPLACE FUNCTION search_messages(
    p_user_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    message_id UUID,
    conversation_id UUID,
    conversation_title VARCHAR(255),
    content TEXT,
    role VARCHAR(20),
    created_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS message_id,
        m.conversation_id,
        c.title AS conversation_title,
        m.content,
        m.role,
        m.created_at,
        ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', p_query)) AS rank
    FROM public.chat_messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE 
        c.user_id = p_user_id
        AND m.deleted_at IS NULL
        AND to_tsvector('english', m.content) @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC, m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation summary with token usage
CREATE OR REPLACE FUNCTION get_conversation_summary(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    conversation_id UUID,
    title VARCHAR(255),
    message_count BIGINT,
    total_tokens BIGINT,
    estimated_cost NUMERIC,
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    providers_used JSONB,
    models_used JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS conversation_id,
        c.title,
        COUNT(m.id) AS message_count,
        SUM(m.total_tokens) AS total_tokens,
        SUM(
            CASE 
                WHEN m.provider_id = 'openai' AND m.model_id LIKE 'gpt-4%' THEN m.total_tokens * 0.00003
                WHEN m.provider_id = 'openai' AND m.model_id LIKE 'gpt-3.5%' THEN m.total_tokens * 0.000002
                WHEN m.provider_id = 'anthropic' THEN m.total_tokens * 0.000025
                ELSE m.total_tokens * 0.000001
            END
        ) AS estimated_cost,
        MIN(m.created_at) AS first_message_at,
        MAX(m.created_at) AS last_message_at,
        jsonb_agg(DISTINCT m.provider_id) AS providers_used,
        jsonb_agg(DISTINCT m.model_id) AS models_used
    FROM public.conversations c
    LEFT JOIN public.chat_messages m ON m.conversation_id = c.id
    WHERE 
        c.id = p_conversation_id 
        AND c.user_id = p_user_id
        AND m.deleted_at IS NULL
    GROUP BY c.id, c.title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CHAT EXPORT FUNCTIONS
-- =============================================

-- Function to export conversation as JSON
CREATE OR REPLACE FUNCTION export_conversation_json(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'conversation', jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'created_at', c.created_at,
            'model_id', c.model_id,
            'provider_id', c.provider_id,
            'settings', c.settings
        ),
        'messages', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'role', m.role,
                'content', m.content,
                'created_at', m.created_at,
                'model_id', m.model_id,
                'tokens', m.total_tokens,
                'attachments', m.attachments
            ) ORDER BY m.created_at
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.conversations c
    LEFT JOIN public.chat_messages m ON m.conversation_id = c.id AND m.deleted_at IS NULL
    WHERE c.id = p_conversation_id AND c.user_id = p_user_id
    GROUP BY c.id, c.title, c.created_at, c.model_id, c.provider_id, c.settings;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ANALYTICS FUNCTIONS
-- =============================================

-- Function to get user usage statistics
CREATE OR REPLACE FUNCTION get_user_usage_stats(
    p_user_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_messages BIGINT,
    total_conversations BIGINT,
    total_tokens BIGINT,
    estimated_cost NUMERIC,
    avg_messages_per_day NUMERIC,
    most_used_model VARCHAR(100),
    most_used_provider VARCHAR(50),
    peak_usage_date DATE,
    peak_usage_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_stats AS (
        SELECT 
            DATE(created_at) AS usage_date,
            COUNT(*) AS daily_messages
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id 
            AND role = 'user'
            AND DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND deleted_at IS NULL
        GROUP BY DATE(created_at)
    ),
    model_stats AS (
        SELECT 
            model_id,
            COUNT(*) AS usage_count
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id 
            AND role = 'assistant'
            AND DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND deleted_at IS NULL
        GROUP BY model_id
        ORDER BY usage_count DESC
        LIMIT 1
    ),
    provider_stats AS (
        SELECT 
            provider_id,
            COUNT(*) AS usage_count
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id 
            AND role = 'assistant'
            AND DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND deleted_at IS NULL
        GROUP BY provider_id
        ORDER BY usage_count DESC
        LIMIT 1
    )
    SELECT 
        (SELECT COUNT(*) FROM public.chat_messages 
         WHERE user_id = p_user_id 
         AND DATE(created_at) BETWEEN p_start_date AND p_end_date
         AND deleted_at IS NULL) AS total_messages,
        
        (SELECT COUNT(DISTINCT conversation_id) FROM public.chat_messages 
         WHERE user_id = p_user_id 
         AND DATE(created_at) BETWEEN p_start_date AND p_end_date
         AND deleted_at IS NULL) AS total_conversations,
        
        (SELECT SUM(total_tokens) FROM public.chat_messages 
         WHERE user_id = p_user_id 
         AND DATE(created_at) BETWEEN p_start_date AND p_end_date
         AND deleted_at IS NULL) AS total_tokens,
        
        (SELECT SUM(
            CASE 
                WHEN provider_id = 'openai' AND model_id LIKE 'gpt-4%' THEN total_tokens * 0.00003
                WHEN provider_id = 'openai' AND model_id LIKE 'gpt-3.5%' THEN total_tokens * 0.000002
                WHEN provider_id = 'anthropic' THEN total_tokens * 0.000025
                ELSE total_tokens * 0.000001
            END
         ) FROM public.chat_messages 
         WHERE user_id = p_user_id 
         AND DATE(created_at) BETWEEN p_start_date AND p_end_date
         AND deleted_at IS NULL) AS estimated_cost,
        
        (SELECT AVG(daily_messages)::NUMERIC(10,2) FROM daily_stats) AS avg_messages_per_day,
        (SELECT model_id FROM model_stats LIMIT 1) AS most_used_model,
        (SELECT provider_id FROM provider_stats LIMIT 1) AS most_used_provider,
        (SELECT usage_date FROM daily_stats ORDER BY daily_messages DESC LIMIT 1) AS peak_usage_date,
        (SELECT daily_messages FROM daily_stats ORDER BY daily_messages DESC LIMIT 1) AS peak_usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular conversation topics
CREATE OR REPLACE FUNCTION get_popular_topics(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    word TEXT,
    frequency BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH words AS (
        SELECT 
            unnest(string_to_array(lower(
                regexp_replace(content, '[^a-zA-Z\s]', '', 'g')
            ), ' ')) AS word
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id 
            AND role = 'user'
            AND deleted_at IS NULL
    ),
    filtered_words AS (
        SELECT word
        FROM words
        WHERE 
            length(word) > 4  -- Filter out short words
            AND word NOT IN ( -- Common stop words
                'about', 'after', 'again', 'against', 'because', 'before',
                'being', 'between', 'during', 'except', 'having', 'other',
                'should', 'there', 'these', 'those', 'through', 'under',
                'where', 'which', 'while', 'would'
            )
    )
    SELECT 
        word,
        COUNT(*) AS frequency
    FROM filtered_words
    GROUP BY word
    ORDER BY frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =============================================

-- Function to clean up old messages (soft delete)
CREATE OR REPLACE FUNCTION cleanup_old_messages(
    p_user_id UUID,
    p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    UPDATE public.chat_messages
    SET deleted_at = NOW()
    WHERE 
        user_id = p_user_id
        AND created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
        AND deleted_at IS NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive old conversations
CREATE OR REPLACE FUNCTION archive_old_conversations(
    p_user_id UUID,
    p_days_inactive INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_archived_count INTEGER;
BEGIN
    UPDATE public.conversations
    SET is_archived = TRUE
    WHERE 
        user_id = p_user_id
        AND last_message_at < NOW() - (p_days_inactive || ' days')::INTERVAL
        AND is_archived = FALSE;
    
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    
    RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AGGREGATION FUNCTIONS
-- =============================================

-- Function to update daily usage aggregates
CREATE OR REPLACE FUNCTION update_daily_usage_aggregate(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.usage_daily_aggregates (
        user_id,
        date,
        message_count,
        conversation_count,
        total_prompt_tokens,
        total_completion_tokens,
        total_tokens,
        total_estimated_cost,
        provider_usage,
        model_usage
    )
    SELECT 
        p_user_id,
        p_date,
        COUNT(CASE WHEN role = 'user' THEN 1 END) AS message_count,
        COUNT(DISTINCT conversation_id) AS conversation_count,
        SUM(prompt_tokens) AS total_prompt_tokens,
        SUM(completion_tokens) AS total_completion_tokens,
        SUM(total_tokens) AS total_tokens,
        SUM(
            CASE 
                WHEN provider_id = 'openai' AND model_id LIKE 'gpt-4%' THEN total_tokens * 0.00003
                WHEN provider_id = 'openai' AND model_id LIKE 'gpt-3.5%' THEN total_tokens * 0.000002
                WHEN provider_id = 'anthropic' THEN total_tokens * 0.000025
                ELSE total_tokens * 0.000001
            END
        ) AS total_estimated_cost,
        jsonb_object_agg(DISTINCT provider_id, provider_count) AS provider_usage,
        jsonb_object_agg(DISTINCT model_id, model_count) AS model_usage
    FROM (
        SELECT 
            *,
            COUNT(*) OVER (PARTITION BY provider_id) AS provider_count,
            COUNT(*) OVER (PARTITION BY model_id) AS model_count
        FROM public.chat_messages
        WHERE 
            user_id = p_user_id
            AND DATE(created_at) = p_date
            AND deleted_at IS NULL
    ) AS msg_stats
    GROUP BY user_id
    ON CONFLICT (user_id, date) DO UPDATE
    SET 
        message_count = EXCLUDED.message_count,
        conversation_count = EXCLUDED.conversation_count,
        total_prompt_tokens = EXCLUDED.total_prompt_tokens,
        total_completion_tokens = EXCLUDED.total_completion_tokens,
        total_tokens = EXCLUDED.total_tokens,
        total_estimated_cost = EXCLUDED.total_estimated_cost,
        provider_usage = EXCLUDED.provider_usage,
        model_usage = EXCLUDED.model_usage,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANTS FOR FUNCTIONS
-- =============================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION search_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_summary TO authenticated;
GRANT EXECUTE ON FUNCTION export_conversation_json TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_topics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_messages TO authenticated;
GRANT EXECUTE ON FUNCTION archive_old_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_usage_aggregate TO authenticated;
-- =====================================================================================
-- Migration: 009_critical_security_fixes.sql
-- Description: Critical security fixes for production deployment
-- Author: MIRAI Security Team
-- Date: 2025-01-11
-- =====================================================================================

-- =====================================================================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- =====================================================================================

-- Drop and recreate views with security_invoker = true (Postgres 15+)
-- This ensures views respect the calling user's RLS policies

-- Fix: public.active_users_summary view
DROP VIEW IF EXISTS public.active_users_summary CASCADE;

CREATE VIEW public.active_users_summary
WITH (security_invoker = true) AS
SELECT 
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.last_seen_at > NOW() - INTERVAL '24 hours' THEN u.id END) AS daily_active_users,
    COUNT(DISTINCT CASE WHEN u.last_seen_at > NOW() - INTERVAL '7 days' THEN u.id END) AS weekly_active_users,
    COUNT(DISTINCT CASE WHEN u.last_seen_at > NOW() - INTERVAL '30 days' THEN u.id END) AS monthly_active_users,
    COUNT(DISTINCT CASE WHEN u.subscription_tier = 'free' THEN u.id END) AS free_users,
    COUNT(DISTINCT CASE WHEN u.subscription_tier = 'plus' THEN u.id END) AS plus_users,
    COUNT(DISTINCT CASE WHEN u.subscription_tier = 'pro' THEN u.id END) AS pro_users,
    COUNT(DISTINCT CASE WHEN u.subscription_tier = 'enterprise' THEN u.id END) AS enterprise_users
FROM user_profiles u;

-- Add appropriate permissions
GRANT SELECT ON public.active_users_summary TO authenticated;
GRANT SELECT ON public.active_users_summary TO service_role;

COMMENT ON VIEW public.active_users_summary IS 'User activity summary view with security_invoker enabled for RLS compliance';

-- Fix: public.feature_usage view
DROP VIEW IF EXISTS public.feature_usage CASCADE;

CREATE VIEW public.feature_usage
WITH (security_invoker = true) AS
SELECT 
    u.user_id,
    u.endpoint,
    COUNT(*) AS usage_count,
    SUM(u.total_tokens) AS total_tokens_used,
    SUM(u.estimated_cost) AS total_cost,
    AVG(u.response_time_ms) AS avg_response_time,
    MAX(u.created_at) AS last_used,
    MIN(u.created_at) AS first_used
FROM usage_logs u
WHERE u.status_code = 200
GROUP BY u.user_id, u.endpoint;

-- Add appropriate permissions
GRANT SELECT ON public.feature_usage TO authenticated;
GRANT SELECT ON public.feature_usage TO service_role;

COMMENT ON VIEW public.feature_usage IS 'Feature usage statistics view with security_invoker enabled for RLS compliance';

-- =====================================================================================
-- PART 2: FIX FUNCTIONS WITH MUTABLE SEARCH_PATH
-- =====================================================================================

-- Fix: public.is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_profiles 
        WHERE id = user_id 
        AND role = 'admin'
    );
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'Check if user has admin role - secured with immutable search_path';

-- Fix: public.log_security_event function
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id uuid,
    p_event_type text,
    p_event_data jsonb,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_event_id uuid;
BEGIN
    -- Insert security event into analytics_events table
    INSERT INTO public.analytics_events (
        user_id,
        event_type,
        event_data,
        created_at
    )
    VALUES (
        p_user_id,
        'security_' || p_event_type,
        jsonb_build_object(
            'category', 'security',
            'event_type', p_event_type,
            'ip_address', p_ip_address,
            'user_agent', p_user_agent,
            'timestamp', NOW()
        ) || COALESCE(p_event_data, '{}'::jsonb),
        NOW()
    )
    RETURNING id INTO v_event_id;
    
    -- Also log to system audit table if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'security_audit_log'
    ) THEN
        INSERT INTO public.security_audit_log (
            user_id,
            event_type,
            event_data,
            ip_address,
            user_agent,
            created_at
        )
        VALUES (
            p_user_id,
            p_event_type,
            p_event_data,
            p_ip_address,
            p_user_agent,
            NOW()
        );
    END IF;
    
    RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.log_security_event IS 'Log security events for audit trail - secured with immutable search_path';

-- Fix: public.promote_to_admin function
CREATE OR REPLACE FUNCTION public.promote_to_admin(
    p_user_id uuid,
    p_promoted_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_success boolean := false;
BEGIN
    -- Check if the promoter is an admin
    IF NOT public.is_admin(p_promoted_by) THEN
        RAISE EXCEPTION 'Only admins can promote users to admin role';
    END IF;
    
    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Update user role to admin
    UPDATE public.user_profiles
    SET 
        role = 'admin',
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING true INTO v_success;
    
    -- Log the promotion event
    IF v_success THEN
        PERFORM public.log_security_event(
            p_user_id,
            'user_promoted_to_admin',
            jsonb_build_object(
                'promoted_by', p_promoted_by,
                'promoted_at', NOW()
            )
        );
    END IF;
    
    RETURN v_success;
END;
$$;

COMMENT ON FUNCTION public.promote_to_admin IS 'Promote user to admin role with audit logging - secured with immutable search_path';

-- =====================================================================================
-- PART 3: CREATE SECURITY AUDIT TABLE (if not exists)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    event_data jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON public.security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON public.security_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies (only admins and service role can read)
CREATE POLICY "Admins can view security audit logs" ON public.security_audit_log
    FOR SELECT
    USING (public.is_admin(auth.uid()));

-- Grant permissions
GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

COMMENT ON TABLE public.security_audit_log IS 'Security audit trail for compliance and monitoring';

-- =====================================================================================
-- PART 4: ADDITIONAL RLS IMPROVEMENTS
-- =====================================================================================

-- Ensure all critical tables have RLS enabled (double-check)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'user_profiles', 'conversations', 'chat_messages', 
            'usage_logs', 'subscription_history', 'api_keys',
            'user_violations', 'analytics_events', 'notifications'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- =====================================================================================
-- PART 5: CREATE HELPER FUNCTIONS FOR SECURE OPERATIONS
-- =====================================================================================

-- Function to validate and sanitize user input (for use in triggers)
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Remove any potential SQL injection attempts
    -- Remove HTML tags and dangerous characters
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                input_text,
                '<[^>]*>', '', 'g'  -- Remove HTML tags
            ),
            '[<>''";]', '', 'g'  -- Remove dangerous characters
        ),
        '^\s+|\s+$', '', 'g'  -- Trim whitespace
    );
END;
$$;

COMMENT ON FUNCTION public.sanitize_text_input IS 'Sanitize text input to prevent XSS and SQL injection';

-- Function to check rate limits at database level
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id uuid,
    p_limit integer,
    p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.usage_logs
    WHERE user_id = p_user_id
    AND created_at > NOW() - (p_window_minutes || ' minutes')::interval;
    
    RETURN v_count < p_limit;
END;
$$;

COMMENT ON FUNCTION public.check_rate_limit IS 'Check if user has exceeded rate limit in given time window';

-- =====================================================================================
-- PART 6: CREATE INDEXES FOR SECURITY QUERIES
-- =====================================================================================

-- Create indexes for faster security checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_violations_user_status ON public.user_violations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_analytics_events_security ON public.analytics_events(event_type) 
    WHERE event_type LIKE 'security_%';

-- =====================================================================================
-- PART 7: SECURITY CONFIGURATION TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.security_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key text UNIQUE NOT NULL,
    config_value jsonb NOT NULL,
    description text,
    updated_at timestamptz DEFAULT NOW() NOT NULL,
    updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage security config
CREATE POLICY "Only admins can manage security config" ON public.security_config
    FOR ALL
    USING (public.is_admin(auth.uid()));

-- Insert default security configurations
INSERT INTO public.security_config (config_key, config_value, description)
VALUES 
    ('rate_limits', '{
        "free": {"requests_per_hour": 100, "tokens_per_day": 10000},
        "plus": {"requests_per_hour": 500, "tokens_per_day": 50000},
        "pro": {"requests_per_hour": 5000, "tokens_per_day": 500000},
        "enterprise": {"requests_per_hour": -1, "tokens_per_day": -1}
    }'::jsonb, 'Rate limiting configuration per subscription tier'),
    
    ('security_headers', '{
        "enabled": true,
        "csp": "default-src ''self''; script-src ''self'' ''unsafe-inline''; style-src ''self'' ''unsafe-inline''",
        "x_frame_options": "DENY",
        "x_content_type_options": "nosniff",
        "x_xss_protection": "1; mode=block",
        "strict_transport_security": "max-age=31536000; includeSubDomains"
    }'::jsonb, 'Security headers configuration'),
    
    ('csrf_protection', '{
        "enabled": true,
        "cookie_name": "_csrf",
        "header_name": "X-CSRF-Token",
        "cookie_options": {
            "httpOnly": true,
            "secure": true,
            "sameSite": "strict"
        }
    }'::jsonb, 'CSRF protection configuration')
ON CONFLICT (config_key) DO NOTHING;

GRANT SELECT ON public.security_config TO authenticated;
GRANT ALL ON public.security_config TO service_role;

-- =====================================================================================
-- PART 8: VERIFY AND LOG MIGRATION
-- =====================================================================================

-- Log migration completion
INSERT INTO public.analytics_events (
    event_type,
    event_data,
    created_at
)
VALUES (
    'migration_completed',
    jsonb_build_object(
        'migration_name', '009_critical_security_fixes',
        'fixes_applied', jsonb_build_array(
            'SECURITY_DEFINER views fixed',
            'Function search_path secured',
            'Security audit log created',
            'RLS policies verified',
            'Security helper functions added',
            'Security configuration table created'
        ),
        'timestamp', NOW()
    ),
    NOW()
);

-- =====================================================================================
-- Migration Complete: 009_critical_security_fixes.sql
-- This migration addresses:
-- 1. SECURITY DEFINER views vulnerability
-- 2. Function search_path security issues
-- 3. Additional RLS hardening
-- 4. Security audit logging infrastructure
-- 5. Input sanitization helpers
-- 6. Security configuration management
-- =====================================================================================
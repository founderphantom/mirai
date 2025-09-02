/**
 * Database types generated from Supabase schema
 * These types match the database schema defined in migrations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise'
          subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          subscription_ends_at: string | null
          daily_message_count: number
          total_message_count: number
          last_message_reset_at: string
          preferences: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          subscription_tier?: 'free' | 'plus' | 'pro' | 'enterprise'
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          subscription_ends_at?: string | null
          daily_message_count?: number
          total_message_count?: number
          last_message_reset_at?: string
          preferences?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          subscription_tier?: 'free' | 'plus' | 'pro' | 'enterprise'
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          subscription_ends_at?: string | null
          daily_message_count?: number
          total_message_count?: number
          last_message_reset_at?: string
          preferences?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          summary: string | null
          model_id: string
          provider_id: string
          avatar_id: string | null
          voice_id: string | null
          personality_template: string | null
          system_prompt: string | null
          temperature: number
          max_tokens: number
          settings: Json
          tags: string[]
          is_archived: boolean
          is_starred: boolean
          last_message_at: string
          message_count: number
          total_tokens_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          summary?: string | null
          model_id: string
          provider_id: string
          avatar_id?: string | null
          voice_id?: string | null
          personality_template?: string | null
          system_prompt?: string | null
          temperature?: number
          max_tokens?: number
          settings?: Json
          tags?: string[]
          is_archived?: boolean
          is_starred?: boolean
          last_message_at?: string
          message_count?: number
          total_tokens_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          summary?: string | null
          model_id?: string
          provider_id?: string
          avatar_id?: string | null
          voice_id?: string | null
          personality_template?: string | null
          system_prompt?: string | null
          temperature?: number
          max_tokens?: number
          settings?: Json
          tags?: string[]
          is_archived?: boolean
          is_starred?: boolean
          last_message_at?: string
          message_count?: number
          total_tokens_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
          content: string
          content_type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'code'
          attachments: Json
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          model_id: string | null
          provider_id: string | null
          response_time_ms: number | null
          finish_reason: string | null
          flagged_for_moderation: boolean
          moderation_results: Json
          function_call: Json | null
          tool_calls: Json[] | null
          rating: number | null
          feedback: string | null
          metadata: Json
          embedding: number[] | null
          created_at: string
          edited_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
          content: string
          content_type?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'code'
          attachments?: Json
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          model_id?: string | null
          provider_id?: string | null
          response_time_ms?: number | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean
          moderation_results?: Json
          function_call?: Json | null
          tool_calls?: Json[] | null
          rating?: number | null
          feedback?: string | null
          metadata?: Json
          embedding?: number[] | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          role?: 'user' | 'assistant' | 'system' | 'function' | 'tool'
          content?: string
          content_type?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'code'
          attachments?: Json
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          model_id?: string | null
          provider_id?: string | null
          response_time_ms?: number | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean
          moderation_results?: Json
          function_call?: Json | null
          tool_calls?: Json[] | null
          rating?: number | null
          feedback?: string | null
          metadata?: Json
          embedding?: number[] | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
        }
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          file_name: string
          file_type: string | null
          file_size: number | null
          storage_path: string
          mime_type: string | null
          width: number | null
          height: number | null
          duration_seconds: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          file_name: string
          file_type?: string | null
          file_size?: number | null
          storage_path: string
          mime_type?: string | null
          width?: number | null
          height?: number | null
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          file_name?: string
          file_type?: string | null
          file_size?: number | null
          storage_path?: string
          mime_type?: string | null
          width?: number | null
          height?: number | null
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
      }
      usage_logs: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          method: string
          status_code: number
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          provider_id: string | null
          model_id: string | null
          estimated_cost: number
          response_time_ms: number | null
          queue_time_ms: number | null
          processing_time_ms: number | null
          request_headers: Json | null
          request_body: Json | null
          response_headers: Json | null
          response_size_bytes: number | null
          error_message: string | null
          error_code: string | null
          error_details: Json | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          method: string
          status_code: number
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          provider_id?: string | null
          model_id?: string | null
          estimated_cost?: number
          response_time_ms?: number | null
          queue_time_ms?: number | null
          processing_time_ms?: number | null
          request_headers?: Json | null
          request_body?: Json | null
          response_headers?: Json | null
          response_size_bytes?: number | null
          error_message?: string | null
          error_code?: string | null
          error_details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          method?: string
          status_code?: number
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          provider_id?: string | null
          model_id?: string | null
          estimated_cost?: number
          response_time_ms?: number | null
          queue_time_ms?: number | null
          processing_time_ms?: number | null
          request_headers?: Json | null
          request_body?: Json | null
          response_headers?: Json | null
          response_size_bytes?: number | null
          error_message?: string | null
          error_code?: string | null
          error_details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      usage_daily_aggregates: {
        Row: {
          id: string
          user_id: string
          date: string
          message_count: number
          conversation_count: number
          total_prompt_tokens: number
          total_completion_tokens: number
          total_tokens: number
          total_estimated_cost: number
          provider_usage: Json
          model_usage: Json
          voice_minutes_used: number
          image_generations: number
          function_calls: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          message_count?: number
          conversation_count?: number
          total_prompt_tokens?: number
          total_completion_tokens?: number
          total_tokens?: number
          total_estimated_cost?: number
          provider_usage?: Json
          model_usage?: Json
          voice_minutes_used?: number
          image_generations?: number
          function_calls?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          message_count?: number
          conversation_count?: number
          total_prompt_tokens?: number
          total_completion_tokens?: number
          total_tokens?: number
          total_estimated_cost?: number
          provider_usage?: Json
          model_usage?: Json
          voice_minutes_used?: number
          image_generations?: number
          function_calls?: number
          created_at?: string
          updated_at?: string
        }
      }
      subscription_history: {
        Row: {
          id: string
          user_id: string
          stripe_subscription_id: string | null
          stripe_invoice_id: string | null
          tier: string
          status: string
          amount: number | null
          currency: string
          period_start: string
          period_end: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_subscription_id?: string | null
          stripe_invoice_id?: string | null
          tier: string
          status: string
          amount?: number | null
          currency?: string
          period_start: string
          period_end: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_subscription_id?: string | null
          stripe_invoice_id?: string | null
          tier?: string
          status?: string
          amount?: number | null
          currency?: string
          period_start?: string
          period_end?: string
          metadata?: Json
          created_at?: string
        }
      }
      payment_history: {
        Row: {
          id: string
          user_id: string
          stripe_payment_intent_id: string | null
          stripe_invoice_id: string | null
          amount: number
          currency: string
          status: string
          description: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_payment_intent_id?: string | null
          stripe_invoice_id?: string | null
          amount: number
          currency?: string
          status: string
          description?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_payment_intent_id?: string | null
          stripe_invoice_id?: string | null
          amount?: number
          currency?: string
          status?: string
          description?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      moderation_logs: {
        Row: {
          id: string
          user_id: string
          message_id: string | null
          content: string
          flagged: boolean
          categories: Json
          scores: Json
          action_taken: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id?: string | null
          content: string
          flagged?: boolean
          categories?: Json
          scores?: Json
          action_taken?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string | null
          content?: string
          flagged?: boolean
          categories?: Json
          scores?: Json
          action_taken?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      user_violations: {
        Row: {
          id: string
          user_id: string
          violation_type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          description: string | null
          action_taken: string | null
          expires_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          violation_type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          description?: string | null
          action_taken?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          violation_type?: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          description?: string | null
          action_taken?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          key: string
          value: Json
          description: string | null
          category: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          description?: string | null
          category?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          description?: string | null
          category?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      provider_health: {
        Row: {
          id: string
          name: string
          status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance'
          last_check_at: string
          success_rate: number | null
          average_response_time_ms: number | null
          error_count: number
          metadata: Json
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          status?: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance'
          last_check_at?: string
          success_rate?: number | null
          average_response_time_ms?: number | null
          error_count?: number
          metadata?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance'
          last_check_at?: string
          success_rate?: number | null
          average_response_time_ms?: number | null
          error_count?: number
          metadata?: Json
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_conversations_with_last_message: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_offset?: number
          p_archived?: boolean
        }
        Returns: {
          id: string
          title: string
          last_message: string
          last_message_at: string
          is_starred: boolean
          message_count: number
        }[]
      }
      get_conversation_messages: {
        Args: {
          p_conversation_id: string
          p_limit?: number
          p_cursor?: string
        }
        Returns: {
          id: string
          role: string
          content: string
          created_at: string
          attachments: Json
        }[]
      }
      search_messages: {
        Args: {
          p_user_id: string
          p_query: string
          p_limit?: number
        }
        Returns: {
          message_id: string
          conversation_id: string
          content: string
          rank: number
        }[]
      }
    }
    Enums: {
      subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise'
      subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
      message_role: 'user' | 'assistant' | 'system' | 'function' | 'tool'
      content_type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'code'
      provider_status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance'
      violation_severity: 'low' | 'medium' | 'high' | 'critical'
    }
  }
}
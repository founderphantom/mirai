export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          ip_whitelist: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          metadata: Json | null
          name: string
          revoked_at: string | null
          scopes: string[] | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          metadata?: Json | null
          name: string
          revoked_at?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          metadata?: Json | null
          name?: string
          revoked_at?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cache_entries: {
        Row: {
          created_at: string | null
          expires_at: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          key: string
          value: Json
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          completion_tokens: number | null
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          embedding: string | null
          feedback: string | null
          finish_reason: string | null
          flagged_for_moderation: boolean | null
          function_call: Json | null
          id: string
          metadata: Json | null
          model_id: string | null
          moderation_results: Json | null
          prompt_tokens: number | null
          provider_id: string | null
          rating: number | null
          response_time_ms: number | null
          role: string
          token_count: number | null
          tool_calls: Json[] | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          completion_tokens?: number | null
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role: string
          token_count?: number | null
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          completion_tokens?: number | null
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role?: string
          token_count?: number | null
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "recent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages_partitioned: {
        Row: {
          attachments: Json | null
          completion_tokens: number | null
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          embedding: string | null
          feedback: string | null
          finish_reason: string | null
          flagged_for_moderation: boolean | null
          function_call: Json | null
          id: string
          metadata: Json | null
          model_id: string | null
          moderation_results: Json | null
          prompt_tokens: number | null
          provider_id: string | null
          rating: number | null
          response_time_ms: number | null
          role: string
          tool_calls: Json[] | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          completion_tokens?: number | null
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          completion_tokens?: number | null
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role?: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages_y2025m01: {
        Row: {
          attachments: Json | null
          completion_tokens: number | null
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          embedding: string | null
          feedback: string | null
          finish_reason: string | null
          flagged_for_moderation: boolean | null
          function_call: Json | null
          id: string
          metadata: Json | null
          model_id: string | null
          moderation_results: Json | null
          prompt_tokens: number | null
          provider_id: string | null
          rating: number | null
          response_time_ms: number | null
          role: string
          tool_calls: Json[] | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          completion_tokens?: number | null
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          completion_tokens?: number | null
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role?: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages_y2025m02: {
        Row: {
          attachments: Json | null
          completion_tokens: number | null
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          embedding: string | null
          feedback: string | null
          finish_reason: string | null
          flagged_for_moderation: boolean | null
          function_call: Json | null
          id: string
          metadata: Json | null
          model_id: string | null
          moderation_results: Json | null
          prompt_tokens: number | null
          provider_id: string | null
          rating: number | null
          response_time_ms: number | null
          role: string
          tool_calls: Json[] | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          completion_tokens?: number | null
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          completion_tokens?: number | null
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          embedding?: string | null
          feedback?: string | null
          finish_reason?: string | null
          flagged_for_moderation?: boolean | null
          function_call?: Json | null
          id?: string
          metadata?: Json | null
          model_id?: string | null
          moderation_results?: Json | null
          prompt_tokens?: number | null
          provider_id?: string | null
          rating?: number | null
          response_time_ms?: number | null
          role?: string
          tool_calls?: Json[] | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "recent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_id: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_starred: boolean | null
          last_message_at: string | null
          max_tokens: number | null
          message_count: number | null
          model_id: string
          personality_template: string | null
          provider_id: string
          settings: Json | null
          summary: string | null
          system_prompt: string | null
          tags: string[] | null
          temperature: number | null
          title: string | null
          total_tokens_used: number | null
          updated_at: string | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_starred?: boolean | null
          last_message_at?: string | null
          max_tokens?: number | null
          message_count?: number | null
          model_id: string
          personality_template?: string | null
          provider_id: string
          settings?: Json | null
          summary?: string | null
          system_prompt?: string | null
          tags?: string[] | null
          temperature?: number | null
          title?: string | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_starred?: boolean | null
          last_message_at?: string | null
          max_tokens?: number | null
          message_count?: number | null
          model_id?: string
          personality_template?: string | null
          provider_id?: string
          settings?: Json | null
          summary?: string | null
          system_prompt?: string | null
          tags?: string[] | null
          temperature?: number | null
          title?: string | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          file_name: string
          file_size: number | null
          file_type: string | null
          height: number | null
          id: string
          message_id: string
          metadata: Json | null
          mime_type: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          height?: number | null
          id?: string
          message_id: string
          metadata?: Json | null
          mime_type?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          height?: number | null
          id?: string
          message_id?: string
          metadata?: Json | null
          mime_type?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action_taken: string | null
          categories: Json | null
          content: string
          created_at: string | null
          flagged: boolean | null
          id: string
          message_id: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scores: Json | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          categories?: Json | null
          content: string
          created_at?: string | null
          flagged?: boolean | null
          id?: string
          message_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scores?: Json | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          categories?: Json | null
          content?: string
          created_at?: string | null
          flagged?: boolean | null
          id?: string
          message_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scores?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_logs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_health: {
        Row: {
          average_response_time_ms: number | null
          error_count: number | null
          id: string
          last_check_at: string | null
          metadata: Json | null
          name: string
          status: string | null
          success_rate: number | null
          updated_at: string | null
        }
        Insert: {
          average_response_time_ms?: number | null
          error_count?: number | null
          id: string
          last_check_at?: string | null
          metadata?: Json | null
          name: string
          status?: string | null
          success_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          average_response_time_ms?: number | null
          error_count?: number | null
          id?: string
          last_check_at?: string | null
          metadata?: Json | null
          name?: string
          status?: string | null
          success_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      query_performance_logs: {
        Row: {
          created_at: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          query_name: string | null
          rows_returned: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          query_name?: string | null
          rows_returned?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          query_name?: string | null
          rows_returned?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_performance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          daily_conversations: number | null
          daily_messages: number | null
          last_reset_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          daily_conversations?: number | null
          daily_messages?: number | null
          last_reset_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          daily_conversations?: number | null
          daily_messages?: number | null
          last_reset_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_history: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
          tier: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          is_public: boolean | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          is_public?: boolean | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          is_public?: boolean | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      usage_daily_aggregates: {
        Row: {
          conversation_count: number | null
          created_at: string | null
          date: string
          function_calls: number | null
          id: string
          image_generations: number | null
          message_count: number | null
          model_usage: Json | null
          provider_usage: Json | null
          total_completion_tokens: number | null
          total_estimated_cost: number | null
          total_prompt_tokens: number | null
          total_tokens: number | null
          updated_at: string | null
          user_id: string
          voice_minutes_used: number | null
        }
        Insert: {
          conversation_count?: number | null
          created_at?: string | null
          date: string
          function_calls?: number | null
          id?: string
          image_generations?: number | null
          message_count?: number | null
          model_usage?: Json | null
          provider_usage?: Json | null
          total_completion_tokens?: number | null
          total_estimated_cost?: number | null
          total_prompt_tokens?: number | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id: string
          voice_minutes_used?: number | null
        }
        Update: {
          conversation_count?: number | null
          created_at?: string | null
          date?: string
          function_calls?: number | null
          id?: string
          image_generations?: number | null
          message_count?: number | null
          model_usage?: Json | null
          provider_usage?: Json | null
          total_completion_tokens?: number | null
          total_estimated_cost?: number | null
          total_prompt_tokens?: number | null
          total_tokens?: number | null
          updated_at?: string | null
          user_id?: string
          voice_minutes_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_aggregates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string | null
          endpoint: string
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          estimated_cost: number | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          method: string
          model_id: string | null
          processing_time_ms: number | null
          prompt_tokens: number | null
          provider_id: string | null
          queue_time_ms: number | null
          request_body: Json | null
          request_headers: Json | null
          response_headers: Json | null
          response_size_bytes: number | null
          response_time_ms: number | null
          status_code: number
          total_tokens: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string | null
          endpoint: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          method: string
          model_id?: string | null
          processing_time_ms?: number | null
          prompt_tokens?: number | null
          provider_id?: string | null
          queue_time_ms?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_headers?: Json | null
          response_size_bytes?: number | null
          response_time_ms?: number | null
          status_code: number
          total_tokens?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string | null
          endpoint?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          method?: string
          model_id?: string | null
          processing_time_ms?: number | null
          prompt_tokens?: number | null
          provider_id?: string | null
          queue_time_ms?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_headers?: Json | null
          response_size_bytes?: number | null
          response_time_ms?: number | null
          status_code?: number
          total_tokens?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          feedback_type: string
          id: string
          message: string
          rating: number | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          message: string
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          message?: string
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "recent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          daily_message_count: number | null
          display_name: string | null
          email: string
          id: string
          last_message_reset_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          preferences: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          total_message_count: number | null
          trial_ends_at: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          daily_message_count?: number | null
          display_name?: string | null
          email: string
          id: string
          last_message_reset_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          total_message_count?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          daily_message_count?: number | null
          display_name?: string | null
          email?: string
          id?: string
          last_message_reset_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          total_message_count?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_violations: {
        Row: {
          action_taken: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          severity: string
          user_id: string
          violation_type: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          severity: string
          user_id: string
          violation_type: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          severity?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_violations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          converted_to_user_at: string | null
          created_at: string | null
          email: string
          id: string
          interested_in: string[] | null
          referral_source: string | null
          user_id: string | null
        }
        Insert: {
          converted_to_user_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          interested_in?: string[] | null
          referral_source?: string | null
          user_id?: string | null
        }
        Update: {
          converted_to_user_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          interested_in?: string[] | null
          referral_source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_users_summary: {
        Row: {
          daily_active: number | null
          monthly_active: number | null
          signup_date: string | null
          total_users: number | null
          weekly_active: number | null
        }
        Relationships: []
      }
      feature_usage: {
        Row: {
          ai_responses: number | null
          avg_tokens_per_message: number | null
          date: string | null
          unique_users: number | null
          user_messages: number | null
        }
        Relationships: []
      }
      recent_conversations: {
        Row: {
          created_at: string | null
          id: string | null
          is_archived: boolean | null
          is_starred: boolean | null
          last_message: Json | null
          last_message_at: string | null
          message_count: number | null
          model_id: string | null
          provider_id: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          is_starred?: boolean | null
          last_message?: never
          last_message_at?: string | null
          message_count?: number | null
          model_id?: string | null
          provider_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_archived?: boolean | null
          is_starred?: boolean | null
          last_message?: never
          last_message_at?: string | null
          message_count?: number | null
          model_id?: string | null
          provider_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_database_performance: {
        Row: {
          active_connections: number | null
          database_size: string | null
          database_size_bytes: number | null
          idle_connections: number | null
          measured_at: string | null
          total_connections: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_old_conversations: {
        Args: { p_days_inactive?: number; p_user_id: string }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_increment?: number; p_limit_type: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_expired_api_keys: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_messages: {
        Args: { p_days_to_keep?: number; p_user_id: string }
        Returns: number
      }
      create_monthly_partition: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      daily_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      export_conversation_json: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: Json
      }
      get_conversation_messages: {
        Args: {
          p_before_id?: string
          p_conversation_id: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          attachments: Json
          content: string
          content_type: string
          created_at: string
          message_id: string
          model_id: string
          provider_id: string
          rating: number
          role: string
          total_tokens: number
        }[]
      }
      get_conversation_summary: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: {
          conversation_id: string
          estimated_cost: number
          first_message_at: string
          last_message_at: string
          message_count: number
          models_used: Json
          providers_used: Json
          title: string
          total_tokens: number
        }[]
      }
      get_conversations_with_last_message: {
        Args: {
          p_include_archived?: boolean
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          conversation_id: string
          created_at: string
          is_archived: boolean
          is_starred: boolean
          last_message_at: string
          last_message_content: string
          last_message_role: string
          message_count: number
          title: string
        }[]
      }
      get_or_set_cache: {
        Args: {
          p_compute_function: string
          p_key: string
          p_ttl_seconds?: number
        }
        Returns: Json
      }
      get_popular_topics: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          frequency: number
          word: string
        }[]
      }
      get_unused_indexes: {
        Args: Record<PropertyKey, never>
        Returns: {
          index_name: string
          index_scans: number
          index_size: string
          schema_name: string
          table_name: string
        }[]
      }
      get_user_stats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_usage_stats: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string }
        Returns: {
          avg_messages_per_day: number
          estimated_cost: number
          most_used_model: string
          most_used_provider: string
          peak_usage_count: number
          peak_usage_date: string
          total_conversations: number
          total_messages: number
          total_tokens: number
        }[]
      }
      log_query_performance: {
        Args: {
          p_metadata?: Json
          p_query_name: string
          p_rows_returned?: number
          p_start_time: string
          p_user_id?: string
        }
        Returns: undefined
      }
      log_slow_query: {
        Args: {
          p_execution_time_ms: number
          p_metadata?: Json
          p_query_name: string
          p_rows_returned?: number
          p_user_id?: string
        }
        Returns: string
      }
      perform_routine_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      refresh_recent_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_messages: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query: string
          p_user_id: string
        }
        Returns: {
          content: string
          conversation_id: string
          conversation_title: string
          created_at: string
          message_id: string
          rank: number
          role: string
        }[]
      }
      track_event: {
        Args: { p_event_data?: Json; p_event_type: string }
        Returns: undefined
      }
      track_query_performance: {
        Args: {
          p_metadata?: Json
          p_query_name: string
          p_rows_returned?: number
          p_start_time: string
          p_user_id?: string
        }
        Returns: undefined
      }
      update_daily_usage_aggregate: {
        Args: { p_date?: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
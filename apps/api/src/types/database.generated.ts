export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean | null
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      voice_usage: {
        Row: {
          created_at: string | null
          duration_seconds: number
          id: string
          model: string | null
          provider: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds: number
          id?: string
          model?: string | null
          provider?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number
          id?: string
          model?: string | null
          provider?: string | null
          type?: string
          user_id?: string
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
    }
    Functions: {
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
      PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never
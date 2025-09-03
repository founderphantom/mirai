// Database type definitions for Supabase - aligned with actual schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Core user profile with subscription info
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: 'free' | 'pro' | 'enterprise';
          subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          daily_message_count: number;
          total_message_count: number;
          last_message_at: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          daily_message_count?: number;
          total_message_count?: number;
          last_message_at?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          daily_message_count?: number;
          total_message_count?: number;
          last_message_at?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // Conversation threads
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          model: string;
          provider: 'openai' | 'anthropic' | 'google' | 'mistral';
          total_tokens: number;
          message_count: number;
          is_starred: boolean;
          is_archived: boolean;
          settings: Json;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          model: string;
          provider?: 'openai' | 'anthropic' | 'google' | 'mistral';
          total_tokens?: number;
          message_count?: number;
          is_starred?: boolean;
          is_archived?: boolean;
          settings?: Json;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          model?: string;
          provider?: 'openai' | 'anthropic' | 'google' | 'mistral';
          total_tokens?: number;
          message_count?: number;
          is_starred?: boolean;
          is_archived?: boolean;
          settings?: Json;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // Individual chat messages
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system' | 'function';
          content: string;
          content_type: 'text' | 'image' | 'audio' | 'code' | 'file';
          model: string | null;
          provider: 'openai' | 'anthropic' | 'google' | 'mistral' | null;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          total_tokens: number | null;
          attachments: Json | null; // Array of attachment objects
          metadata: Json | null;
          embedding: number[] | null; // For semantic search
          deleted_at: string | null; // Soft delete
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system' | 'function';
          content: string;
          content_type?: 'text' | 'image' | 'audio' | 'code' | 'file';
          model?: string | null;
          provider?: 'openai' | 'anthropic' | 'google' | 'mistral' | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          total_tokens?: number | null;
          attachments?: Json | null;
          metadata?: Json | null;
          embedding?: number[] | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: 'user' | 'assistant' | 'system' | 'function';
          content?: string;
          content_type?: 'text' | 'image' | 'audio' | 'code' | 'file';
          model?: string | null;
          provider?: 'openai' | 'anthropic' | 'google' | 'mistral' | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          total_tokens?: number | null;
          attachments?: Json | null;
          metadata?: Json | null;
          embedding?: number[] | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // Message attachments
      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string; // Path in Supabase Storage/S3
          url: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          url?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          storage_path?: string;
          url?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      
      // Usage tracking for rate limiting and billing
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          message_id: string | null;
          action: string;
          model: string | null;
          provider: string | null;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          cost: number;
          response_time_ms: number | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id?: string | null;
          message_id?: string | null;
          action: string;
          model?: string | null;
          provider?: string | null;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          cost: number;
          response_time_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string | null;
          message_id?: string | null;
          action?: string;
          model?: string | null;
          provider?: string | null;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost?: number;
          response_time_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      
      // Pre-computed daily usage summaries
      usage_daily_aggregates: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          total_messages: number;
          total_tokens: number;
          total_cost: number;
          models_used: Json; // { model: count }
          providers_used: Json; // { provider: count }
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          total_messages?: number;
          total_tokens?: number;
          total_cost?: number;
          models_used?: Json;
          providers_used?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          total_messages?: number;
          total_tokens?: number;
          total_cost?: number;
          models_used?: Json;
          providers_used?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // Subscription history tracking
      subscription_history: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          plan_id: string;
          tier: 'free' | 'pro' | 'enterprise';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
          amount: number;
          currency: string;
          interval: 'month' | 'year';
          started_at: string;
          ended_at: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          plan_id: string;
          tier: 'free' | 'pro' | 'enterprise';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
          amount: number;
          currency?: string;
          interval: 'month' | 'year';
          started_at: string;
          ended_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          plan_id?: string;
          tier?: 'free' | 'pro' | 'enterprise';
          status?: 'active' | 'canceled' | 'past_due' | 'trialing';
          amount?: number;
          currency?: string;
          interval?: 'month' | 'year';
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      
      // Payment history
      payment_history: {
        Row: {
          id: string;
          user_id: string;
          stripe_payment_intent_id: string;
          stripe_invoice_id: string | null;
          amount: number;
          currency: string;
          status: 'succeeded' | 'pending' | 'failed' | 'refunded';
          description: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_payment_intent_id: string;
          stripe_invoice_id?: string | null;
          amount: number;
          currency?: string;
          status: 'succeeded' | 'pending' | 'failed' | 'refunded';
          description?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_payment_intent_id?: string;
          stripe_invoice_id?: string | null;
          amount?: number;
          currency?: string;
          status?: 'succeeded' | 'pending' | 'failed' | 'refunded';
          description?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      
      // Content moderation logs
      moderation_logs: {
        Row: {
          id: string;
          user_id: string;
          message_id: string | null;
          content: string;
          flagged: boolean;
          categories: Json; // Array of flagged categories
          scores: Json; // Category scores
          action_taken: 'none' | 'warning' | 'blocked' | 'deleted';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message_id?: string | null;
          content: string;
          flagged: boolean;
          categories: Json;
          scores: Json;
          action_taken?: 'none' | 'warning' | 'blocked' | 'deleted';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message_id?: string | null;
          content?: string;
          flagged?: boolean;
          categories?: Json;
          scores?: Json;
          action_taken?: 'none' | 'warning' | 'blocked' | 'deleted';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
      };
      
      // User violations tracking
      user_violations: {
        Row: {
          id: string;
          user_id: string;
          type: 'content' | 'rate_limit' | 'abuse' | 'payment' | 'other';
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          action_taken: 'warning' | 'temporary_ban' | 'permanent_ban' | 'none';
          expires_at: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'content' | 'rate_limit' | 'abuse' | 'payment' | 'other';
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          action_taken?: 'warning' | 'temporary_ban' | 'permanent_ban' | 'none';
          expires_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'content' | 'rate_limit' | 'abuse' | 'payment' | 'other';
          severity?: 'low' | 'medium' | 'high' | 'critical';
          description?: string;
          action_taken?: 'warning' | 'temporary_ban' | 'permanent_ban' | 'none';
          expires_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      
      // Gaming sessions (existing)
      gaming_sessions: {
        Row: {
          id: string;
          user_id: string;
          game: 'minecraft' | 'roblox' | 'fortnite';
          session_id: string;
          status: 'active' | 'ended' | 'error';
          started_at: string;
          ended_at: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          game: 'minecraft' | 'roblox' | 'fortnite';
          session_id: string;
          status: 'active' | 'ended' | 'error';
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          game?: 'minecraft' | 'roblox' | 'fortnite';
          session_id?: string;
          status?: 'active' | 'ended' | 'error';
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // Optimized query functions
      get_conversations_with_last_message: {
        Args: {
          p_user_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          title: string;
          model: string;
          provider: string;
          total_tokens: number;
          message_count: number;
          is_starred: boolean;
          is_archived: boolean;
          last_message_at: string | null;
          last_message_content: string | null;
          last_message_role: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_conversation_messages: {
        Args: {
          p_conversation_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          role: string;
          content: string;
          content_type: string;
          model: string | null;
          provider: string | null;
          total_tokens: number | null;
          attachments: Json | null;
          created_at: string;
        }[];
      };
      search_messages: {
        Args: {
          p_user_id: string;
          p_query: string;
          p_limit?: number;
        };
        Returns: {
          message_id: string;
          conversation_id: string;
          conversation_title: string;
          content: string;
          role: string;
          similarity: number;
          created_at: string;
        }[];
      };
      get_user_usage_summary: {
        Args: {
          p_user_id: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: {
          total_messages: number;
          total_tokens: number;
          total_cost: number;
          daily_breakdown: Json;
        };
      };
    };
    Enums: {
      subscription_tier: 'free' | 'pro' | 'enterprise';
      subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
      message_role: 'user' | 'assistant' | 'system' | 'function';
      content_type: 'text' | 'image' | 'audio' | 'code' | 'file';
      provider: 'openai' | 'anthropic' | 'google' | 'mistral';
      payment_status: 'succeeded' | 'pending' | 'failed' | 'refunded';
      moderation_action: 'none' | 'warning' | 'blocked' | 'deleted';
      violation_type: 'content' | 'rate_limit' | 'abuse' | 'payment' | 'other';
      violation_severity: 'low' | 'medium' | 'high' | 'critical';
      violation_action: 'warning' | 'temporary_ban' | 'permanent_ban' | 'none';
      game_type: 'minecraft' | 'roblox' | 'fortnite';
      session_status: 'active' | 'ended' | 'error';
    };
  };
}

// Helper types for common use cases
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type MessageAttachment = Database['public']['Tables']['message_attachments']['Row'];
export type UsageLog = Database['public']['Tables']['usage_logs']['Row'];
export type SubscriptionHistory = Database['public']['Tables']['subscription_history']['Row'];
export type PaymentHistory = Database['public']['Tables']['payment_history']['Row'];
export type ModerationLog = Database['public']['Tables']['moderation_logs']['Row'];
export type UserViolation = Database['public']['Tables']['user_violations']['Row'];

// Insert/Update types
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert'];
export type ChatMessageUpdate = Database['public']['Tables']['chat_messages']['Update'];
export type UsageLogInsert = Database['public']['Tables']['usage_logs']['Insert'];

// Function return types
export type ConversationWithLastMessage = Database['public']['Functions']['get_conversations_with_last_message']['Returns'][0];
export type MessageSearchResult = Database['public']['Functions']['search_messages']['Returns'][0];
export type UsageSummary = Database['public']['Functions']['get_user_usage_summary']['Returns'];
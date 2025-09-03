import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Public client for client-side operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-application-name': 'airi-api',
    },
  },
});

// Service role client for admin operations
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      'x-application-name': 'airi-api-admin',
    },
  },
});

// Helper function to get user client with specific access token
export const getSupabaseClient = (accessToken?: string): SupabaseClient<Database> => {
  if (!accessToken) {
    return supabase;
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

// Database helper functions
export const dbHelpers = {
  // Get user by ID
  async getUserById(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get user profile
  async getUserProfile(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get user subscription
  async getUserSubscription(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return { data, error };
  },

  // Create conversation
  async createConversation(userId: string, title: string, aiModel: string) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: userId,
        title,
        ai_model: aiModel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Add message to conversation
  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get conversation messages
  async getConversationMessages(conversationId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Update usage metrics
  async updateUsageMetrics(userId: string, tokens: number, model: string) {
    const { error } = await supabaseAdmin
      .from('usage_metrics')
      .insert({
        user_id: userId,
        tokens_used: tokens,
        model_used: model,
        timestamp: new Date().toISOString(),
      });

    if (error) throw error;
  },

  // Check rate limit
  async checkRateLimit(userId: string, limit: number): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    
    const { count, error } = await supabaseAdmin
      .from('api_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if (error) throw error;
    return (count || 0) < limit;
  },

  // Log API request
  async logApiRequest(userId: string, endpoint: string, method: string, statusCode: number) {
    const { error } = await supabaseAdmin
      .from('api_requests')
      .insert({
        user_id: userId,
        endpoint,
        method,
        status_code: statusCode,
        created_at: new Date().toISOString(),
      });

    if (error) console.error('Failed to log API request:', error);
  },
};

// Real-time subscriptions helper
export const realtimeHelpers = {
  // Subscribe to conversation updates
  subscribeToConversation(conversationId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to user notifications
  subscribeToUserNotifications(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  // Unsubscribe from channel
  unsubscribe(channel: any) {
    return supabase.removeChannel(channel);
  },
};

export default supabase;
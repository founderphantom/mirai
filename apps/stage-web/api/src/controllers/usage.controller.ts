import { Request, Response } from 'express';
import { getAdminClient } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Get current usage statistics
 */
export const getCurrentUsage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tier = req.user!.subscription_tier;
    
    const adminClient = getAdminClient();
    
    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayMessages } = await adminClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', today.toISOString());
    
    // Get this month's usage
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const { data: monthlyMessages } = await adminClient
      .from('chat_messages')
      .select('total_tokens, created_at')
      .eq('user_id', userId)
      .gte('created_at', firstDayOfMonth.toISOString());
    
    // Calculate token usage
    const totalTokens = monthlyMessages?.reduce((sum, msg) => sum + (msg.total_tokens || 0), 0) || 0;
    
    // Get voice usage if applicable
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('voice_minutes_used, daily_message_count')
      .eq('id', userId)
      .single();
    
    const limits = config.rateLimit.tiers[tier as keyof typeof config.rateLimit.tiers];
    
    res.json({
      period: {
        start: firstDayOfMonth.toISOString(),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString()
      },
      messages: {
        today: todayMessages || 0,
        daily_limit: limits.messagesPerDay,
        monthly: monthlyMessages?.length || 0
      },
      tokens: {
        used: totalTokens,
        limit: tier === 'pro' || tier === 'enterprise' ? -1 : 100000
      },
      voice_minutes: {
        used: profile?.voice_minutes_used || 0,
        limit: tier === 'free' ? 0 : tier === 'plus' ? 60 : tier === 'pro' ? 300 : -1
      },
      remaining: {
        messages: limits.messagesPerDay === -1 ? -1 : Math.max(0, limits.messagesPerDay - (todayMessages || 0)),
        tokens: tier === 'pro' || tier === 'enterprise' ? -1 : Math.max(0, 100000 - totalTokens)
      }
    });
  } catch (error) {
    logger.error('Get current usage error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
};

/**
 * Get usage history
 */
export const getUsageHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;
    
    const adminClient = getAdminClient();
    
    // Default to last 30 days
    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date 
      ? new Date(start_date as string) 
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get daily usage
    const { data: messages } = await adminClient
      .from('chat_messages')
      .select('created_at, total_tokens, role')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });
    
    // Group by day
    const dailyUsage = new Map<string, { messages: number; tokens: number }>();
    
    messages?.forEach(msg => {
      const date = new Date(msg.created_at).toISOString().split('T')[0];
      const current = dailyUsage.get(date) || { messages: 0, tokens: 0 };
      
      if (msg.role === 'user') {
        current.messages++;
      }
      current.tokens += msg.total_tokens || 0;
      
      dailyUsage.set(date, current);
    });
    
    // Convert to array
    const history = Array.from(dailyUsage.entries()).map(([date, usage]) => ({
      date,
      messages: usage.messages,
      tokens: usage.tokens
    }));
    
    res.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      history,
      summary: {
        total_messages: history.reduce((sum, day) => sum + day.messages, 0),
        total_tokens: history.reduce((sum, day) => sum + day.tokens, 0),
        average_daily_messages: history.length ? 
          Math.round(history.reduce((sum, day) => sum + day.messages, 0) / history.length) : 0
      }
    });
  } catch (error) {
    logger.error('Get usage history error:', error);
    res.status(500).json({ error: 'Failed to get usage history' });
  }
};

/**
 * Get usage quota and limits
 */
export const getQuota = async (req: Request, res: Response) => {
  try {
    const tier = req.user!.subscription_tier;
    
    const quotas = {
      free: {
        messages_per_day: 50,
        tokens_per_month: 50000,
        voice_minutes: 0,
        storage_mb: 100,
        api_calls_per_hour: 0,
        concurrent_conversations: 3
      },
      plus: {
        messages_per_day: 500,
        tokens_per_month: 500000,
        voice_minutes: 60,
        storage_mb: 1000,
        api_calls_per_hour: 100,
        concurrent_conversations: 10
      },
      pro: {
        messages_per_day: -1, // unlimited
        tokens_per_month: -1,
        voice_minutes: 300,
        storage_mb: 10000,
        api_calls_per_hour: 1000,
        concurrent_conversations: -1
      },
      enterprise: {
        messages_per_day: -1,
        tokens_per_month: -1,
        voice_minutes: -1,
        storage_mb: -1,
        api_calls_per_hour: -1,
        concurrent_conversations: -1
      }
    };
    
    res.json(quotas[tier as keyof typeof quotas] || quotas.free);
  } catch (error) {
    logger.error('Get quota error:', error);
    res.status(500).json({ error: 'Failed to get quota' });
  }
};

/**
 * Reset daily usage counters (called by cron job)
 */
export const resetDailyUsage = async (req: Request, res: Response) => {
  try {
    // Verify internal API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const adminClient = getAdminClient();
    
    // Reset daily message counts for all users
    const { error } = await adminClient
      .from('user_profiles')
      .update({ 
        daily_message_count: 0,
        last_message_reset_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    
    if (error) {
      throw error;
    }
    
    res.json({ message: 'Daily usage reset successfully' });
  } catch (error) {
    logger.error('Reset daily usage error:', error);
    res.status(500).json({ error: 'Failed to reset daily usage' });
  }
};

/**
 * Reset monthly usage counters (called by cron job)
 */
export const resetMonthlyUsage = async (req: Request, res: Response) => {
  try {
    // Verify internal API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const adminClient = getAdminClient();
    
    // Reset monthly counters
    const { error } = await adminClient
      .from('user_profiles')
      .update({ 
        voice_minutes_used: 0,
        monthly_token_count: 0,
        last_monthly_reset_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    
    if (error) {
      throw error;
    }
    
    res.json({ message: 'Monthly usage reset successfully' });
  } catch (error) {
    logger.error('Reset monthly usage error:', error);
    res.status(500).json({ error: 'Failed to reset monthly usage' });
  }
};
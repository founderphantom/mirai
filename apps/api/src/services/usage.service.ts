import { supabase } from '../lib/supabase';
import {
  UsageLog,
  UsageLogInsert,
  UsageSummary,
  Json
} from '../types/database';

interface TokenCost {
  promptCost: number;
  completionCost: number;
  totalCost: number;
}

// Token pricing per 1K tokens (in USD)
const TOKEN_PRICING: Record<string, { prompt: number; completion: number }> = {
  // OpenAI
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'gpt-3.5-turbo-16k': { prompt: 0.001, completion: 0.002 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4-32k': { prompt: 0.06, completion: 0.12 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  
  // Anthropic
  'claude-3-opus': { prompt: 0.015, completion: 0.075 },
  'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
  'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
  'claude-2.1': { prompt: 0.008, completion: 0.024 },
  
  // Google
  'gemini-pro': { prompt: 0.00025, completion: 0.0005 },
  'gemini-pro-vision': { prompt: 0.00025, completion: 0.0005 },
  
  // Mistral
  'mistral-tiny': { prompt: 0.00014, completion: 0.00042 },
  'mistral-small': { prompt: 0.0006, completion: 0.0018 },
  'mistral-medium': { prompt: 0.0027, completion: 0.0081 },
  'mistral-large': { prompt: 0.008, completion: 0.024 }
};

export class UsageService {
  /**
   * Log API usage
   */
  async logUsage(data: UsageLogInsert): Promise<UsageLog> {
    // Calculate cost if not provided
    if (!data.cost && data.model) {
      const cost = this.calculateCost(
        data.model,
        data.prompt_tokens,
        data.completion_tokens
      );
      data.cost = cost.totalCost;
    }

    const { data: log, error } = await (supabase
      .from('usage_logs') as any)
      .insert({
        ...data,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log usage: ${error.message}`);
    }

    // Update daily aggregate asynchronously
    this.updateDailyAggregate(data.user_id, log).catch(err => {
      console.error('Failed to update daily aggregate:', err);
    });

    return log;
  }

  /**
   * Calculate token cost based on model pricing
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): TokenCost {
    const pricing = TOKEN_PRICING[model] || { prompt: 0, completion: 0 };
    
    const promptCost = (promptTokens / 1000) * pricing.prompt;
    const completionCost = (completionTokens / 1000) * pricing.completion;
    const totalCost = promptCost + completionCost;

    return {
      promptCost: Math.round(promptCost * 1000000) / 1000000, // Round to 6 decimal places
      completionCost: Math.round(completionCost * 1000000) / 1000000,
      totalCost: Math.round(totalCost * 1000000) / 1000000
    };
  }

  /**
   * Update daily usage aggregate
   */
  private async updateDailyAggregate(userId: string, log: UsageLog): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Check if aggregate exists for today
    const { data: existing } = await (supabase
      .from('usage_daily_aggregates') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing aggregate
      const modelsUsed = existing.models_used as Record<string, number> || {};
      const providersUsed = existing.providers_used as Record<string, number> || {};

      if (log.model) {
        modelsUsed[log.model] = (modelsUsed[log.model] || 0) + 1;
      }
      if (log.provider) {
        providersUsed[log.provider] = (providersUsed[log.provider] || 0) + 1;
      }

      await (supabase
      .from('usage_daily_aggregates') as any)
        .update({
          total_messages: existing.total_messages + 1,
          total_tokens: existing.total_tokens + log.total_tokens,
          total_cost: existing.total_cost + log.cost,
          models_used: modelsUsed as Json,
          providers_used: providersUsed as Json,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new aggregate
      const modelsUsed: Record<string, number> = {};
      const providersUsed: Record<string, number> = {};

      if (log.model) {
        modelsUsed[log.model] = 1;
      }
      if (log.provider) {
        providersUsed[log.provider] = 1;
      }

      await (supabase
      .from('usage_daily_aggregates') as any)
        .insert({
          user_id: userId,
          date: today,
          total_messages: 1,
          total_tokens: log.total_tokens,
          total_cost: log.cost,
          models_used: modelsUsed as Json,
          providers_used: providersUsed as Json
        });
    }
  }

  /**
   * Get usage logs for a user
   */
  async getUserUsageLogs(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UsageLog[]> {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      limit = 100,
      offset = 0
    } = options;

    const { data, error } = await (supabase
      .from('usage_logs') as any)
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch usage logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get usage summary using the optimized function
   */
  async getUserUsageSummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageSummary> {
    const { data, error } = await ((supabase as any)
      .rpc('get_user_usage_summary', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate
      }));

    if (error) {
      throw new Error(`Failed to fetch usage summary: ${error.message}`);
    }

    return data;
  }

  /**
   * Get daily aggregates for a user
   */
  async getDailyAggregates(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const { data, error } = await (supabase
      .from('usage_daily_aggregates') as any)
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch daily aggregates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get current month usage for billing
   */
  async getCurrentMonthUsage(userId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    messageCount: number;
    byModel: Record<string, { tokens: number; cost: number; count: number }>;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const { data, error } = await (supabase
      .from('usage_logs') as any)
      .select('total_tokens, cost, model')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    if (error) {
      throw new Error(`Failed to fetch monthly usage: ${error.message}`);
    }

    const result = {
      totalTokens: 0,
      totalCost: 0,
      messageCount: data?.length || 0,
      byModel: {} as Record<string, { tokens: number; cost: number; count: number }>
    };

    if (data) {
      for (const log of data) {
        result.totalTokens += log.total_tokens || 0;
        result.totalCost += log.cost || 0;

        if (log.model) {
          if (!result.byModel[log.model]) {
            result.byModel[log.model] = { tokens: 0, cost: 0, count: 0 };
          }
          result.byModel[log.model].tokens += log.total_tokens || 0;
          result.byModel[log.model].cost += log.cost || 0;
          result.byModel[log.model].count += 1;
        }
      }
    }

    // Round costs to 6 decimal places
    result.totalCost = Math.round(result.totalCost * 1000000) / 1000000;
    for (const model in result.byModel) {
      result.byModel[model].cost = Math.round(result.byModel[model].cost * 1000000) / 1000000;
    }

    return result;
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(
    userId: string,
    action: string,
    limit: number,
    window: number // in seconds
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const windowStart = new Date(Date.now() - window * 1000);

    const { data, error } = await (supabase
      .from('usage_logs') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString());

    if (error) {
      throw new Error(`Failed to check rate limit: ${error.message}`);
    }

    const count = data?.length || 0;
    const remaining = Math.max(0, limit - count);
    const resetAt = new Date(windowStart.getTime() + window * 1000);

    return {
      allowed: count < limit,
      remaining,
      resetAt
    };
  }

  /**
   * Get usage statistics by provider
   */
  async getProviderStats(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, {
    totalTokens: number;
    totalCost: number;
    messageCount: number;
    averageTokensPerMessage: number;
  }>> {
    const { data, error } = await (supabase
      .from('usage_logs') as any)
      .select('provider, total_tokens, cost')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw new Error(`Failed to fetch provider stats: ${error.message}`);
    }

    const stats: Record<string, any> = {};

    if (data) {
      for (const log of data) {
        if (!log.provider) continue;

        if (!stats[log.provider]) {
          stats[log.provider] = {
            totalTokens: 0,
            totalCost: 0,
            messageCount: 0,
            averageTokensPerMessage: 0
          };
        }

        stats[log.provider].totalTokens += log.total_tokens || 0;
        stats[log.provider].totalCost += log.cost || 0;
        stats[log.provider].messageCount += 1;
      }

      // Calculate averages
      for (const provider in stats) {
        if (stats[provider].messageCount > 0) {
          stats[provider].averageTokensPerMessage = Math.round(
            stats[provider].totalTokens / stats[provider].messageCount
          );
        }
        stats[provider].totalCost = Math.round(stats[provider].totalCost * 1000000) / 1000000;
      }
    }

    return stats;
  }

  /**
   * Export usage data as CSV
   */
  async exportUsageAsCSV(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<string> {
    const logs = await this.getUserUsageLogs(userId, { startDate, endDate, limit: 10000 });

    let csv = 'Date,Action,Model,Provider,Prompt Tokens,Completion Tokens,Total Tokens,Cost,Response Time (ms)\n';

    for (const log of logs) {
      csv += `${log.created_at},${log.action},${log.model || ''},${log.provider || ''},`;
      csv += `${log.prompt_tokens},${log.completion_tokens},${log.total_tokens},`;
      csv += `${log.cost},${log.response_time_ms || ''}\n`;
    }

    return csv;
  }

  /**
   * Clean up old usage logs (maintenance task)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await (supabase
      .from('usage_logs') as any)
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) {
      throw new Error(`Failed to cleanup old logs: ${error.message}`);
    }

    return data?.length || 0;
  }
}

// Export singleton instance
export const usageService = new UsageService();
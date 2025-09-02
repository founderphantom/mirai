import { api } from '@/lib/api-client';

export interface UsageStats {
  period: 'day' | 'week' | 'month' | 'year';
  start_date: string;
  end_date: string;
  messages: {
    total: number;
    by_role: {
      user: number;
      assistant: number;
      system: number;
    };
    daily: Array<{
      date: string;
      count: number;
    }>;
  };
  tokens: {
    total: number;
    prompt: number;
    completion: number;
    by_model: Record<string, number>;
    daily: Array<{
      date: string;
      count: number;
    }>;
  };
  conversations: {
    total: number;
    active: number;
    archived: number;
    average_length: number;
    daily: Array<{
      date: string;
      count: number;
    }>;
  };
  costs: {
    total: number;
    by_provider: Record<string, number>;
    by_model: Record<string, number>;
    currency: string;
    daily: Array<{
      date: string;
      amount: number;
    }>;
  };
  storage: {
    total_bytes: number;
    attachments_bytes: number;
    conversations_bytes: number;
    limit_bytes: number;
  };
}

export interface UsageLimit {
  resource: 'messages' | 'tokens' | 'storage' | 'api_calls';
  current: number;
  limit: number;
  reset_at: string;
  tier: string;
}

export interface UsageAlert {
  id: string;
  type: 'warning' | 'critical';
  resource: string;
  message: string;
  threshold: number;
  current_usage: number;
  created_at: string;
  acknowledged: boolean;
}

export interface UsageExport {
  format: 'json' | 'csv' | 'pdf';
  period: 'day' | 'week' | 'month' | 'year' | 'custom';
  start_date?: string;
  end_date?: string;
  include_details?: boolean;
}

class UsageService {
  /**
   * Get usage statistics
   */
  async getUsageStats(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<UsageStats> {
    const { data } = await api.get<UsageStats>('/usage/stats', {
      params: { period },
    });
    return data;
  }

  /**
   * Get usage for a specific date range
   */
  async getUsageByDateRange(startDate: string, endDate: string): Promise<UsageStats> {
    const { data } = await api.get<UsageStats>('/usage/stats', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return data;
  }

  /**
   * Get current usage limits
   */
  async getUsageLimits(): Promise<UsageLimit[]> {
    const { data } = await api.get<UsageLimit[]>('/usage/limits');
    return data;
  }

  /**
   * Get usage alerts
   */
  async getUsageAlerts(unacknowledgedOnly: boolean = false): Promise<UsageAlert[]> {
    const { data } = await api.get<UsageAlert[]>('/usage/alerts', {
      params: { unacknowledged_only: unacknowledgedOnly },
    });
    return data;
  }

  /**
   * Acknowledge usage alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await api.patch(`/usage/alerts/${alertId}/acknowledge`);
  }

  /**
   * Get real-time usage
   */
  async getRealtimeUsage(): Promise<{
    messages_today: number;
    tokens_today: number;
    cost_today: number;
    active_conversations: number;
    last_activity: string;
  }> {
    const { data } = await api.get('/usage/realtime');
    return data;
  }

  /**
   * Export usage data
   */
  async exportUsage(options: UsageExport): Promise<Blob> {
    const { data } = await api.post('/usage/export', options, {
      responseType: 'blob',
    });
    return data;
  }

  /**
   * Get usage by conversation
   */
  async getConversationUsage(conversationId: string): Promise<{
    conversation_id: string;
    messages: number;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost: number;
    duration: number;
    created_at: string;
    last_message_at: string;
  }> {
    const { data } = await api.get(`/usage/conversations/${conversationId}`);
    return data;
  }

  /**
   * Get top models by usage
   */
  async getTopModels(limit: number = 5): Promise<Array<{
    model_id: string;
    provider_id: string;
    usage_count: number;
    total_tokens: number;
    total_cost: number;
    average_response_time: number;
  }>> {
    const { data } = await api.get('/usage/top-models', {
      params: { limit },
    });
    return data;
  }

  /**
   * Get usage trends
   */
  async getUsageTrends(period: 'week' | 'month' | 'quarter' = 'month'): Promise<{
    messages: {
      current: number;
      previous: number;
      change_percent: number;
      trend: 'up' | 'down' | 'stable';
    };
    tokens: {
      current: number;
      previous: number;
      change_percent: number;
      trend: 'up' | 'down' | 'stable';
    };
    costs: {
      current: number;
      previous: number;
      change_percent: number;
      trend: 'up' | 'down' | 'stable';
    };
    predictions: {
      estimated_monthly_cost: number;
      estimated_monthly_tokens: number;
      will_exceed_limit: boolean;
      days_until_limit: number | null;
    };
  }> {
    const { data } = await api.get('/usage/trends', {
      params: { period },
    });
    return data;
  }

  /**
   * Set usage alert threshold
   */
  async setAlertThreshold(resource: string, threshold: number): Promise<void> {
    await api.post('/usage/alerts/threshold', {
      resource,
      threshold,
    });
  }

  /**
   * Get usage breakdown by feature
   */
  async getFeatureUsage(): Promise<{
    chat: number;
    voice: number;
    file_uploads: number;
    api_calls: number;
    custom_avatars: number;
  }> {
    const { data } = await api.get('/usage/features');
    return data;
  }
}

export const usageService = new UsageService();
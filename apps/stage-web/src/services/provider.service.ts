import { api } from '@/lib/api-client';

export interface AIProvider {
  id: string;
  name: string;
  type: 'llm' | 'tts' | 'stt' | 'image' | 'embedding';
  description?: string;
  website?: string;
  documentation_url?: string;
  supported_models: AIModel[];
  features: {
    streaming: boolean;
    function_calling: boolean;
    vision: boolean;
    audio: boolean;
    embeddings: boolean;
  };
  pricing?: {
    input_cost_per_1k?: number;
    output_cost_per_1k?: number;
    currency: string;
  };
  status: 'available' | 'beta' | 'deprecated' | 'unavailable';
  tier_required: 'free' | 'plus' | 'pro' | 'enterprise';
}

export interface AIModel {
  id: string;
  name: string;
  provider_id: string;
  description?: string;
  context_length: number;
  max_output_tokens: number;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_streaming?: boolean;
  knowledge_cutoff?: string;
  tier_required: 'free' | 'plus' | 'pro' | 'enterprise';
  deprecated?: boolean;
  replacement_model?: string;
}

export interface ProviderConfig {
  provider_id: string;
  enabled: boolean;
  api_key?: string;
  api_endpoint?: string;
  organization_id?: string;
  default_model?: string;
  settings?: Record<string, any>;
}

export interface TestProviderData {
  provider_id: string;
  api_key?: string;
  api_endpoint?: string;
  model?: string;
  test_message?: string;
}

class ProviderService {
  /**
   * Get all available providers
   */
  async getProviders(): Promise<AIProvider[]> {
    const { data } = await api.get<AIProvider[]>('/providers');
    return data;
  }

  /**
   * Get a specific provider
   */
  async getProvider(providerId: string): Promise<AIProvider> {
    const { data } = await api.get<AIProvider>(`/providers/${providerId}`);
    return data;
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(providerId: string): Promise<AIModel[]> {
    const { data } = await api.get<AIModel[]>(`/providers/${providerId}/models`);
    return data;
  }

  /**
   * Get all available models across all providers
   */
  async getAllModels(): Promise<AIModel[]> {
    const { data } = await api.get<AIModel[]>('/providers/models');
    return data;
  }

  /**
   * Get user's provider configurations
   */
  async getUserConfigs(): Promise<ProviderConfig[]> {
    const { data } = await api.get<ProviderConfig[]>('/providers/configs');
    return data;
  }

  /**
   * Get configuration for a specific provider
   */
  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    try {
      const { data } = await api.get<ProviderConfig>(`/providers/configs/${providerId}`);
      return data;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save provider configuration
   */
  async saveProviderConfig(config: ProviderConfig): Promise<ProviderConfig> {
    const { data } = await api.post<ProviderConfig>('/providers/configs', config);
    return data;
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(providerId: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const { data } = await api.patch<ProviderConfig>(`/providers/configs/${providerId}`, updates);
    return data;
  }

  /**
   * Delete provider configuration
   */
  async deleteProviderConfig(providerId: string): Promise<void> {
    await api.delete(`/providers/configs/${providerId}`);
  }

  /**
   * Test provider configuration
   */
  async testProvider(testData: TestProviderData): Promise<{
    success: boolean;
    message: string;
    response?: string;
    latency?: number;
    error?: string;
  }> {
    const { data } = await api.post('/providers/test', testData);
    return data;
  }

  /**
   * Get provider usage statistics
   */
  async getProviderUsage(providerId: string, period?: 'day' | 'week' | 'month'): Promise<{
    provider_id: string;
    period: string;
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    usage_by_model: Array<{
      model_id: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
    daily_usage: Array<{
      date: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
  }> {
    const { data } = await api.get(`/providers/${providerId}/usage`, {
      params: { period },
    });
    return data;
  }

  /**
   * Get recommended providers based on use case
   */
  async getRecommendedProviders(useCase?: 'chat' | 'code' | 'creative' | 'analysis'): Promise<AIProvider[]> {
    const { data } = await api.get<AIProvider[]>('/providers/recommended', {
      params: { use_case: useCase },
    });
    return data;
  }

  /**
   * Check provider availability
   */
  async checkAvailability(providerId: string): Promise<{
    available: boolean;
    latency?: number;
    region?: string;
    message?: string;
  }> {
    const { data } = await api.get(`/providers/${providerId}/availability`);
    return data;
  }

  /**
   * Get provider API key requirements
   */
  async getProviderRequirements(providerId: string): Promise<{
    requires_api_key: boolean;
    requires_organization_id: boolean;
    supports_custom_endpoint: boolean;
    default_endpoint?: string;
    documentation_url?: string;
    setup_instructions?: string[];
  }> {
    const { data } = await api.get(`/providers/${providerId}/requirements`);
    return data;
  }
}

export const providerService = new ProviderService();
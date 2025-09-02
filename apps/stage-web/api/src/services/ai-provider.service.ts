import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AIProviderError, handleAIProviderError } from '../utils/errors.js';
import { getAdminClient } from '../database/connection.js';
import pRetry from 'p-retry';

// Provider types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userId?: string;
}

export interface ChatCompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason?: string;
  model: string;
  provider: string;
}

// Initialize AI providers
const openaiClient = config.aiProviders.openai.apiKey 
  ? new OpenAI({ apiKey: config.aiProviders.openai.apiKey })
  : null;

const anthropicClient = config.aiProviders.anthropic.apiKey
  ? new Anthropic({ apiKey: config.aiProviders.anthropic.apiKey })
  : null;

const googleClient = config.aiProviders.google.apiKey
  ? new GoogleGenerativeAI(config.aiProviders.google.apiKey)
  : null;

const groqClient = config.aiProviders.groq.apiKey
  ? new Groq({ apiKey: config.aiProviders.groq.apiKey })
  : null;

/**
 * AI Provider Service
 */
export class AIProviderService {
  /**
   * Get chat completion from the specified provider
   */
  async getChatCompletion(
    provider: string,
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    
    try {
      // Update provider health check
      await this.updateProviderHealth(provider, 'healthy');
      
      // Route to appropriate provider
      let response: ChatCompletionResponse;
      
      switch (provider.toLowerCase()) {
        case 'openai':
          response = await this.getOpenAICompletion(options);
          break;
        case 'anthropic':
          response = await this.getAnthropicCompletion(options);
          break;
        case 'google':
          response = await this.getGoogleCompletion(options);
          break;
        case 'groq':
          response = await this.getGroqCompletion(options);
          break;
        default:
          throw new AIProviderError(provider, `Unsupported provider: ${provider}`);
      }
      
      // Log successful request
      const duration = Date.now() - startTime;
      logger.info('AI Provider Request Success', {
        provider,
        model: options.model,
        duration: `${duration}ms`,
        tokens: response.totalTokens,
      });
      
      // Track usage
      if (options.userId) {
        await this.trackUsage(options.userId, provider, options.model, response);
      }
      
      return response;
    } catch (error) {
      // Update provider health
      await this.updateProviderHealth(provider, 'degraded');
      
      // Handle and rethrow error
      throw handleAIProviderError(provider, error);
    }
  }

  /**
   * OpenAI completion
   */
  private async getOpenAICompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!openaiClient) {
      throw new AIProviderError('openai', 'OpenAI client not configured');
    }
    
    const completion = await pRetry(
      async () => {
        return await openaiClient.chat.completions.create({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          stream: false,
        });
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`OpenAI attempt ${error.attemptNumber} failed:`, error.message);
        },
      }
    );
    
    const choice = completion.choices[0];
    
    return {
      content: choice.message.content || '',
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      finishReason: choice.finish_reason || undefined,
      model: completion.model,
      provider: 'openai',
    };
  }

  /**
   * Anthropic completion
   */
  private async getAnthropicCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!anthropicClient) {
      throw new AIProviderError('anthropic', 'Anthropic client not configured');
    }
    
    // Convert messages to Anthropic format
    const systemMessage = options.messages.find(m => m.role === 'system')?.content;
    const messages = options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    
    const completion = await pRetry(
      async () => {
        return await anthropicClient.messages.create({
          model: options.model,
          messages,
          system: systemMessage,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        });
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Anthropic attempt ${error.attemptNumber} failed:`, error.message);
        },
      }
    );
    
    // Calculate tokens (Anthropic doesn't provide exact counts)
    const promptTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const completionTokens = Math.ceil(completion.content[0].text.length / 4);
    
    return {
      content: completion.content[0].text,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      finishReason: completion.stop_reason || undefined,
      model: completion.model,
      provider: 'anthropic',
    };
  }

  /**
   * Google completion
   */
  private async getGoogleCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!googleClient) {
      throw new AIProviderError('google', 'Google AI client not configured');
    }
    
    const model = googleClient.getGenerativeModel({ model: options.model });
    
    // Convert messages to Google format
    const chat = model.startChat({
      history: options.messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    });
    
    const lastMessage = options.messages[options.messages.length - 1];
    const result = await pRetry(
      async () => {
        return await chat.sendMessage(lastMessage.content);
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Google AI attempt ${error.attemptNumber} failed:`, error.message);
        },
      }
    );
    
    const response = await result.response;
    const text = response.text();
    
    // Estimate tokens (Google doesn't provide exact counts)
    const promptTokens = Math.ceil(JSON.stringify(options.messages).length / 4);
    const completionTokens = Math.ceil(text.length / 4);
    
    return {
      content: text,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      finishReason: response.candidates?.[0]?.finishReason,
      model: options.model,
      provider: 'google',
    };
  }

  /**
   * Groq completion
   */
  private async getGroqCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!groqClient) {
      throw new AIProviderError('groq', 'Groq client not configured');
    }
    
    const completion = await pRetry(
      async () => {
        return await groqClient.chat.completions.create({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          stream: false,
        });
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Groq attempt ${error.attemptNumber} failed:`, error.message);
        },
      }
    );
    
    const choice = completion.choices[0];
    
    return {
      content: choice.message.content || '',
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      finishReason: choice.finish_reason || undefined,
      model: completion.model,
      provider: 'groq',
    };
  }

  /**
   * Get available models for a user based on their subscription
   */
  async getAvailableModels(subscriptionTier: string): Promise<any[]> {
    const models = [];
    
    // Free tier - basic models only
    if (subscriptionTier === 'free') {
      models.push(
        { provider: 'openai', model: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { provider: 'google', model: 'gemini-pro', name: 'Gemini Pro' },
      );
    }
    
    // Plus tier - more models
    if (['plus', 'pro', 'enterprise'].includes(subscriptionTier)) {
      models.push(
        { provider: 'openai', model: 'gpt-4', name: 'GPT-4' },
        { provider: 'openai', model: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { provider: 'anthropic', model: 'claude-3-haiku', name: 'Claude 3 Haiku' },
        { provider: 'anthropic', model: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
        { provider: 'groq', model: 'mixtral-8x7b', name: 'Mixtral 8x7B' },
      );
    }
    
    // Pro/Enterprise - all models
    if (['pro', 'enterprise'].includes(subscriptionTier)) {
      models.push(
        { provider: 'anthropic', model: 'claude-3-opus', name: 'Claude 3 Opus' },
        { provider: 'groq', model: 'llama-3-70b', name: 'Llama 3 70B' },
      );
    }
    
    // Check provider health and filter out unhealthy ones
    const healthyProviders = await this.getHealthyProviders();
    
    return models.filter(model => 
      healthyProviders.includes(model.provider)
    );
  }

  /**
   * Check content for policy violations using OpenAI moderation
   */
  async moderateContent(content: string): Promise<any> {
    if (!openaiClient) {
      // Return safe if we can't moderate
      return { flagged: false, categories: {}, scores: {} };
    }
    
    try {
      const moderation = await openaiClient.moderations.create({
        input: content,
      });
      
      const result = moderation.results[0];
      
      return {
        flagged: result.flagged,
        categories: result.categories,
        scores: result.category_scores,
      };
    } catch (error) {
      logger.error('Content moderation failed:', error);
      // Don't block on moderation failure
      return { flagged: false, categories: {}, scores: {} };
    }
  }

  /**
   * Get healthy providers
   */
  private async getHealthyProviders(): Promise<string[]> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('provider_health')
      .select('id')
      .in('status', ['healthy', 'degraded']);
    
    if (error) {
      logger.error('Failed to get provider health:', error);
      return ['openai', 'anthropic', 'google', 'groq']; // Return all by default
    }
    
    return data.map(p => p.id);
  }

  /**
   * Update provider health status
   */
  private async updateProviderHealth(provider: string, status: 'healthy' | 'degraded' | 'unhealthy'): Promise<void> {
    try {
      const adminClient = getAdminClient();
      await adminClient
        .from('provider_health')
        .update({
          status,
          last_check_at: new Date().toISOString(),
        })
        .eq('id', provider.toLowerCase());
    } catch (error) {
      logger.error('Failed to update provider health:', error);
    }
  }

  /**
   * Track token usage for billing
   */
  private async trackUsage(
    userId: string,
    provider: string,
    model: string,
    response: ChatCompletionResponse
  ): Promise<void> {
    try {
      const adminClient = getAdminClient();
      
      // Calculate estimated cost
      const estimatedCost = this.calculateCost(provider, model, response);
      
      // Insert usage log
      await adminClient.from('usage_logs').insert({
        user_id: userId,
        endpoint: '/chat/completion',
        method: 'POST',
        status_code: 200,
        prompt_tokens: response.promptTokens,
        completion_tokens: response.completionTokens,
        total_tokens: response.totalTokens,
        provider_id: provider,
        model_id: model,
        estimated_cost: estimatedCost,
        metadata: {
          finish_reason: response.finishReason,
        },
      });
      
      // Update daily aggregate
      const today = new Date().toISOString().split('T')[0];
      const { data: aggregate } = await adminClient
        .from('usage_daily_aggregates')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();
      
      if (aggregate) {
        // Update existing aggregate
        await adminClient
          .from('usage_daily_aggregates')
          .update({
            message_count: aggregate.message_count + 1,
            total_prompt_tokens: aggregate.total_prompt_tokens + response.promptTokens,
            total_completion_tokens: aggregate.total_completion_tokens + response.completionTokens,
            total_tokens: aggregate.total_tokens + response.totalTokens,
            total_estimated_cost: aggregate.total_estimated_cost + estimatedCost,
          })
          .eq('id', aggregate.id);
      } else {
        // Create new aggregate
        await adminClient
          .from('usage_daily_aggregates')
          .insert({
            user_id: userId,
            date: today,
            message_count: 1,
            total_prompt_tokens: response.promptTokens,
            total_completion_tokens: response.completionTokens,
            total_tokens: response.totalTokens,
            total_estimated_cost: estimatedCost,
          });
      }
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Calculate estimated cost based on provider and model
   */
  private calculateCost(provider: string, model: string, response: ChatCompletionResponse): number {
    // Cost per 1K tokens (approximate)
    const costMap: Record<string, Record<string, { input: number; output: number }>> = {
      openai: {
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
      },
      anthropic: {
        'claude-3-haiku': { input: 0.00025, output: 0.00125 },
        'claude-3-sonnet': { input: 0.003, output: 0.015 },
        'claude-3-opus': { input: 0.015, output: 0.075 },
      },
      google: {
        'gemini-pro': { input: 0.0005, output: 0.0015 },
      },
      groq: {
        'mixtral-8x7b': { input: 0.0005, output: 0.0005 },
        'llama-3-70b': { input: 0.001, output: 0.001 },
      },
    };
    
    const costs = costMap[provider]?.[model] || { input: 0, output: 0 };
    
    const inputCost = (response.promptTokens / 1000) * costs.input;
    const outputCost = (response.completionTokens / 1000) * costs.output;
    
    return inputCost + outputCost;
  }
}

// Export singleton instance
export const aiProviderService = new AIProviderService();
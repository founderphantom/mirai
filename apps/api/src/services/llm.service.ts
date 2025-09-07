import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { cacheService } from '@/lib/redis';
import { dbHelpers } from '@/lib/supabase';

// Lazy initialization of providers
let providersCache: {
  openai: OpenAI | null;
  anthropic: Anthropic | null;
  groq: Groq | null;
} | null = null;

/**
 * Get or create provider instances
 * Uses lazy initialization to avoid issues during testing
 */
function getProviders() {
  if (!providersCache) {
    // In test environment, return mock providers
    if (process.env.NODE_ENV === 'test') {
      providersCache = {
        openai: {
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                id: 'test-completion',
                choices: [{ message: { content: 'Test response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
              })
            }
          }
        } as any,
        anthropic: null,
        groq: null
      };
    } else {
      providersCache = {
        openai: process.env.OPENAI_API_KEY ? new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        }) : null,
        anthropic: process.env.ANTHROPIC_API_KEY ? new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        }) : null,
        groq: process.env.GROQ_API_KEY ? new Groq({
          apiKey: process.env.GROQ_API_KEY,
        }) : null,
      };
    }
  }
  return providersCache;
}

// Model configurations
export const MODEL_CONFIGS = {
  openai: {
    'gpt-4-turbo-preview': { maxTokens: 4096, costPer1kTokens: 0.01 },
    'gpt-4': { maxTokens: 8192, costPer1kTokens: 0.03 },
    'gpt-3.5-turbo': { maxTokens: 4096, costPer1kTokens: 0.0015 },
  },
  anthropic: {
    'claude-3-opus-20240229': { maxTokens: 4096, costPer1kTokens: 0.015 },
    'claude-3-sonnet-20240229': { maxTokens: 4096, costPer1kTokens: 0.003 },
    'claude-3-haiku-20240307': { maxTokens: 4096, costPer1kTokens: 0.00025 },
  },
  groq: {
    'mixtral-8x7b-32768': { maxTokens: 32768, costPer1kTokens: 0.0006 },
    'llama2-70b-4096': { maxTokens: 4096, costPer1kTokens: 0.0007 },
  },
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  provider?: 'openai' | 'anthropic' | 'groq';
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  cacheResponse?: boolean;
  userId?: string;
  conversationId?: string;
}

export class LLMService {
  private defaultProvider: string;
  private defaultModel: string;

  constructor() {
    this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
    this.defaultModel = process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo';
  }

  // Main chat completion method with failover
  async chatCompletion(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 2048;

    // Check cache if enabled
    if (options.cacheResponse && !options.stream) {
      const cacheKey = this.getCacheKey(messages, model);
      const cachedResponse = await cacheService.getLLMResponse(cacheKey, model);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    try {
      let response: string | AsyncGenerator<string, void, unknown>;

      switch (provider) {
        case 'openai':
          response = await this.openAICompletion(messages, model, temperature, maxTokens, options.stream);
          break;
        case 'anthropic':
          response = await this.anthropicCompletion(messages, model, temperature, maxTokens, options.stream);
          break;
        case 'groq':
          response = await this.groqCompletion(messages, model, temperature, maxTokens, options.stream);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Cache response if enabled and not streaming
      if (options.cacheResponse && !options.stream && typeof response === 'string') {
        const cacheKey = this.getCacheKey(messages, model);
        await cacheService.setLLMResponse(cacheKey, model, response, 300);
      }

      // Track usage if user ID provided
      if (options.userId && typeof response === 'string') {
        const totalTokens = this.estimateTokens(messages, response);
        // Split tokens between prompt and completion (rough estimate)
        const promptTokens = Math.floor(totalTokens * 0.4);
        const completionTokens = totalTokens - promptTokens;
        await dbHelpers.updateUsageMetrics(
          options.userId,
          promptTokens,
          completionTokens,
          model,
          provider
        );
      }

      return response;
    } catch (error: any) {
      console.error(`${provider} completion error:`, error);
      
      // Try failover to another provider
      const failoverProvider = this.getFailoverProvider(provider);
      if (failoverProvider) {
        console.log(`Failing over to ${failoverProvider}`);
        return this.chatCompletion(messages, { ...options, provider: failoverProvider as any });
      }
      
      throw error;
    }
  }

  // OpenAI completion
  private async openAICompletion(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    stream?: boolean
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    const providers = getProviders();
    if (!providers.openai) {
      throw new Error('OpenAI provider not configured');
    }

    if (stream) {
      return this.openAIStream(messages, model, temperature, maxTokens);
    }

    const completion = await providers.openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
    });

    return completion.choices[0]?.message?.content || '';
  }

  // OpenAI streaming
  private async *openAIStream(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number
  ): AsyncGenerator<string, void, unknown> {
    const providers = getProviders();
    if (!providers.openai) {
      throw new Error('OpenAI provider not configured');
    }

    const stream = await providers.openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // Anthropic completion
  private async anthropicCompletion(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    stream?: boolean
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    const providers = getProviders();
    if (!providers.anthropic) {
      throw new Error('Anthropic provider not configured');
    }

    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    if (stream) {
      return this.anthropicStream(anthropicMessages, model, systemMessage, temperature, maxTokens);
    }

    const completion = await providers.anthropic.messages.create({
      model,
      messages: anthropicMessages,
      system: systemMessage,
      temperature,
      max_tokens: maxTokens,
    });

    return completion.content[0]?.type === 'text' ? completion.content[0].text : '';
  }

  // Anthropic streaming
  private async *anthropicStream(
    messages: any[],
    model: string,
    system: string,
    temperature: number,
    maxTokens: number
  ): AsyncGenerator<string, void, unknown> {
    const providers = getProviders();
    if (!providers.anthropic) {
      throw new Error('Anthropic provider not configured');
    }

    const stream = await providers.anthropic.messages.create({
      model,
      messages,
      system,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  // Groq completion
  private async groqCompletion(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    stream?: boolean
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    const providers = getProviders();
    if (!providers.groq) {
      throw new Error('Groq provider not configured');
    }

    if (stream) {
      return this.groqStream(messages, model, temperature, maxTokens);
    }

    const completion = await providers.groq.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
    });

    return completion.choices[0]?.message?.content || '';
  }

  // Groq streaming
  private async *groqStream(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number
  ): AsyncGenerator<string, void, unknown> {
    const providers = getProviders();
    if (!providers.groq) {
      throw new Error('Groq provider not configured');
    }

    const stream = await providers.groq.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // Get failover provider
  private getFailoverProvider(currentProvider: string): string | null {
    const providers = getProviders();
    const availableProviders = Object.entries(providers)
      .filter(([name, client]) => name !== currentProvider && client !== null)
      .map(([name]) => name);

    return availableProviders[0] || null;
  }

  // Generate cache key for responses
  private getCacheKey(messages: ChatMessage[], model: string): string {
    const messageStr = JSON.stringify(messages);
    return Buffer.from(`${model}:${messageStr}`).toString('base64').substring(0, 200);
  }

  // Estimate token count (rough estimation)
  private estimateTokens(messages: ChatMessage[], response: string): number {
    const messageText = messages.map(m => m.content).join(' ');
    const totalText = messageText + ' ' + response;
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(totalText.length / 4);
  }

  // Generate embeddings
  async generateEmbedding(text: string, model = 'text-embedding-ada-002'): Promise<number[]> {
    const providers = getProviders();
    if (!providers.openai) {
      throw new Error('OpenAI provider required for embeddings');
    }

    const response = await providers.openai.embeddings.create({
      model,
      input: text,
    });

    return response.data[0].embedding;
  }

  // Text moderation
  async moderateContent(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    scores: Record<string, number>;
  }> {
    const providers = getProviders();
    if (!providers.openai) {
      // Fallback to basic moderation
      return this.basicModeration(text);
    }

    try {
      const response = await providers.openai.moderations.create({
        input: text,
      });

      const result = response.results[0];
      return {
        flagged: result.flagged,
        categories: result.categories as any,
        scores: result.category_scores as any,
      };
    } catch (error) {
      console.error('Moderation error:', error);
      return this.basicModeration(text);
    }
  }

  // Basic content moderation fallback
  private basicModeration(text: string): {
    flagged: boolean;
    categories: Record<string, boolean>;
    scores: Record<string, number>;
  } {
    const lowerText = text.toLowerCase();
    const profanityList = ['badword1', 'badword2']; // Add actual list
    
    const hasProfanity = profanityList.some(word => lowerText.includes(word));
    
    return {
      flagged: hasProfanity,
      categories: {
        'hate': false,
        'hate/threatening': false,
        'self-harm': false,
        'sexual': false,
        'sexual/minors': false,
        'violence': false,
        'violence/graphic': false,
        'profanity': hasProfanity,
      },
      scores: {
        'hate': 0,
        'hate/threatening': 0,
        'self-harm': 0,
        'sexual': 0,
        'sexual/minors': 0,
        'violence': 0,
        'violence/graphic': 0,
        'profanity': hasProfanity ? 1 : 0,
      },
    };
  }

  // Function calling support (for OpenAI)
  async functionCall(
    messages: ChatMessage[],
    functions: any[],
    functionCall: 'auto' | 'none' | { name: string } = 'auto'
  ): Promise<any> {
    const providers = getProviders();
    if (!providers.openai) {
      throw new Error('Function calling requires OpenAI provider');
    }

    const completion = await providers.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages as any,
      functions,
      function_call: functionCall,
    });

    const message = completion.choices[0].message;
    
    if (message.function_call) {
      return {
        content: message.content,
        functionCall: {
          name: message.function_call.name,
          arguments: JSON.parse(message.function_call.arguments || '{}'),
        },
      };
    }

    return {
      content: message.content,
      functionCall: null,
    };
  }

  // Get available models
  getAvailableModels(): Record<string, string[]> {
    const providers = getProviders();
    const available: Record<string, string[]> = {};
    
    if (providers.openai) {
      available.openai = Object.keys(MODEL_CONFIGS.openai);
    }
    if (providers.anthropic) {
      available.anthropic = Object.keys(MODEL_CONFIGS.anthropic);
    }
    if (providers.groq) {
      available.groq = Object.keys(MODEL_CONFIGS.groq);
    }

    return available;
  }

  // Calculate cost
  calculateCost(provider: string, model: string, tokens: number): number {
    const providerConfigs = (MODEL_CONFIGS as any)[provider];
    if (!providerConfigs) return 0;
    
    const config = providerConfigs[model];
    if (!config) return 0;
    
    return (tokens / 1000) * config.costPer1kTokens;
  }
}

export const llmService = new LLMService();
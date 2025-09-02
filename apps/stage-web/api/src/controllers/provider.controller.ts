import { Request, Response } from 'express';
import { aiProviderService } from '../services/ai-provider.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * List available AI providers
 */
export const listProviders = async (req: Request, res: Response) => {
  try {
    const tier = req.user!.subscription_tier;
    
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        enabled: true,
        tier_required: 'free'
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
        enabled: true,
        tier_required: 'free'
      },
      {
        id: 'google',
        name: 'Google AI',
        models: ['gemini-pro', 'gemini-ultra'],
        enabled: true,
        tier_required: 'plus'
      },
      {
        id: 'groq',
        name: 'Groq',
        models: ['llama-3-70b', 'mixtral-8x7b'],
        enabled: true,
        tier_required: 'plus'
      },
      {
        id: 'custom',
        name: 'Custom Provider',
        models: ['custom'],
        enabled: tier === 'enterprise',
        tier_required: 'enterprise'
      }
    ];
    
    // Filter providers based on tier
    const tierOrder = ['free', 'plus', 'pro', 'enterprise'];
    const userTierIndex = tierOrder.indexOf(tier);
    
    const availableProviders = providers.filter(p => {
      const requiredIndex = tierOrder.indexOf(p.tier_required);
      return userTierIndex >= requiredIndex;
    });
    
    res.json(availableProviders);
  } catch (error) {
    logger.error('List providers error:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
};

/**
 * Get provider details
 */
export const getProvider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const providerDetails = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        description: 'Industry-leading language models including GPT-4',
        models: [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context: 16385 },
          { id: 'gpt-4', name: 'GPT-4', context: 8192 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context: 128000 }
        ],
        features: ['chat', 'embeddings', 'moderation'],
        pricing: 'Usage-based'
      },
      anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude models focused on safety and helpfulness',
        models: [
          { id: 'claude-3-haiku', name: 'Claude 3 Haiku', context: 200000 },
          { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', context: 200000 },
          { id: 'claude-3-opus', name: 'Claude 3 Opus', context: 200000 }
        ],
        features: ['chat', 'analysis', 'coding'],
        pricing: 'Usage-based'
      },
      google: {
        id: 'google',
        name: 'Google AI',
        description: 'Gemini models with multimodal capabilities',
        models: [
          { id: 'gemini-pro', name: 'Gemini Pro', context: 32768 },
          { id: 'gemini-ultra', name: 'Gemini Ultra', context: 32768 }
        ],
        features: ['chat', 'vision', 'multimodal'],
        pricing: 'Usage-based'
      },
      groq: {
        id: 'groq',
        name: 'Groq',
        description: 'Ultra-fast inference for open models',
        models: [
          { id: 'llama-3-70b', name: 'Llama 3 70B', context: 8192 },
          { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', context: 32768 }
        ],
        features: ['chat', 'fast-inference'],
        pricing: 'Usage-based'
      }
    };
    
    const provider = providerDetails[id as keyof typeof providerDetails];
    
    if (!provider) {
      throw new AppError('Provider not found', 404);
    }
    
    res.json(provider);
  } catch (error) {
    logger.error('Get provider error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get provider' });
    }
  }
};

/**
 * Test provider connection
 */
export const testConnection = async (req: Request, res: Response) => {
  try {
    const { provider, config: providerConfig } = req.body;
    
    // Test with a simple prompt
    const result = await aiProviderService.getChatCompletion(provider, {
      model: providerConfig.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "Connection successful" if you receive this.' }
      ],
      temperature: 0,
      maxTokens: 20,
      userId: req.user!.id
    });
    
    res.json({
      success: true,
      message: 'Connection successful',
      response: result.content
    });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(400).json({ 
      success: false,
      error: 'Connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Save provider configuration (Enterprise only)
 */
export const saveConfig = async (req: Request, res: Response) => {
  try {
    if (req.user!.subscription_tier !== 'enterprise') {
      throw new AppError('Enterprise subscription required', 403);
    }
    
    const { provider, config: providerConfig } = req.body;
    
    // In a real implementation, this would save to database
    // For now, return success
    res.json({
      message: 'Configuration saved successfully',
      provider,
      config: { ...providerConfig, api_key: '***' } // Hide sensitive data
    });
  } catch (error) {
    logger.error('Save config error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  }
};

/**
 * Delete provider configuration (Enterprise only)
 */
export const deleteConfig = async (req: Request, res: Response) => {
  try {
    if (req.user!.subscription_tier !== 'enterprise') {
      throw new AppError('Enterprise subscription required', 403);
    }
    
    const { provider } = req.params;
    
    // In a real implementation, this would delete from database
    res.json({
      message: 'Configuration deleted successfully',
      provider
    });
  } catch (error) {
    logger.error('Delete config error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete configuration' });
    }
  }
};
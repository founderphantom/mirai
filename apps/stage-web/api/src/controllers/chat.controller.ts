import { Request, Response } from 'express';
import { getAdminClient } from '../database/connection.js';
import { aiProviderService } from '../services/ai-provider.service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Send a chat message and get AI response
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { conversation_id, content, content_type = 'text', attachments, stream = false } = req.body;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', userId)
      .single();
    
    if (convError || !conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Store user message
    const { data: userMessage, error: msgError } = await adminClient
      .from('chat_messages')
      .insert({
        conversation_id,
        user_id: userId,
        role: 'user',
        content,
        content_type,
        attachments
      })
      .select()
      .single();
    
    if (msgError) {
      throw new AppError('Failed to save message', 500);
    }
    
    // Get conversation history for context
    const { data: messages } = await adminClient
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50);
    
    // Prepare messages for AI
    const aiMessages = messages?.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    })) || [];
    
    // Add system prompt if exists
    if (conversation.system_prompt) {
      aiMessages.unshift({
        role: 'system',
        content: conversation.system_prompt
      });
    }
    
    // Get AI response
    const aiResponse = await aiProviderService.getChatCompletion(
      conversation.provider_id || 'openai',
      {
        model: conversation.model_id || 'gpt-4o-mini',
        messages: aiMessages,
        temperature: conversation.temperature || 0.7,
        maxTokens: conversation.max_tokens || 2000,
        userId
      }
    );
    
    // Store assistant message
    const { data: assistantMessage } = await adminClient
      .from('chat_messages')
      .insert({
        conversation_id,
        user_id: userId,
        role: 'assistant',
        content: aiResponse.content,
        content_type: 'text',
        model_id: conversation.model_id,
        provider_id: conversation.provider_id,
        prompt_tokens: aiResponse.promptTokens,
        completion_tokens: aiResponse.completionTokens,
        total_tokens: aiResponse.totalTokens
      })
      .select()
      .single();
    
    // Update user's daily message count
    await adminClient
      .from('user_profiles')
      .update({ 
        daily_message_count: adminClient.sql`daily_message_count + 1`
      })
      .eq('id', userId);
    
    // Update conversation's last message
    await adminClient
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        message_count: conversation.message_count + 2
      })
      .eq('id', conversation_id);
    
    res.json({
      user_message: userMessage,
      assistant_message: assistantMessage
    });
  } catch (error) {
    logger.error('Send message error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
};

/**
 * Regenerate the last AI response
 */
export const regenerateMessage = async (req: Request, res: Response) => {
  try {
    const { conversation_id, message_id } = req.body;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Verify conversation belongs to user
    const { data: conversation } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', userId)
      .single();
    
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Get messages for context
    const { data: messages } = await adminClient
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    
    // Find the message to regenerate (last assistant message if not specified)
    let targetMessage;
    if (message_id) {
      targetMessage = messages?.find(m => m.id === message_id && m.role === 'assistant');
    } else {
      targetMessage = messages?.filter(m => m.role === 'assistant').pop();
    }
    
    if (!targetMessage) {
      throw new AppError('No message to regenerate', 404);
    }
    
    // Prepare messages for AI (up to the user message before the target)
    const targetIndex = messages!.findIndex(m => m.id === targetMessage.id);
    const contextMessages = messages!.slice(0, targetIndex).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }));
    
    // Get new AI response
    const aiResponse = await aiProviderService.getChatCompletion(
      conversation.provider_id || 'openai',
      {
        model: conversation.model_id || 'gpt-4o-mini',
        messages: contextMessages,
        temperature: (conversation.temperature || 0.7) + 0.1, // Slightly higher for variation
        maxTokens: conversation.max_tokens || 2000,
        userId
      }
    );
    
    // Update the assistant message
    const { data: updatedMessage } = await adminClient
      .from('chat_messages')
      .update({
        content: aiResponse.content,
        regenerated_at: new Date().toISOString(),
        prompt_tokens: aiResponse.promptTokens,
        completion_tokens: aiResponse.completionTokens,
        total_tokens: aiResponse.totalTokens
      })
      .eq('id', targetMessage.id)
      .select()
      .single();
    
    res.json(updatedMessage);
  } catch (error) {
    logger.error('Regenerate message error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to regenerate message' });
    }
  }
};

/**
 * Update a message (edit or rate)
 */
export const updateMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, rating, feedback } = req.body;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Verify message belongs to user
    const { data: message } = await adminClient
      .from('chat_messages')
      .select('*, conversations!inner(user_id)')
      .eq('id', id)
      .eq('conversations.user_id', userId)
      .single();
    
    if (!message) {
      throw new AppError('Message not found', 404);
    }
    
    // Update message
    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (rating !== undefined) updateData.rating = rating;
    if (feedback !== undefined) updateData.feedback = feedback;
    updateData.updated_at = new Date().toISOString();
    
    const { data: updatedMessage } = await adminClient
      .from('chat_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    res.json(updatedMessage);
  } catch (error) {
    logger.error('Update message error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update message' });
    }
  }
};

/**
 * Delete a message
 */
export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Soft delete the message
    await adminClient
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .match({ 'conversations.user_id': userId });
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

/**
 * Search messages
 */
export const searchMessages = async (req: Request, res: Response) => {
  try {
    const { query, conversation_id, limit = 20 } = req.body;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    let searchQuery = adminClient
      .from('chat_messages')
      .select('*, conversations!inner(title)')
      .eq('conversations.user_id', userId)
      .is('deleted_at', null)
      .ilike('content', `%${query}%`)
      .limit(limit)
      .order('created_at', { ascending: false });
    
    if (conversation_id) {
      searchQuery = searchQuery.eq('conversation_id', conversation_id);
    }
    
    const { data: messages } = await searchQuery;
    
    res.json(messages || []);
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
};

/**
 * Direct chat completion without conversation context
 */
export const chatCompletion = async (req: Request, res: Response) => {
  try {
    const { messages, model, provider, temperature, max_tokens, stream } = req.body;
    const userId = req.user!.id;
    
    const aiResponse = await aiProviderService.getChatCompletion(
      provider || 'openai',
      {
        model: model || 'gpt-4o-mini',
        messages,
        temperature: temperature || 0.7,
        maxTokens: max_tokens || 2000,
        userId
      }
    );
    
    // Update user's daily message count
    const adminClient = getAdminClient();
    await adminClient
      .from('user_profiles')
      .update({ 
        daily_message_count: adminClient.sql`daily_message_count + 1`
      })
      .eq('id', userId);
    
    res.json({
      content: aiResponse.content,
      model: aiResponse.model,
      usage: {
        prompt_tokens: aiResponse.promptTokens,
        completion_tokens: aiResponse.completionTokens,
        total_tokens: aiResponse.totalTokens
      }
    });
  } catch (error) {
    logger.error('Chat completion error:', error);
    res.status(500).json({ error: 'Failed to complete chat' });
  }
};

/**
 * Moderate content for policy violations
 */
export const moderateContent = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    
    // Basic content moderation (would integrate with OpenAI moderation API)
    const blockedTerms = config.features.enableMonitoring 
      ? (process.env.BLOCKED_TERMS || '').split(',').map(t => t.trim())
      : [];
    
    const isViolation = blockedTerms.some(term => 
      content.toLowerCase().includes(term.toLowerCase())
    );
    
    res.json({
      flagged: isViolation,
      categories: isViolation ? ['inappropriate_content'] : [],
      scores: { inappropriate_content: isViolation ? 1 : 0 }
    });
  } catch (error) {
    logger.error('Moderation error:', error);
    res.status(500).json({ error: 'Failed to moderate content' });
  }
};

/**
 * Get available AI models based on subscription
 */
export const getAvailableModels = async (req: Request, res: Response) => {
  try {
    const tier = req.user!.subscription_tier;
    
    const models = {
      free: [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
        { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic' }
      ],
      plus: [
        { id: 'gpt-4o-mini', name: 'GPT-4 Mini', provider: 'openai' },
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' }
      ],
      pro: [
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
        { id: 'gemini-ultra', name: 'Gemini Ultra', provider: 'google' }
      ],
      enterprise: [
        { id: 'custom', name: 'Custom Models', provider: 'custom' }
      ]
    };
    
    // Get models for user's tier and below
    const tierOrder = ['free', 'plus', 'pro', 'enterprise'];
    const userTierIndex = tierOrder.indexOf(tier);
    const availableModels = tierOrder
      .slice(0, userTierIndex + 1)
      .flatMap(t => models[t as keyof typeof models]);
    
    res.json(availableModels);
  } catch (error) {
    logger.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
};

/**
 * Text-to-speech conversion
 */
export const textToSpeech = async (req: Request, res: Response) => {
  try {
    const { text, voice_id, provider } = req.body;
    
    // TTS implementation would go here
    // For now, return a mock response
    res.json({
      audio_url: 'https://example.com/audio.mp3',
      duration: 10,
      voice_id: voice_id || 'default'
    });
  } catch (error) {
    logger.error('TTS error:', error);
    res.status(500).json({ error: 'Failed to convert text to speech' });
  }
};

/**
 * Speech-to-text conversion
 */
export const speechToText = async (req: Request, res: Response) => {
  try {
    // STT implementation would go here
    // For now, return a mock response
    res.json({
      text: 'Transcribed text from audio',
      duration: 5,
      language: 'en'
    });
  } catch (error) {
    logger.error('STT error:', error);
    res.status(500).json({ error: 'Failed to convert speech to text' });
  }
};

/**
 * Upload attachment for a message
 */
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    // File upload implementation would go here
    res.json({
      attachment_id: 'att_123',
      url: 'https://example.com/attachment.pdf',
      size: 1024,
      type: 'application/pdf'
    });
  } catch (error) {
    logger.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
};
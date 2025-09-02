import { Request, Response } from 'express';
import { getAdminClient } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * List user's conversations
 */
export const listConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0, search } = req.query;
    
    const adminClient = getAdminClient();
    
    let query = adminClient
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    
    const { data: conversations, count, error } = await query;
    
    if (error) {
      throw new AppError('Failed to fetch conversations', 500);
    }
    
    res.json({
      conversations: conversations || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('List conversations error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  }
};

/**
 * Get a specific conversation
 */
export const getConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    const { data: conversation, error } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    
    if (error || !conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    res.json(conversation);
  } catch (error) {
    logger.error('Get conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }
};

/**
 * Create a new conversation
 */
export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, metadata = {} } = req.body;
    
    const adminClient = getAdminClient();
    
    // Generate default title if not provided
    const conversationTitle = title || `New Chat ${new Date().toLocaleDateString()}`;
    
    const { data: conversation, error } = await adminClient
      .from('conversations')
      .insert({
        user_id: userId,
        title: conversationTitle,
        metadata,
        model_id: 'gpt-4o-mini',
        provider_id: 'openai',
        temperature: 0.7,
        max_tokens: 2000,
        message_count: 0
      })
      .select()
      .single();
    
    if (error) {
      throw new AppError('Failed to create conversation', 500);
    }
    
    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Create conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
};

/**
 * Update a conversation
 */
export const updateConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { title, metadata, system_prompt, model_id, provider_id, temperature, max_tokens } = req.body;
    
    const adminClient = getAdminClient();
    
    // Verify ownership
    const { data: existing } = await adminClient
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!existing) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Build update object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (model_id !== undefined) updateData.model_id = model_id;
    if (provider_id !== undefined) updateData.provider_id = provider_id;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (max_tokens !== undefined) updateData.max_tokens = max_tokens;
    updateData.updated_at = new Date().toISOString();
    
    const { data: conversation, error } = await adminClient
      .from('conversations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new AppError('Failed to update conversation', 500);
    }
    
    res.json(conversation);
  } catch (error) {
    logger.error('Update conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Soft delete the conversation
    const { error } = await adminClient
      .from('conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      throw new AppError('Failed to delete conversation', 500);
    }
    
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }
};

/**
 * Get messages for a conversation
 */
export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const adminClient = getAdminClient();
    
    // Verify conversation ownership
    const { data: conversation } = await adminClient
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Get messages
    const { data: messages, count, error } = await adminClient
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    
    if (error) {
      throw new AppError('Failed to fetch messages', 500);
    }
    
    res.json({
      messages: messages || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('Get conversation messages error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }
};

/**
 * Clear all messages in a conversation
 */
export const clearConversationMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Verify conversation ownership
    const { data: conversation } = await adminClient
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Soft delete all messages
    await adminClient
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('conversation_id', id);
    
    // Reset conversation message count
    await adminClient
      .from('conversations')
      .update({ 
        message_count: 0,
        last_message_at: null
      })
      .eq('id', id);
    
    res.json({ message: 'Messages cleared successfully' });
  } catch (error) {
    logger.error('Clear conversation messages error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to clear messages' });
    }
  }
};

/**
 * Fork a conversation (create a copy)
 */
export const forkConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { includeMessages = true } = req.body;
    
    const adminClient = getAdminClient();
    
    // Get original conversation
    const { data: original } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!original) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Create new conversation
    const { data: forked, error: forkError } = await adminClient
      .from('conversations')
      .insert({
        user_id: userId,
        title: `${original.title} (Fork)`,
        system_prompt: original.system_prompt,
        model_id: original.model_id,
        provider_id: original.provider_id,
        temperature: original.temperature,
        max_tokens: original.max_tokens,
        metadata: {
          ...original.metadata,
          forked_from: id,
          forked_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (forkError) {
      throw new AppError('Failed to fork conversation', 500);
    }
    
    // Copy messages if requested
    if (includeMessages) {
      const { data: messages } = await adminClient
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (messages && messages.length > 0) {
        const newMessages = messages.map(msg => ({
          conversation_id: forked.id,
          user_id: msg.user_id,
          role: msg.role,
          content: msg.content,
          content_type: msg.content_type,
          attachments: msg.attachments,
          model_id: msg.model_id,
          provider_id: msg.provider_id,
          prompt_tokens: msg.prompt_tokens,
          completion_tokens: msg.completion_tokens,
          total_tokens: msg.total_tokens
        }));
        
        await adminClient
          .from('chat_messages')
          .insert(newMessages);
        
        // Update message count
        await adminClient
          .from('conversations')
          .update({ message_count: messages.length })
          .eq('id', forked.id);
      }
    }
    
    res.status(201).json(forked);
  } catch (error) {
    logger.error('Fork conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fork conversation' });
    }
  }
};

/**
 * Export conversation as JSON
 */
export const exportConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Get conversation with messages
    const { data: conversation } = await adminClient
      .from('conversations')
      .select('*, chat_messages(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }
    
    // Format for export
    const exportData = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        system_prompt: conversation.system_prompt,
        model_id: conversation.model_id,
        provider_id: conversation.provider_id
      },
      messages: conversation.chat_messages
        .filter((msg: any) => !msg.deleted_at)
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at
        })),
      exported_at: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    logger.error('Export conversation error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to export conversation' });
    }
  }
};
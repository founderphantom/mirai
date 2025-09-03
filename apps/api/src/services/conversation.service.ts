import { supabase } from '../lib/supabase';
import {
  Conversation,
  ConversationInsert,
  ConversationUpdate,
  ConversationWithLastMessage,
  Database
} from '../types/database';

export class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(data: ConversationInsert): Promise<Conversation> {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        ...data,
        total_tokens: data.total_tokens || 0,
        message_count: data.message_count || 0,
        is_starred: data.is_starred || false,
        is_archived: data.is_archived || false,
        settings: data.settings || {},
        provider: data.provider || 'openai'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all conversations for a user with pagination
   */
  async getUserConversations(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      onlyStarred?: boolean;
    } = {}
  ): Promise<Conversation[]> {
    const { limit = 20, offset = 0, includeArchived = false, onlyStarred = false } = options;

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (onlyStarred) {
      query = query.eq('is_starred', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get conversations with last message using the optimized function
   */
  async getConversationsWithLastMessage(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ConversationWithLastMessage[]> {
    const { data, error } = await supabase
      .rpc('get_conversations_with_last_message', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset
      });

    if (error) {
      throw new Error(`Failed to fetch conversations with last message: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    updates: ConversationUpdate
  ): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Star/unstar a conversation
   */
  async toggleStar(conversationId: string, userId: string): Promise<Conversation> {
    // First get current star status
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.updateConversation(conversationId, userId, {
      is_starred: !conversation.is_starred
    });
  }

  /**
   * Archive/unarchive a conversation
   */
  async toggleArchive(conversationId: string, userId: string): Promise<Conversation> {
    // First get current archive status
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.updateConversation(conversationId, userId, {
      is_archived: !conversation.is_archived
    });
  }

  /**
   * Delete a conversation (hard delete)
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // First delete all messages in the conversation
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      throw new Error(`Failed to delete conversation messages: ${messagesError.message}`);
    }

    // Then delete the conversation
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * Update conversation title based on first message
   */
  async generateTitle(conversationId: string, userId: string, firstMessage: string): Promise<Conversation> {
    // Generate a title from the first message (truncate to 100 chars)
    const title = firstMessage.length > 100 
      ? firstMessage.substring(0, 97) + '...'
      : firstMessage;

    return this.updateConversation(conversationId, userId, { title });
  }

  /**
   * Update conversation statistics after a new message
   */
  async updateStats(
    conversationId: string,
    userId: string,
    tokensUsed: number
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await this.updateConversation(conversationId, userId, {
      total_tokens: conversation.total_tokens + tokensUsed,
      message_count: conversation.message_count + 1,
      last_message_at: new Date().toISOString()
    });
  }

  /**
   * Search conversations by title or content
   */
  async searchConversations(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${query}%`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get conversation statistics for a user
   */
  async getUserConversationStats(userId: string): Promise<{
    total: number;
    starred: number;
    archived: number;
    totalTokens: number;
    totalMessages: number;
  }> {
    const { data, error } = await supabase
      .from('conversations')
      .select('is_starred, is_archived, total_tokens, message_count')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch conversation stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      starred: 0,
      archived: 0,
      totalTokens: 0,
      totalMessages: 0
    };

    if (data) {
      for (const conv of data) {
        if (conv.is_starred) stats.starred++;
        if (conv.is_archived) stats.archived++;
        stats.totalTokens += conv.total_tokens || 0;
        stats.totalMessages += conv.message_count || 0;
      }
    }

    return stats;
  }

  /**
   * Duplicate a conversation
   */
  async duplicateConversation(conversationId: string, userId: string): Promise<Conversation> {
    const original = await this.getConversation(conversationId, userId);
    if (!original) {
      throw new Error('Conversation not found');
    }

    // Create new conversation with same settings but reset stats
    const newConversation = await this.createConversation({
      user_id: userId,
      title: `Copy of ${original.title}`,
      model: original.model,
      provider: original.provider,
      settings: original.settings,
      total_tokens: 0,
      message_count: 0,
      is_starred: false,
      is_archived: false
    });

    // Copy messages to new conversation
    const { data: messages, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch messages for duplication: ${fetchError.message}`);
    }

    if (messages && messages.length > 0) {
      const messagesToInsert = messages.map(msg => ({
        conversation_id: newConversation.id,
        role: msg.role,
        content: msg.content,
        content_type: msg.content_type,
        model: msg.model,
        provider: msg.provider,
        prompt_tokens: msg.prompt_tokens,
        completion_tokens: msg.completion_tokens,
        total_tokens: msg.total_tokens,
        attachments: msg.attachments,
        metadata: msg.metadata
      }));

      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(messagesToInsert);

      if (insertError) {
        // Rollback - delete the new conversation
        await this.deleteConversation(newConversation.id, userId);
        throw new Error(`Failed to duplicate messages: ${insertError.message}`);
      }

      // Update stats
      await this.updateConversation(newConversation.id, userId, {
        message_count: messages.length,
        last_message_at: messages[messages.length - 1].created_at
      });
    }

    return newConversation;
  }
}

// Export singleton instance
export const conversationService = new ConversationService();
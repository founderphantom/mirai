import { supabase } from '../lib/supabase';
import {
  ChatMessage,
  ChatMessageInsert,
  ChatMessageUpdate,
  MessageAttachment,
  MessageSearchResult,
  Json
} from '../types/database';
import { conversationService } from './conversation.service';

interface AttachmentData {
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  url?: string;
}

export class ChatService {
  /**
   * Create a new message in a conversation
   */
  async createMessage(data: ChatMessageInsert): Promise<ChatMessage> {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        ...data,
        content_type: data.content_type || 'text',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }

    // Update conversation stats
    if (data.total_tokens) {
      await conversationService.updateStats(
        data.conversation_id,
        message.conversation_id, // This needs the user_id, we'll fix this
        data.total_tokens
      );
    }

    return message;
  }

  /**
   * Create a message with attachments
   */
  async createMessageWithAttachments(
    messageData: ChatMessageInsert,
    attachments: AttachmentData[]
  ): Promise<ChatMessage> {
    // Store attachment metadata in the message
    const attachmentMetadata = attachments.map(att => ({
      file_name: att.file_name,
      file_type: att.file_type,
      file_size: att.file_size,
      storage_path: att.storage_path,
      url: att.url
    }));

    const message = await this.createMessage({
      ...messageData,
      attachments: attachmentMetadata as Json
    });

    // Create attachment records
    if (attachments.length > 0) {
      const attachmentRecords = attachments.map(att => ({
        message_id: message.id,
        ...att
      }));

      const { error } = await supabase
        .from('message_attachments')
        .insert(attachmentRecords);

      if (error) {
        console.error('Failed to create attachment records:', error);
        // Don't fail the message creation, just log the error
      }
    }

    return message;
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    options: {
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    } = {}
  ): Promise<ChatMessage[]> {
    const { limit = 50, offset = 0, includeDeleted = false } = options;

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages using the optimized function
   */
  async getConversationMessagesOptimized(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: limit,
        p_offset: offset
      });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single message
   */
  async getMessage(messageId: string): Promise<ChatMessage | null> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch message: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: ChatMessageUpdate): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Hard delete a message (permanent)
   */
  async hardDeleteMessage(messageId: string): Promise<void> {
    // First delete attachments
    const { error: attachmentError } = await supabase
      .from('message_attachments')
      .delete()
      .eq('message_id', messageId);

    if (attachmentError) {
      console.error('Failed to delete attachments:', attachmentError);
    }

    // Then delete the message
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to permanently delete message: ${error.message}`);
    }
  }

  /**
   * Search messages using semantic search
   */
  async searchMessages(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<MessageSearchResult[]> {
    const { data, error } = await supabase
      .rpc('search_messages', {
        p_user_id: userId,
        p_query: query,
        p_limit: limit
      });

    if (error) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get message attachments
   */
  async getMessageAttachments(messageId: string): Promise<MessageAttachment[]> {
    const { data, error } = await supabase
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch attachments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Stream message creation (for real-time chat)
   */
  async streamMessage(
    conversationId: string,
    role: 'assistant',
    onChunk: (chunk: string) => void
  ): Promise<ChatMessage> {
    // Create placeholder message
    const message = await this.createMessage({
      conversation_id: conversationId,
      role,
      content: '',
      content_type: 'text'
    });

    // This would be used with real-time subscriptions
    // For now, return the message and let the caller handle streaming
    return message;
  }

  /**
   * Update message content during streaming
   */
  async updateStreamingMessage(
    messageId: string,
    content: string,
    tokens?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    }
  ): Promise<void> {
    const updates: ChatMessageUpdate = {
      content,
      updated_at: new Date().toISOString()
    };

    if (tokens) {
      updates.prompt_tokens = tokens.prompt_tokens;
      updates.completion_tokens = tokens.completion_tokens;
      updates.total_tokens = tokens.total_tokens;
    }

    const { error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to update streaming message: ${error.message}`);
    }
  }

  /**
   * Get message statistics for a conversation
   */
  async getConversationStats(conversationId: string): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    totalTokens: number;
    averageTokensPerMessage: number;
  }> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, total_tokens')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to fetch conversation stats: ${error.message}`);
    }

    const stats = {
      totalMessages: data?.length || 0,
      userMessages: 0,
      assistantMessages: 0,
      totalTokens: 0,
      averageTokensPerMessage: 0
    };

    if (data) {
      for (const msg of data) {
        if (msg.role === 'user') stats.userMessages++;
        if (msg.role === 'assistant') stats.assistantMessages++;
        stats.totalTokens += msg.total_tokens || 0;
      }
      
      if (stats.totalMessages > 0) {
        stats.averageTokensPerMessage = Math.round(stats.totalTokens / stats.totalMessages);
      }
    }

    return stats;
  }

  /**
   * Export conversation messages as markdown
   */
  async exportConversation(conversationId: string): Promise<string> {
    const messages = await this.getConversationMessages(conversationId);
    
    let markdown = `# Conversation Export\n\n`;
    markdown += `Exported at: ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    for (const message of messages) {
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      markdown += `## ${role}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (message.attachments && Array.isArray(message.attachments)) {
        const attachments = message.attachments as any[];
        if (attachments.length > 0) {
          markdown += `**Attachments:**\n`;
          for (const att of attachments) {
            markdown += `- ${att.file_name} (${att.file_type}, ${att.file_size} bytes)\n`;
          }
          markdown += '\n';
        }
      }
      
      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Clean up old deleted messages (maintenance task)
   */
  async cleanupDeletedMessages(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('chat_messages')
      .delete()
      .lt('deleted_at', cutoffDate.toISOString())
      .select();

    if (error) {
      throw new Error(`Failed to cleanup deleted messages: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Generate embedding for a message (for semantic search)
   * This would integrate with an embedding service like OpenAI
   */
  async generateEmbedding(content: string): Promise<number[]> {
    // Placeholder - would integrate with embedding service
    // For now, return empty array
    return [];
  }

  /**
   * Update message embedding
   */
  async updateMessageEmbedding(messageId: string, embedding: number[]): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({
        embedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to update message embedding: ${error.message}`);
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
import { api } from '@/lib/api-client';
import type { ChatMessage } from './chat.service';

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  summary?: string;
  model_id: string;
  provider_id: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  personality_template?: string;
  avatar_id?: string;
  voice_id?: string;
  is_archived: boolean;
  is_starred: boolean;
  tags?: string[];
  settings?: Record<string, any>;
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateConversationData {
  title?: string;
  model_id: string;
  provider_id: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  personality_template?: string;
  avatar_id?: string;
  voice_id?: string;
  settings?: Record<string, any>;
}

export interface UpdateConversationData {
  title?: string;
  summary?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  is_archived?: boolean;
  is_starred?: boolean;
  tags?: string[];
  settings?: Record<string, any>;
}

export interface ConversationListParams {
  limit?: number;
  offset?: number;
  archived?: boolean;
  starred?: boolean;
  sort?: 'created_at' | 'updated_at' | 'last_message_at';
  order?: 'asc' | 'desc';
}

export interface ConversationMessagesParams {
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface ExportFormat {
  format?: 'json' | 'markdown' | 'txt';
}

export interface ShareOptions {
  expires_in?: number; // seconds (1 hour to 7 days)
  password?: string;
}

class ConversationService {
  /**
   * Get user's conversations
   */
  async getConversations(params?: ConversationListParams): Promise<{
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  }> {
    const { data } = await api.get('/conversations', { params });
    return data;
  }

  /**
   * Create a new conversation
   */
  async createConversation(conversationData: CreateConversationData): Promise<Conversation> {
    const { data } = await api.post<Conversation>('/conversations', conversationData);
    return data;
  }

  /**
   * Get a specific conversation
   */
  async getConversation(id: string): Promise<Conversation> {
    const { data } = await api.get<Conversation>(`/conversations/${id}`);
    return data;
  }

  /**
   * Update a conversation
   */
  async updateConversation(id: string, updates: UpdateConversationData): Promise<Conversation> {
    const { data } = await api.patch<Conversation>(`/conversations/${id}`, updates);
    return data;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/conversations/${id}`);
  }

  /**
   * Get messages in a conversation
   */
  async getConversationMessages(
    id: string,
    params?: ConversationMessagesParams
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const { data } = await api.get(`/conversations/${id}/messages`, { params });
    return data;
  }

  /**
   * Clear all messages in a conversation
   */
  async clearConversation(id: string): Promise<void> {
    await api.post(`/conversations/${id}/clear`);
  }

  /**
   * Fork a conversation at a specific message
   */
  async forkConversation(
    id: string,
    messageId: string,
    title?: string
  ): Promise<Conversation> {
    const { data } = await api.post<Conversation>(`/conversations/${id}/fork`, {
      message_id: messageId,
      title,
    });
    return data;
  }

  /**
   * Export conversation
   */
  async exportConversation(id: string, format: ExportFormat = { format: 'json' }): Promise<any> {
    const { data } = await api.post(`/conversations/${id}/export`, format);
    return data;
  }

  /**
   * Generate a shareable link
   */
  async shareConversation(id: string, options?: ShareOptions): Promise<{
    share_url: string;
    expires_at: string;
    password_protected: boolean;
  }> {
    const { data } = await api.post(`/conversations/${id}/share`, options);
    return data;
  }

  /**
   * Generate conversation summary
   */
  async summarizeConversation(id: string): Promise<{
    summary: string;
    key_points: string[];
    topics: string[];
  }> {
    const { data } = await api.post(`/conversations/${id}/summarize`);
    return data;
  }

  /**
   * Import a conversation
   */
  async importConversation(
    conversationData: any,
    format?: 'json' | 'chatgpt' | 'claude'
  ): Promise<Conversation> {
    const { data } = await api.post<Conversation>('/conversations/import', {
      data: conversationData,
      format,
    });
    return data;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(id: string): Promise<Conversation> {
    return this.updateConversation(id, { is_archived: true });
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(id: string): Promise<Conversation> {
    return this.updateConversation(id, { is_archived: false });
  }

  /**
   * Star a conversation
   */
  async starConversation(id: string): Promise<Conversation> {
    return this.updateConversation(id, { is_starred: true });
  }

  /**
   * Unstar a conversation
   */
  async unstarConversation(id: string): Promise<Conversation> {
    return this.updateConversation(id, { is_starred: false });
  }
}

export const conversationService = new ConversationService();
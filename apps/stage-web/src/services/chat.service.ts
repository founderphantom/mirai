import { api } from '@/lib/api-client';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: 'text' | 'image' | 'audio' | 'code';
  attachments?: any[];
  model_id?: string;
  provider_id?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  rating?: number;
  feedback?: string;
}

export interface SendMessageData {
  conversation_id: string;
  content: string;
  content_type?: 'text' | 'image' | 'audio' | 'code';
  attachments?: any[];
  stream?: boolean;
}

export interface ChatCompletionData {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  context_length: number;
  max_tokens: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  tier_required: string;
}

export interface TTSRequest {
  text: string;
  voice_id?: string;
  provider?: 'elevenlabs' | 'openai' | 'google';
}

class ChatService {
  /**
   * Send a chat message
   */
  async sendMessage(data: SendMessageData): Promise<ChatMessage> {
    const { data: response } = await api.post<ChatMessage>('/chat/messages', data);
    return response;
  }

  /**
   * Regenerate the last AI response
   */
  async regenerateMessage(conversationId: string, messageId?: string): Promise<ChatMessage> {
    const { data } = await api.post<ChatMessage>('/chat/messages/regenerate', {
      conversation_id: conversationId,
      message_id: messageId,
    });
    return data;
  }

  /**
   * Update a message
   */
  async updateMessage(
    messageId: string,
    updates: {
      content?: string;
      rating?: number;
      feedback?: string;
    }
  ): Promise<ChatMessage> {
    const { data } = await api.patch<ChatMessage>(`/chat/messages/${messageId}`, updates);
    return data;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/chat/messages/${messageId}`);
  }

  /**
   * Upload attachments for a message
   */
  async uploadAttachment(messageId: string, formData: FormData): Promise<any> {
    const { data } = await api.post(`/chat/messages/${messageId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, limit?: number, conversationId?: string): Promise<ChatMessage[]> {
    const { data } = await api.post<ChatMessage[]>('/chat/messages/search', {
      query,
      limit,
      conversation_id: conversationId,
    });
    return data;
  }

  /**
   * Get chat completion without conversation context
   */
  async getChatCompletion(completionData: ChatCompletionData): Promise<any> {
    const { data } = await api.post('/chat/completion', completionData);
    return data;
  }

  /**
   * Stream chat completion (returns EventSource for SSE)
   */
  streamChatCompletion(completionData: ChatCompletionData): EventSource {
    const params = new URLSearchParams();
    params.append('data', JSON.stringify({ ...completionData, stream: true }));
    
    const eventSource = new EventSource(
      `${api.defaults.baseURL}/chat/completion?${params.toString()}`,
      {
        withCredentials: true,
      }
    );
    
    return eventSource;
  }

  /**
   * Check content for policy violations
   */
  async moderateContent(content: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }> {
    const { data } = await api.post('/chat/moderation', { content });
    return data;
  }

  /**
   * Get available AI models
   */
  async getAvailableModels(): Promise<AvailableModel[]> {
    const { data } = await api.get<AvailableModel[]>('/chat/models');
    return data;
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(request: TTSRequest): Promise<Blob> {
    const { data } = await api.post('/chat/tts', request, {
      responseType: 'blob',
    });
    return data;
  }

  /**
   * Convert speech to text
   */
  async speechToText(audioBlob: Blob, language?: string): Promise<{
    text: string;
    language?: string;
    confidence?: number;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    if (language) {
      formData.append('language', language);
    }
    
    const { data } = await api.post('/chat/stt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }
}

export const chatService = new ChatService();
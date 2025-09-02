import { ref, computed, watch } from 'vue';
import { chatService, ChatMessage, SendMessageData } from '@/services/chat.service';
import { conversationService, Conversation } from '@/services/conversation.service';
import { useChatStream } from './useWebSocket';
import { useApi, usePaginatedApi } from './useApi';
import { toast } from 'vue-sonner';

/**
 * Composable for chat operations
 */
export function useChat(conversationId?: string) {
  const currentConversationId = ref(conversationId);
  const conversation = ref<Conversation | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const inputMessage = ref('');
  const isStreaming = ref(false);
  
  // WebSocket streaming
  const { streamContent, streamError, startStream, stopStream } = useChatStream();
  
  // Load conversation
  const {
    loading: loadingConversation,
    execute: loadConversation,
  } = useApi(async (id: string) => {
    const conv = await conversationService.getConversation(id);
    conversation.value = conv;
    currentConversationId.value = id;
    return conv;
  });
  
  // Load messages
  const {
    items: messageList,
    loading: loadingMessages,
    hasMore,
    loadMore: loadMoreMessages,
    refresh: refreshMessages,
  } = usePaginatedApi(
    async (page: number, limit: number) => {
      if (!currentConversationId.value) {
        return { data: [], total: 0, hasMore: false };
      }
      
      const result = await conversationService.getConversationMessages(
        currentConversationId.value,
        { limit, cursor: page > 1 ? messages.value[messages.value.length - 1]?.id : undefined }
      );
      
      return {
        data: result.messages,
        total: result.messages.length,
        hasMore: result.hasMore,
      };
    },
    50
  );
  
  // Watch for message list changes
  watch(messageList, (newMessages) => {
    messages.value = newMessages;
  });
  
  // Send message
  const sendMessage = async (
    content: string = inputMessage.value,
    options: Partial<SendMessageData> = {}
  ): Promise<ChatMessage | null> => {
    if (!currentConversationId.value) {
      toast.error('No conversation selected');
      return null;
    }
    
    if (!content.trim()) {
      toast.error('Message cannot be empty');
      return null;
    }
    
    try {
      isStreaming.value = true;
      
      // Add user message optimistically
      const tempUserMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversationId.value,
        user_id: 'current-user',
        role: 'user',
        content,
        content_type: options.content_type || 'text',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      messages.value.push(tempUserMessage);
      
      // Clear input
      inputMessage.value = '';
      
      // Send via WebSocket for streaming
      if (options.stream !== false) {
        const cleanup = await startStream(
          currentConversationId.value,
          content,
          conversation.value?.model_id,
          conversation.value?.provider_id
        );
        
        // Add assistant message placeholder
        const tempAssistantMessage: ChatMessage = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: currentConversationId.value,
          user_id: 'assistant',
          role: 'assistant',
          content: '',
          content_type: 'text',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        messages.value.push(tempAssistantMessage);
        
        // Update assistant message as stream comes in
        const unwatch = watch(streamContent, (newContent) => {
          const lastMessage = messages.value[messages.value.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = newContent;
          }
        });
        
        // Wait for stream to complete
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!isStreaming.value || streamError.value) {
              clearInterval(checkInterval);
              unwatch();
              if (cleanup) cleanup();
              resolve(null);
            }
          }, 100);
        });
      } else {
        // Send via regular API
        const response = await chatService.sendMessage({
          conversation_id: currentConversationId.value,
          content,
          ...options,
        });
        
        // Replace temp message with real one
        const userMsgIndex = messages.value.findIndex(m => m.id === tempUserMessage.id);
        if (userMsgIndex !== -1) {
          messages.value[userMsgIndex] = response;
        }
        
        // Refresh messages to get assistant response
        await refreshMessages();
      }
      
      return messages.value[messages.value.length - 1];
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      
      // Remove temp messages
      messages.value = messages.value.filter(m => !m.id.startsWith('temp-'));
      return null;
    } finally {
      isStreaming.value = false;
    }
  };
  
  // Regenerate last message
  const regenerateLastMessage = async (): Promise<ChatMessage | null> => {
    if (!currentConversationId.value) {
      toast.error('No conversation selected');
      return null;
    }
    
    try {
      isStreaming.value = true;
      
      // Find last assistant message
      const lastAssistantMsg = [...messages.value]
        .reverse()
        .find(m => m.role === 'assistant');
      
      if (lastAssistantMsg) {
        // Clear the content for regeneration
        lastAssistantMsg.content = '';
      }
      
      const response = await chatService.regenerateMessage(
        currentConversationId.value,
        lastAssistantMsg?.id
      );
      
      // Update the message
      if (lastAssistantMsg) {
        Object.assign(lastAssistantMsg, response);
      } else {
        messages.value.push(response);
      }
      
      return response;
    } catch (error) {
      console.error('Failed to regenerate message:', error);
      toast.error('Failed to regenerate message');
      return null;
    } finally {
      isStreaming.value = false;
    }
  };
  
  // Edit message
  const editMessage = async (
    messageId: string,
    newContent: string
  ): Promise<ChatMessage | null> => {
    try {
      const response = await chatService.updateMessage(messageId, {
        content: newContent,
      });
      
      // Update in local state
      const msgIndex = messages.value.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        messages.value[msgIndex] = response;
      }
      
      toast.success('Message updated');
      return response;
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast.error('Failed to edit message');
      return null;
    }
  };
  
  // Delete message
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    try {
      await chatService.deleteMessage(messageId);
      
      // Remove from local state
      messages.value = messages.value.filter(m => m.id !== messageId);
      
      toast.success('Message deleted');
      return true;
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
      return false;
    }
  };
  
  // Rate message
  const rateMessage = async (
    messageId: string,
    rating: number,
    feedback?: string
  ): Promise<boolean> => {
    try {
      const response = await chatService.updateMessage(messageId, {
        rating,
        feedback,
      });
      
      // Update in local state
      const msgIndex = messages.value.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        messages.value[msgIndex] = response;
      }
      
      toast.success('Feedback submitted');
      return true;
    } catch (error) {
      console.error('Failed to rate message:', error);
      toast.error('Failed to submit feedback');
      return false;
    }
  };
  
  // Clear conversation
  const clearConversation = async (): Promise<boolean> => {
    if (!currentConversationId.value) {
      return false;
    }
    
    try {
      await conversationService.clearConversation(currentConversationId.value);
      messages.value = [];
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      toast.error('Failed to clear conversation');
      return false;
    }
  };
  
  // Initialize
  const initialize = async (convId?: string) => {
    const id = convId || currentConversationId.value;
    if (id) {
      await Promise.all([
        loadConversation(id),
        refreshMessages(),
      ]);
    }
  };
  
  // Computed properties
  const hasMessages = computed(() => messages.value.length > 0);
  const isLoading = computed(() => loadingConversation.value || loadingMessages.value);
  const canSendMessage = computed(() => !isStreaming.value && inputMessage.value.trim().length > 0);
  
  return {
    // State
    conversation,
    messages,
    inputMessage,
    isStreaming,
    isLoading,
    hasMessages,
    hasMore,
    canSendMessage,
    streamContent,
    streamError,
    
    // Methods
    initialize,
    loadConversation,
    loadMoreMessages,
    refreshMessages,
    sendMessage,
    regenerateLastMessage,
    editMessage,
    deleteMessage,
    rateMessage,
    clearConversation,
    stopStream,
  };
}

/**
 * Composable for conversation management
 */
export function useConversations() {
  const conversations = ref<Conversation[]>([]);
  const activeConversation = ref<Conversation | null>(null);
  
  // Load conversations
  const {
    loading,
    execute: loadConversations,
  } = useApi(async (params?: any) => {
    const result = await conversationService.getConversations(params);
    conversations.value = result.conversations;
    return result;
  });
  
  // Create conversation
  const createConversation = async (data: any): Promise<Conversation | null> => {
    try {
      const conversation = await conversationService.createConversation(data);
      conversations.value.unshift(conversation);
      activeConversation.value = conversation;
      toast.success('Conversation created');
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    }
  };
  
  // Update conversation
  const updateConversation = async (
    id: string,
    updates: any
  ): Promise<Conversation | null> => {
    try {
      const conversation = await conversationService.updateConversation(id, updates);
      
      // Update in local state
      const index = conversations.value.findIndex(c => c.id === id);
      if (index !== -1) {
        conversations.value[index] = conversation;
      }
      
      if (activeConversation.value?.id === id) {
        activeConversation.value = conversation;
      }
      
      toast.success('Conversation updated');
      return conversation;
    } catch (error) {
      console.error('Failed to update conversation:', error);
      toast.error('Failed to update conversation');
      return null;
    }
  };
  
  // Delete conversation
  const deleteConversation = async (id: string): Promise<boolean> => {
    try {
      await conversationService.deleteConversation(id);
      
      // Remove from local state
      conversations.value = conversations.value.filter(c => c.id !== id);
      
      if (activeConversation.value?.id === id) {
        activeConversation.value = null;
      }
      
      toast.success('Conversation deleted');
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
      return false;
    }
  };
  
  // Set active conversation
  const setActiveConversation = (conversation: Conversation | null) => {
    activeConversation.value = conversation;
  };
  
  // Archive/unarchive
  const toggleArchive = async (id: string): Promise<boolean> => {
    const conversation = conversations.value.find(c => c.id === id);
    if (!conversation) return false;
    
    const updated = await updateConversation(id, {
      is_archived: !conversation.is_archived,
    });
    
    return !!updated;
  };
  
  // Star/unstar
  const toggleStar = async (id: string): Promise<boolean> => {
    const conversation = conversations.value.find(c => c.id === id);
    if (!conversation) return false;
    
    const updated = await updateConversation(id, {
      is_starred: !conversation.is_starred,
    });
    
    return !!updated;
  };
  
  return {
    conversations,
    activeConversation,
    loading,
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    setActiveConversation,
    toggleArchive,
    toggleStar,
  };
}
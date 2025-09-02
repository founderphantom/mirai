import { onMounted, onUnmounted, ref, Ref } from 'vue';
import { websocketService, WebSocketEvents } from '@/services/websocket.service';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectOnMount?: boolean;
}

/**
 * Composable for WebSocket connection management
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const authStore = useAuthStore();
  const { isAuthenticated } = storeToRefs(authStore);
  
  const connected = websocketService.connected;
  const connecting = websocketService.connecting;
  const error = ref<Error | null>(null);
  
  const connect = async () => {
    if (!isAuthenticated.value) {
      error.value = new Error('Authentication required');
      return;
    }
    
    try {
      error.value = null;
      await websocketService.connect();
    } catch (err) {
      error.value = err as Error;
      console.error('WebSocket connection failed:', err);
    }
  };
  
  const disconnect = () => {
    websocketService.disconnect();
  };
  
  const reconnect = async () => {
    await websocketService.reconnect();
  };
  
  // Auto-connect on mount if authenticated
  onMounted(async () => {
    if (options.autoConnect !== false && isAuthenticated.value) {
      if (options.reconnectOnMount || !websocketService.isConnected()) {
        await connect();
      }
    }
  });
  
  // Disconnect on unmount if this was the component that initiated connection
  onUnmounted(() => {
    // Don't disconnect globally, just clean up listeners
  });
  
  return {
    connected,
    connecting,
    error,
    connect,
    disconnect,
    reconnect,
    service: websocketService,
  };
}

/**
 * Composable for WebSocket event handling
 */
export function useWebSocketEvents<K extends keyof WebSocketEvents>(
  event: K,
  handler: WebSocketEvents[K]
) {
  onMounted(() => {
    websocketService.on(event, handler);
  });
  
  onUnmounted(() => {
    websocketService.off(event, handler);
  });
}

/**
 * Composable for chat streaming via WebSocket
 */
export function useChatStream() {
  const { connected, connect } = useWebSocket();
  const streaming = ref(false);
  const streamContent = ref('');
  const streamError = ref<Error | null>(null);
  
  const startStream = async (
    conversationId: string,
    content: string,
    model?: string,
    provider?: string
  ) => {
    if (!connected.value) {
      await connect();
    }
    
    streaming.value = true;
    streamContent.value = '';
    streamError.value = null;
    
    // Listen for stream events
    const handleToken = (data: { content: string }) => {
      streamContent.value += data.content;
    };
    
    const handleComplete = () => {
      streaming.value = false;
    };
    
    const handleError = (error: any) => {
      streamError.value = error;
      streaming.value = false;
    };
    
    websocketService.on('chat:token', handleToken);
    websocketService.on('chat:complete', handleComplete);
    websocketService.on('error', handleError);
    
    // Send stream request
    try {
      websocketService.streamChat({
        conversationId,
        content,
        model,
        provider,
      });
    } catch (error) {
      streamError.value = error as Error;
      streaming.value = false;
    }
    
    // Cleanup function
    return () => {
      websocketService.off('chat:token', handleToken);
      websocketService.off('chat:complete', handleComplete);
      websocketService.off('error', handleError);
    };
  };
  
  const stopStream = () => {
    streaming.value = false;
  };
  
  return {
    streaming,
    streamContent,
    streamError,
    startStream,
    stopStream,
  };
}

/**
 * Composable for typing indicators
 */
export function useTypingIndicator(conversationId: Ref<string | null>) {
  const typingUsers = ref<Map<string, boolean>>(new Map());
  const isTyping = ref(false);
  let typingTimeout: NodeJS.Timeout | null = null;
  
  const sendTyping = (typing: boolean) => {
    if (!conversationId.value) return;
    
    websocketService.sendTypingIndicator(conversationId.value, typing);
    isTyping.value = typing;
    
    // Auto-stop typing after 5 seconds
    if (typing) {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      typingTimeout = setTimeout(() => {
        sendTyping(false);
      }, 5000);
    } else {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
    }
  };
  
  // Listen for typing events from other users
  onMounted(() => {
    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data.isTyping) {
        typingUsers.value.set(data.userId, true);
      } else {
        typingUsers.value.delete(data.userId);
      }
    };
    
    websocketService.on('typing:user', handleTyping);
    
    // Join conversation room
    if (conversationId.value) {
      websocketService.joinConversation(conversationId.value);
    }
    
    return () => {
      websocketService.off('typing:user', handleTyping);
      if (conversationId.value) {
        websocketService.leaveConversation(conversationId.value);
      }
    };
  });
  
  onUnmounted(() => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    if (isTyping.value) {
      sendTyping(false);
    }
  });
  
  return {
    typingUsers,
    isTyping,
    sendTyping,
  };
}

/**
 * Composable for voice chat
 */
export function useVoiceChat() {
  const { connected, connect } = useWebSocket();
  const voiceActive = ref(false);
  const voiceReady = ref(false);
  const voiceError = ref<Error | null>(null);
  
  const startVoice = async (conversationId: string) => {
    if (!connected.value) {
      await connect();
    }
    
    try {
      voiceError.value = null;
      websocketService.startVoiceChat(conversationId);
      
      // Wait for voice ready signal
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Voice chat initialization timeout'));
        }, 10000);
        
        const handleReady = () => {
          clearTimeout(timeout);
          voiceReady.value = true;
          voiceActive.value = true;
          resolve();
        };
        
        const handleError = (error: any) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        websocketService.on('voice:ready', handleReady);
        websocketService.on('error', handleError);
        
        // Cleanup
        setTimeout(() => {
          websocketService.off('voice:ready', handleReady);
          websocketService.off('error', handleError);
        }, 11000);
      });
    } catch (error) {
      voiceError.value = error as Error;
      voiceActive.value = false;
      voiceReady.value = false;
    }
  };
  
  const sendVoiceData = (audioData: ArrayBuffer) => {
    if (!voiceActive.value || !voiceReady.value) {
      console.warn('Voice chat not active or ready');
      return;
    }
    
    websocketService.sendVoiceData(audioData);
  };
  
  const stopVoice = () => {
    websocketService.stopVoiceChat();
    voiceActive.value = false;
    voiceReady.value = false;
  };
  
  onUnmounted(() => {
    if (voiceActive.value) {
      stopVoice();
    }
  });
  
  return {
    voiceActive,
    voiceReady,
    voiceError,
    startVoice,
    sendVoiceData,
    stopVoice,
  };
}
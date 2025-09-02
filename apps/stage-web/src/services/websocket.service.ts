import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api-client';
import { ref, Ref } from 'vue';

export interface WebSocketEvents {
  // Connection events
  connect: () => void;
  disconnect: (reason: string) => void;
  error: (error: any) => void;
  
  // Chat events
  'message:created': (message: any) => void;
  'chat:token': (data: { content: string }) => void;
  'chat:complete': (message: any) => void;
  
  // Typing indicators
  'typing:user': (data: { userId: string; isTyping: boolean }) => void;
  
  // Voice chat
  'voice:ready': () => void;
}

export interface ChatStreamData {
  conversationId: string;
  content: string;
  model?: string;
  provider?: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  public connected: Ref<boolean> = ref(false);
  public connecting: Ref<boolean> = ref(false);
  
  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }
      
      this.connecting.value = true;
      
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
      const token = getAccessToken();
      
      if (!token) {
        this.connecting.value = false;
        reject(new Error('No authentication token available'));
        return;
      }
      
      this.socket = io(wsUrl, {
        auth: {
          token,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      });
      
      // Setup event listeners
      this.socket.on('connect', () => {
        console.log('[WebSocket] Connected');
        this.connected.value = true;
        this.connecting.value = false;
        this.emit('connect');
        resolve();
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('[WebSocket] Disconnected:', reason);
        this.connected.value = false;
        this.emit('disconnect', reason);
      });
      
      this.socket.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
        this.connecting.value = false;
        this.emit('error', error);
        
        if (error.message === 'Authentication required' || error.message === 'Invalid token') {
          // Token is invalid, disconnect and clear
          this.disconnect();
          reject(error);
        }
      });
      
      // Chat events
      this.socket.on('message:created', (message) => {
        this.emit('message:created', message);
      });
      
      this.socket.on('chat:token', (data) => {
        this.emit('chat:token', data);
      });
      
      this.socket.on('chat:complete', (message) => {
        this.emit('chat:complete', message);
      });
      
      // Typing indicators
      this.socket.on('typing:user', (data) => {
        this.emit('typing:user', data);
      });
      
      // Voice chat
      this.socket.on('voice:ready', () => {
        this.emit('voice:ready');
      });
      
      // Connection timeout
      setTimeout(() => {
        if (!this.connected.value) {
          this.connecting.value = false;
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.value = false;
      this.listeners.clear();
    }
  }
  
  /**
   * Reconnect to WebSocket server
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }
  
  /**
   * Send chat message stream
   */
  streamChat(data: ChatStreamData): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('chat:stream', data);
  }
  
  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('conversation:join', conversationId);
  }
  
  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('conversation:leave', conversationId);
  }
  
  /**
   * Send typing indicator
   */
  sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    if (!this.socket?.connected) {
      return; // Silently fail for typing indicators
    }
    
    this.socket.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId,
    });
  }
  
  /**
   * Start voice chat
   */
  startVoiceChat(conversationId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('voice:start', {
      conversationId,
    });
  }
  
  /**
   * Send voice data
   */
  sendVoiceData(audioData: ArrayBuffer): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('voice:data', audioData);
  }
  
  /**
   * Stop voice chat
   */
  stopVoiceChat(): void {
    if (!this.socket?.connected) {
      return;
    }
    
    this.socket.emit('voice:stop');
  }
  
  /**
   * Listen to an event
   */
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  /**
   * Emit event to local listeners
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
  
  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const websocketService = new WebSocketService();
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getAdminClient, getUserClient } from '../database/connection.js';
import { aiProviderService } from '../services/ai-provider.service.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  subscriptionTier?: string;
}

/**
 * Initialize WebSocket server
 */
export const initializeSocketServer = (io: SocketIOServer) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify token with Supabase
      const supabaseClient = getUserClient(token);
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      
      if (error || !user) {
        return next(new Error('Invalid token'));
      }
      
      // Get user profile
      const adminClient = getAdminClient();
      const { data: userProfile } = await adminClient
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
      
      // Attach user info to socket
      socket.userId = user.id;
      socket.userEmail = user.email || '';
      socket.subscriptionTier = userProfile?.subscription_tier || 'free';
      
      logger.info('WebSocket client authenticated', {
        userId: user.id,
        socketId: socket.id,
      });
      
      next();
    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
    });
    
    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }
    
    // Handle chat message streaming
    socket.on('chat:stream', async (data) => {
      try {
        const { conversationId, content, model, provider } = data;
        
        // Validate user owns the conversation
        const adminClient = getAdminClient();
        const { data: conversation, error } = await adminClient
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .eq('user_id', socket.userId)
          .single();
        
        if (error || !conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Check message limits
        const limits = config.rateLimit.tiers[socket.subscriptionTier!];
        if (limits.messagesPerDay !== -1) {
          const { data: userProfile } = await adminClient
            .from('user_profiles')
            .select('daily_message_count')
            .eq('id', socket.userId)
            .single();
          
          if (userProfile && userProfile.daily_message_count >= limits.messagesPerDay) {
            socket.emit('error', { 
              message: 'Daily message limit reached',
              code: 'MESSAGE_LIMIT_EXCEEDED'
            });
            return;
          }
        }
        
        // Store user message
        const { data: userMessage } = await adminClient
          .from('chat_messages')
          .insert({
            conversation_id: conversationId,
            user_id: socket.userId,
            role: 'user',
            content,
            content_type: 'text',
          })
          .select()
          .single();
        
        socket.emit('message:created', userMessage);
        
        // Get conversation history for context
        const { data: messages } = await adminClient
          .from('chat_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(50);
        
        // Prepare messages for AI
        const aiMessages = messages?.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })) || [];
        
        // Add system prompt if exists
        if (conversation.system_prompt) {
          aiMessages.unshift({
            role: 'system',
            content: conversation.system_prompt,
          });
        }
        
        // Stream response from AI provider
        let assistantContent = '';
        let totalTokens = 0;
        
        // For now, we'll get the full response (streaming implementation would require provider-specific handling)
        try {
          const response = await aiProviderService.getChatCompletion(
            provider || conversation.provider_id,
            {
              model: model || conversation.model_id,
              messages: aiMessages,
              temperature: conversation.temperature,
              maxTokens: conversation.max_tokens,
              userId: socket.userId,
            }
          );
          
          assistantContent = response.content;
          totalTokens = response.totalTokens;
          
          // Simulate streaming by sending chunks
          const chunks = assistantContent.match(/.{1,50}/g) || [];
          for (const chunk of chunks) {
            socket.emit('chat:token', { content: chunk });
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
          }
          
          // Store assistant message
          const { data: assistantMessage } = await adminClient
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              user_id: socket.userId,
              role: 'assistant',
              content: assistantContent,
              content_type: 'text',
              model_id: model || conversation.model_id,
              provider_id: provider || conversation.provider_id,
              prompt_tokens: response.promptTokens,
              completion_tokens: response.completionTokens,
              total_tokens: totalTokens,
            })
            .select()
            .single();
          
          socket.emit('chat:complete', assistantMessage);
          
        } catch (aiError) {
          logger.error('AI provider error:', aiError);
          socket.emit('error', { 
            message: 'Failed to generate response',
            code: 'AI_ERROR'
          });
        }
        
      } catch (error) {
        logger.error('WebSocket chat error:', error);
        socket.emit('error', { message: 'Chat failed' });
      }
    });
    
    // Handle conversation updates
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`);
    });
    
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} left conversation ${conversationId}`);
    });
    
    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user', {
        userId: socket.userId,
        isTyping: true,
      });
    });
    
    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:user', {
        userId: socket.userId,
        isTyping: false,
      });
    });
    
    // Handle voice chat (Plus+ feature)
    socket.on('voice:start', async (data) => {
      if (!['plus', 'pro', 'enterprise'].includes(socket.subscriptionTier!)) {
        socket.emit('error', { 
          message: 'Voice chat requires Plus subscription or higher',
          code: 'SUBSCRIPTION_REQUIRED'
        });
        return;
      }
      
      // Voice chat implementation would go here
      socket.emit('voice:ready');
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      });
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error:', {
        socketId: socket.id,
        userId: socket.userId,
        error,
      });
    });
  });
  
  // Periodic health check
  setInterval(() => {
    const sockets = io.sockets.sockets;
    logger.debug(`WebSocket connections: ${sockets.size}`);
  }, 60000); // Every minute
};

/**
 * Broadcast to specific user
 */
export const broadcastToUser = (io: SocketIOServer, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Broadcast to conversation participants
 */
export const broadcastToConversation = (io: SocketIOServer, conversationId: string, event: string, data: any) => {
  io.to(`conversation:${conversationId}`).emit(event, data);
};
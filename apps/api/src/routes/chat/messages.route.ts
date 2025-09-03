import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { chatService } from '@/services/chat.service';
import { conversationService } from '@/services/conversation.service';
import { subscriptionService } from '@/services/subscription.service';
import { usageService } from '@/services/usage.service';
import { moderationService } from '@/services/moderation.service';

const router = Router();

// Schemas
const createMessageSchema = z.object({
  body: z.object({
    conversation_id: z.string().uuid(),
    content: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system', 'function']),
    content_type: z.enum(['text', 'image', 'audio', 'code', 'file']).optional(),
    attachments: z.array(z.object({
      file_name: z.string(),
      file_type: z.string(),
      file_size: z.number(),
      storage_path: z.string(),
      url: z.string().optional(),
    })).optional(),
  }),
});

const getMessagesSchema = z.object({
  query: z.object({
    conversation_id: z.string().uuid(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
    includeDeleted: z.coerce.boolean().default(false),
  }),
});

const searchMessagesSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

const updateMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    content: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// Routes

/**
 * GET /api/chat/messages
 * Get messages for a conversation
 */
router.get(
  '/',
  authenticateToken,
  validateRequest(getMessagesSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { conversation_id, limit, offset, includeDeleted } = req.query as any;

      // Verify user owns the conversation
      const conversation = await conversationService.getConversation(conversation_id, userId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const messages = await chatService.getConversationMessages(conversation_id, {
        limit,
        offset,
        includeDeleted,
      });

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          total: messages.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/messages/search
 * Search messages across all conversations
 */
router.get(
  '/search',
  authenticateToken,
  validateRequest(searchMessagesSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { q, limit } = req.query as any;

      const results = await chatService.searchMessages(userId, q, limit);

      res.json({
        success: true,
        data: results,
        total: results.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/messages/:id
 * Get a specific message
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const messageId = req.params.id;
    const message = await chatService.getMessage(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/messages
 * Create a new message
 */
router.post(
  '/',
  authenticateToken,
  validateRequest(createMessageSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { conversation_id, content, role, content_type, attachments } = req.body;

      // Verify user owns the conversation
      const conversation = await conversationService.getConversation(conversation_id, userId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      // Check if user can send a message (rate limiting and subscription)
      const canSend = await subscriptionService.canSendMessage(userId);
      if (!canSend.allowed) {
        return res.status(403).json({
          success: false,
          error: canSend.reason,
          remainingMessages: canSend.remainingMessages,
        });
      }

      // Check content moderation for user messages
      if (role === 'user') {
        const moderationResult = await moderationService.checkContent(content, userId);
        
        if (moderationResult.action === 'blocked') {
          return res.status(400).json({
            success: false,
            error: moderationResult.reason || 'Content violates community guidelines',
            moderation: {
              flagged: true,
              categories: moderationResult.categories,
            },
          });
        }

        if (moderationResult.action === 'warning') {
          // Include warning in response but allow message
          res.locals.moderationWarning = {
            flagged: true,
            categories: moderationResult.categories,
            message: moderationResult.reason,
          };
        }
      }

      // Create the message
      let message;
      if (attachments && attachments.length > 0) {
        message = await chatService.createMessageWithAttachments(
          {
            conversation_id,
            role,
            content,
            content_type,
          },
          attachments
        );
      } else {
        message = await chatService.createMessage({
          conversation_id,
          role,
          content,
          content_type,
        });
      }

      // Increment message count for user
      if (role === 'user') {
        await subscriptionService.incrementMessageCount(userId);
      }

      // Generate title from first message if needed
      if (conversation.message_count === 0 && role === 'user') {
        await conversationService.generateTitle(conversation_id, userId, content);
      }

      res.status(201).json({
        success: true,
        data: message,
        moderation: res.locals.moderationWarning,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/chat/messages/:id
 * Update a message
 */
router.put(
  '/:id',
  authenticateToken,
  validateRequest(updateMessageSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const messageId = req.params.id;
      const updates = req.body;

      // Get the message to verify ownership
      const message = await chatService.getMessage(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found',
        });
      }

      // Verify user owns the conversation
      const conversation = await conversationService.getConversation(
        message.conversation_id,
        userId
      );
      if (!conversation) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Check content moderation if content is being updated
      if (updates.content) {
        const moderationResult = await moderationService.checkContent(updates.content, userId, messageId);
        
        if (moderationResult.action === 'blocked') {
          return res.status(400).json({
            success: false,
            error: moderationResult.reason || 'Content violates community guidelines',
          });
        }
      }

      const updatedMessage = await chatService.updateMessage(messageId, updates);

      res.json({
        success: true,
        data: updatedMessage,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/chat/messages/:id
 * Soft delete a message
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const messageId = req.params.id;

    // Get the message to verify ownership
    const message = await chatService.getMessage(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Verify user owns the conversation
    const conversation = await conversationService.getConversation(
      message.conversation_id,
      userId
    );
    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    await chatService.deleteMessage(messageId);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/messages/:id/attachments
 * Get attachments for a message
 */
router.get('/:id/attachments', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const messageId = req.params.id;

    // Get the message to verify ownership
    const message = await chatService.getMessage(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Verify user owns the conversation
    const conversation = await conversationService.getConversation(
      message.conversation_id,
      userId
    );
    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const attachments = await chatService.getMessageAttachments(messageId);

    res.json({
      success: true,
      data: attachments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/messages/stats/:conversation_id
 * Get message statistics for a conversation
 */
router.get('/stats/:conversation_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.conversation_id;

    // Verify user owns the conversation
    const conversation = await conversationService.getConversation(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    const stats = await chatService.getConversationStats(conversationId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
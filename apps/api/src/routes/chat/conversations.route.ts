import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { conversationService } from '@/services/conversation.service';
import { chatService } from '@/services/chat.service';
import { subscriptionService } from '@/services/subscription.service';
import { usageService } from '@/services/usage.service';
import { moderationService } from '@/services/moderation.service';

const router = Router();

// Schemas
const createConversationSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    model: z.string(),
    provider: z.enum(['openai', 'anthropic', 'google', 'mistral']).optional(),
    settings: z.record(z.any()).optional(),
  }),
});

const updateConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    model: z.string().optional(),
    provider: z.enum(['openai', 'anthropic', 'google', 'mistral']).optional(),
    settings: z.record(z.any()).optional(),
  }),
});

const getConversationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    includeArchived: z.coerce.boolean().default(false),
    onlyStarred: z.coerce.boolean().default(false),
  }),
});

const searchConversationsSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

// Routes

/**
 * GET /api/chat/conversations
 * Get all conversations for the authenticated user
 */
router.get(
  '/',
  authenticateToken,
  validateRequest(getConversationsSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { limit, offset, includeArchived, onlyStarred } = req.query as any;

      const conversations = await conversationService.getUserConversations(userId, {
        limit,
        offset,
        includeArchived,
        onlyStarred,
      });

      res.json({
        success: true,
        data: conversations,
        pagination: {
          limit,
          offset,
          total: conversations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/conversations/with-messages
 * Get conversations with last message (optimized)
 */
router.get(
  '/with-messages',
  authenticateToken,
  validateRequest(getConversationsSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { limit, offset } = req.query as any;

      const conversations = await conversationService.getConversationsWithLastMessage(
        userId,
        limit,
        offset
      );

      res.json({
        success: true,
        data: conversations,
        pagination: {
          limit,
          offset,
          total: conversations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/conversations/search
 * Search conversations by title
 */
router.get(
  '/search',
  authenticateToken,
  validateRequest(searchConversationsSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { q, limit } = req.query as any;

      const conversations = await conversationService.searchConversations(userId, q, limit);

      res.json({
        success: true,
        data: conversations,
        total: conversations.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat/conversations/stats
 * Get conversation statistics for the user
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const stats = await conversationService.getUserConversationStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get a specific conversation
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    const conversation = await conversationService.getConversation(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
router.post(
  '/',
  authenticateToken,
  validateRequest(createConversationSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { title, model, provider, settings } = req.body;

      // Check if user can create a conversation
      const profile = await subscriptionService.getUserProfile(userId);
      const limits = await subscriptionService.getUserLimits(userId);
      
      if (limits.maxConversations !== -1) {
        const stats = await conversationService.getUserConversationStats(userId);
        if (stats.total >= limits.maxConversations) {
          return res.status(403).json({
            success: false,
            error: `Conversation limit reached. Maximum ${limits.maxConversations} conversations allowed for your plan.`,
          });
        }
      }

      const conversation = await conversationService.createConversation({
        user_id: userId,
        title,
        model,
        provider,
        settings,
      });

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/chat/conversations/:id
 * Update a conversation
 */
router.put(
  '/:id',
  authenticateToken,
  validateRequest(updateConversationSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const conversationId = req.params.id;
      const updates = req.body;

      const conversation = await conversationService.updateConversation(
        conversationId,
        userId,
        updates
      );

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat/conversations/:id/star
 * Toggle star status of a conversation
 */
router.post('/:id/star', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    const conversation = await conversationService.toggleStar(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations/:id/archive
 * Toggle archive status of a conversation
 */
router.post('/:id/archive', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    const conversation = await conversationService.toggleArchive(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/conversations/:id/duplicate
 * Duplicate a conversation
 */
router.post('/:id/duplicate', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    const newConversation = await conversationService.duplicateConversation(
      conversationId,
      userId
    );

    res.status(201).json({
      success: true,
      data: newConversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    await conversationService.deleteConversation(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/:id/export
 * Export conversation as markdown
 */
router.get('/:id/export', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const conversationId = req.params.id;

    // Verify user owns the conversation
    const conversation = await conversationService.getConversation(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    const markdown = await chatService.exportConversation(conversationId);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="conversation-${conversationId}.md"`
    );
    res.send(markdown);
  } catch (error) {
    next(error);
  }
});

export default router;
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, requireSubscription } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import * as conversationController from '../controllers/conversation.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('archived').optional().isBoolean(),
    query('starred').optional().isBoolean(),
    query('sort').optional().isIn(['created_at', 'updated_at', 'last_message_at']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  validateRequest,
  asyncHandler(conversationController.getConversations)
);

/**
 * @route   POST /api/v1/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('title').optional().isString().isLength({ max: 255 }),
    body('model_id').isString().withMessage('Model ID is required'),
    body('provider_id').isString().withMessage('Provider ID is required'),
    body('system_prompt').optional().isString().isLength({ max: 5000 }),
    body('temperature').optional().isFloat({ min: 0, max: 2 }),
    body('max_tokens').optional().isInt({ min: 1, max: 32000 }),
    body('personality_template').optional().isString(),
    body('avatar_id').optional().isString(),
    body('voice_id').optional().isString(),
    body('settings').optional().isObject(),
  ],
  validateRequest,
  asyncHandler(conversationController.createConversation)
);

/**
 * @route   GET /api/v1/conversations/:id
 * @desc    Get a specific conversation
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  asyncHandler(conversationController.getConversation)
);

/**
 * @route   PATCH /api/v1/conversations/:id
 * @desc    Update a conversation
 * @access  Private
 */
router.patch(
  '/:id',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    body('title').optional().isString().isLength({ max: 255 }),
    body('summary').optional().isString().isLength({ max: 1000 }),
    body('system_prompt').optional().isString().isLength({ max: 5000 }),
    body('temperature').optional().isFloat({ min: 0, max: 2 }),
    body('max_tokens').optional().isInt({ min: 1, max: 32000 }),
    body('is_archived').optional().isBoolean(),
    body('is_starred').optional().isBoolean(),
    body('tags').optional().isArray(),
    body('settings').optional().isObject(),
  ],
  validateRequest,
  asyncHandler(conversationController.updateConversation)
);

/**
 * @route   DELETE /api/v1/conversations/:id
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  asyncHandler(conversationController.deleteConversation)
);

/**
 * @route   GET /api/v1/conversations/:id/messages
 * @desc    Get messages in a conversation
 * @access  Private
 */
router.get(
  '/:id/messages',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('cursor').optional().isString(),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  validateRequest,
  asyncHandler(conversationController.getConversationMessages)
);

/**
 * @route   POST /api/v1/conversations/:id/clear
 * @desc    Clear all messages in a conversation
 * @access  Private
 */
router.post(
  '/:id/clear',
  authenticate,
  [param('id').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  asyncHandler(conversationController.clearConversation)
);

/**
 * @route   POST /api/v1/conversations/:id/fork
 * @desc    Fork a conversation at a specific message
 * @access  Private (Pro tier and above)
 */
router.post(
  '/:id/fork',
  authenticate,
  requireSubscription('pro'),
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    body('message_id').isUUID().withMessage('Message ID is required'),
    body('title').optional().isString().isLength({ max: 255 }),
  ],
  validateRequest,
  asyncHandler(conversationController.forkConversation)
);

/**
 * @route   POST /api/v1/conversations/:id/export
 * @desc    Export conversation as JSON or Markdown
 * @access  Private
 */
router.post(
  '/:id/export',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    body('format').optional().isIn(['json', 'markdown', 'txt']),
  ],
  validateRequest,
  asyncHandler(conversationController.exportConversation)
);

/**
 * @route   POST /api/v1/conversations/:id/share
 * @desc    Generate a shareable link for a conversation
 * @access  Private (Plus tier and above)
 */
router.post(
  '/:id/share',
  authenticate,
  requireSubscription('plus'),
  [
    param('id').isUUID().withMessage('Invalid conversation ID'),
    body('expires_in').optional().isInt({ min: 3600, max: 604800 }), // 1 hour to 7 days
    body('password').optional().isString(),
  ],
  validateRequest,
  asyncHandler(conversationController.shareConversation)
);

/**
 * @route   POST /api/v1/conversations/:id/summarize
 * @desc    Generate a summary of the conversation
 * @access  Private
 */
router.post(
  '/:id/summarize',
  authenticate,
  [param('id').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  asyncHandler(conversationController.summarizeConversation)
);

/**
 * @route   POST /api/v1/conversations/import
 * @desc    Import a conversation from JSON
 * @access  Private (Pro tier and above)
 */
router.post(
  '/import',
  authenticate,
  requireSubscription('pro'),
  [
    body('data').isObject().withMessage('Conversation data is required'),
    body('format').optional().isIn(['json', 'chatgpt', 'claude']),
  ],
  validateRequest,
  asyncHandler(conversationController.importConversation)
);

export default router;
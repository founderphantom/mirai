import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, checkMessageLimit, requireSubscription } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

/**
 * @route   POST /api/v1/chat/messages
 * @desc    Send a chat message and get AI response
 * @access  Private
 */
router.post(
  '/messages',
  authenticate,
  checkMessageLimit,
  [
    body('conversation_id').isUUID().withMessage('Invalid conversation ID'),
    body('content').isString().isLength({ min: 1, max: 10000 }).withMessage('Message content is required'),
    body('content_type').optional().isIn(['text', 'image', 'audio', 'code']),
    body('attachments').optional().isArray(),
    body('stream').optional().isBoolean(),
  ],
  validateRequest,
  asyncHandler(chatController.sendMessage)
);

/**
 * @route   POST /api/v1/chat/messages/regenerate
 * @desc    Regenerate the last AI response
 * @access  Private
 */
router.post(
  '/messages/regenerate',
  authenticate,
  checkMessageLimit,
  [
    body('conversation_id').isUUID().withMessage('Invalid conversation ID'),
    body('message_id').optional().isUUID().withMessage('Invalid message ID'),
  ],
  validateRequest,
  asyncHandler(chatController.regenerateMessage)
);

/**
 * @route   PATCH /api/v1/chat/messages/:id
 * @desc    Update a message (edit or rate)
 * @access  Private
 */
router.patch(
  '/messages/:id',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid message ID'),
    body('content').optional().isString().isLength({ min: 1, max: 10000 }),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  asyncHandler(chatController.updateMessage)
);

/**
 * @route   DELETE /api/v1/chat/messages/:id
 * @desc    Soft delete a message
 * @access  Private
 */
router.delete(
  '/messages/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid message ID')],
  validateRequest,
  asyncHandler(chatController.deleteMessage)
);

/**
 * @route   POST /api/v1/chat/messages/:id/attachments
 * @desc    Upload attachments for a message
 * @access  Private (Plus tier and above)
 */
router.post(
  '/messages/:id/attachments',
  authenticate,
  requireSubscription('plus'),
  [param('id').isUUID().withMessage('Invalid message ID')],
  validateRequest,
  asyncHandler(chatController.uploadAttachment)
);

/**
 * @route   POST /api/v1/chat/messages/search
 * @desc    Search messages across all conversations
 * @access  Private
 */
router.post(
  '/messages/search',
  authenticate,
  [
    body('query').isString().isLength({ min: 2, max: 100 }).withMessage('Search query is required'),
    body('limit').optional().isInt({ min: 1, max: 100 }),
    body('conversation_id').optional().isUUID(),
  ],
  validateRequest,
  asyncHandler(chatController.searchMessages)
);

/**
 * @route   POST /api/v1/chat/completion
 * @desc    Direct chat completion without conversation context
 * @access  Private
 */
router.post(
  '/completion',
  authenticate,
  checkMessageLimit,
  [
    body('messages').isArray().withMessage('Messages array is required'),
    body('messages.*.role').isIn(['user', 'assistant', 'system']),
    body('messages.*.content').isString().isLength({ min: 1, max: 10000 }),
    body('model').optional().isString(),
    body('provider').optional().isString(),
    body('temperature').optional().isFloat({ min: 0, max: 2 }),
    body('max_tokens').optional().isInt({ min: 1, max: 32000 }),
    body('stream').optional().isBoolean(),
  ],
  validateRequest,
  asyncHandler(chatController.chatCompletion)
);

/**
 * @route   POST /api/v1/chat/moderation
 * @desc    Check content for policy violations
 * @access  Private
 */
router.post(
  '/moderation',
  authenticate,
  [
    body('content').isString().isLength({ min: 1, max: 10000 }).withMessage('Content is required'),
  ],
  validateRequest,
  asyncHandler(chatController.moderateContent)
);

/**
 * @route   GET /api/v1/chat/models
 * @desc    Get available AI models based on subscription
 * @access  Private
 */
router.get(
  '/models',
  authenticate,
  asyncHandler(chatController.getAvailableModels)
);

/**
 * @route   POST /api/v1/chat/tts
 * @desc    Text-to-speech conversion
 * @access  Private (Plus tier and above)
 */
router.post(
  '/tts',
  authenticate,
  requireSubscription('plus'),
  [
    body('text').isString().isLength({ min: 1, max: 5000 }).withMessage('Text is required'),
    body('voice_id').optional().isString(),
    body('provider').optional().isIn(['elevenlabs', 'openai', 'google']),
  ],
  validateRequest,
  asyncHandler(chatController.textToSpeech)
);

/**
 * @route   POST /api/v1/chat/stt
 * @desc    Speech-to-text conversion
 * @access  Private (Plus tier and above)
 */
router.post(
  '/stt',
  authenticate,
  requireSubscription('plus'),
  asyncHandler(chatController.speechToText)
);

export default router;
import { Router } from 'express';
import { authenticate, requireSubscription } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as providerController from '../controllers/provider.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/providers
 * @desc    Get available AI providers
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(providerController.getProviders)
);

/**
 * @route   GET /api/v1/providers/models
 * @desc    Get available models for user's tier
 * @access  Private
 */
router.get(
  '/models',
  authenticate,
  asyncHandler(providerController.getAvailableModels)
);

/**
 * @route   GET /api/v1/providers/status
 * @desc    Get provider health status
 * @access  Public
 */
router.get(
  '/status',
  asyncHandler(providerController.getProviderStatus)
);

/**
 * @route   GET /api/v1/providers/voices
 * @desc    Get available TTS voices
 * @access  Private (Plus+)
 */
router.get(
  '/voices',
  authenticate,
  requireSubscription('plus'),
  asyncHandler(providerController.getVoices)
);

/**
 * @route   GET /api/v1/providers/avatars
 * @desc    Get available avatars
 * @access  Private (Plus+)
 */
router.get(
  '/avatars',
  authenticate,
  requireSubscription('plus'),
  asyncHandler(providerController.getAvatars)
);

export default router;
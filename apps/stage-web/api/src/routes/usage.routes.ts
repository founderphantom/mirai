import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as usageController from '../controllers/usage.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/usage/summary
 * @desc    Get usage summary
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(usageController.getUsageSummary)
);

/**
 * @route   GET /api/v1/usage/daily
 * @desc    Get daily usage stats
 * @access  Private
 */
router.get(
  '/daily',
  authenticate,
  [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
  ],
  validateRequest,
  asyncHandler(usageController.getDailyUsage)
);

/**
 * @route   GET /api/v1/usage/tokens
 * @desc    Get token usage breakdown
 * @access  Private
 */
router.get(
  '/tokens',
  authenticate,
  asyncHandler(usageController.getTokenUsage)
);

/**
 * @route   GET /api/v1/usage/limits
 * @desc    Get current usage limits
 * @access  Private
 */
router.get(
  '/limits',
  authenticate,
  asyncHandler(usageController.getUsageLimits)
);

export default router;
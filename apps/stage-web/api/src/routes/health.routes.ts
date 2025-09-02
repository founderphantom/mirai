import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as healthController from '../controllers/health.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Basic health check
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(healthController.healthCheck)
);

/**
 * @route   GET /api/v1/health/live
 * @desc    Liveness probe for k8s
 * @access  Public
 */
router.get(
  '/live',
  asyncHandler(healthController.liveness)
);

/**
 * @route   GET /api/v1/health/ready
 * @desc    Readiness probe for k8s
 * @access  Public
 */
router.get(
  '/ready',
  asyncHandler(healthController.readiness)
);

/**
 * @route   GET /api/v1/health/providers
 * @desc    Get AI provider health status
 * @access  Public
 */
router.get(
  '/providers',
  asyncHandler(healthController.providerHealth)
);

export default router;
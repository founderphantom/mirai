import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/subscriptions/current
 * @desc    Get current subscription
 * @access  Private
 */
router.get(
  '/current',
  authenticate,
  asyncHandler(subscriptionController.getCurrentSubscription)
);

/**
 * @route   GET /api/v1/subscriptions/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get(
  '/plans',
  asyncHandler(subscriptionController.getPlans)
);

/**
 * @route   POST /api/v1/subscriptions/subscribe
 * @desc    Subscribe to a plan
 * @access  Private
 */
router.post(
  '/subscribe',
  authenticate,
  [
    body('plan_id').notEmpty().withMessage('Plan ID is required'),
    body('payment_method_id').notEmpty().withMessage('Payment method is required'),
  ],
  validateRequest,
  asyncHandler(subscriptionController.subscribe)
);

/**
 * @route   POST /api/v1/subscriptions/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post(
  '/cancel',
  authenticate,
  asyncHandler(subscriptionController.cancelSubscription)
);

/**
 * @route   POST /api/v1/subscriptions/resume
 * @desc    Resume canceled subscription
 * @access  Private
 */
router.post(
  '/resume',
  authenticate,
  asyncHandler(subscriptionController.resumeSubscription)
);

/**
 * @route   GET /api/v1/subscriptions/invoices
 * @desc    Get billing invoices
 * @access  Private
 */
router.get(
  '/invoices',
  authenticate,
  asyncHandler(subscriptionController.getInvoices)
);

export default router;
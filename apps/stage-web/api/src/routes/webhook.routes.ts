import { Router } from 'express';
import express from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as webhookController from '../controllers/webhook.controller.js';

const router = Router();

/**
 * @route   POST /api/v1/webhooks/stripe
 * @desc    Stripe webhook endpoint
 * @access  Public (validated by signature)
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }), // Stripe requires raw body
  asyncHandler(webhookController.handleStripeWebhook)
);

/**
 * @route   POST /api/v1/webhooks/supabase
 * @desc    Supabase webhook endpoint
 * @access  Public (validated by secret)
 */
router.post(
  '/supabase',
  asyncHandler(webhookController.handleSupabaseWebhook)
);

export default router;
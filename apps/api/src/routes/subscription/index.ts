import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { subscriptionService } from '@/services/subscription.service';
import { usageService } from '@/services/usage.service';
import Stripe from 'stripe';

const router = Router();

// Schemas
const createSubscriptionSchema = z.object({
  body: z.object({
    priceId: z.string(),
    tier: z.enum(['free', 'pro', 'enterprise']),
  }),
});

const updateSubscriptionSchema = z.object({
  body: z.object({
    priceId: z.string(),
    tier: z.enum(['free', 'pro', 'enterprise']),
  }),
});

const usageSummarySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// Routes

/**
 * GET /api/subscription/profile
 * Get user profile with subscription info
 */
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const profile = await subscriptionService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    const limits = await subscriptionService.getUserLimits(userId);

    res.json({
      success: true,
      data: {
        profile,
        limits,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/limits
 * Get subscription limits for the current user
 */
router.get('/limits', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const limits = await subscriptionService.getUserLimits(userId);
    const canSend = await subscriptionService.canSendMessage(userId);

    res.json({
      success: true,
      data: {
        limits,
        messaging: {
          canSend: canSend.allowed,
          reason: canSend.reason,
          remainingMessages: canSend.remainingMessages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscription/create
 * Create a new subscription
 */
router.post(
  '/create',
  authenticateToken,
  validateRequest(createSubscriptionSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { priceId, tier } = req.body;

      const subscription = await subscriptionService.createSubscription(userId, priceId, tier);

      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/subscription/update
 * Update subscription tier
 */
router.put(
  '/update',
  authenticateToken,
  validateRequest(updateSubscriptionSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { priceId, tier } = req.body;

      const subscription = await subscriptionService.updateSubscriptionTier(
        userId,
        priceId,
        tier
      );

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/subscription/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    await subscriptionService.cancelSubscription(userId);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/history
 * Get subscription history
 */
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const history = await subscriptionService.getSubscriptionHistory(userId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/payments
 * Get payment history
 */
router.get('/payments', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const payments = await subscriptionService.getPaymentHistory(userId);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/usage
 * Get usage summary
 */
router.get(
  '/usage',
  authenticateToken,
  validateRequest(usageSummarySchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const { startDate, endDate } = req.query as any;

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();

      const summary = await usageService.getUserUsageSummary(userId, start, end);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/subscription/usage/current-month
 * Get current month usage for billing
 */
router.get('/usage/current-month', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const usage = await usageService.getCurrentMonthUsage(userId);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/usage/daily
 * Get daily usage aggregates
 */
router.get('/usage/daily', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const aggregates = await usageService.getDailyAggregates(userId, startDate, endDate);

    res.json({
      success: true,
      data: aggregates,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/usage/export
 * Export usage data as CSV
 */
router.get('/usage/export', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const csv = await usageService.exportUsageAsCSV(userId, startDate, endDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="usage-export-${userId}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/subscription/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    // Verify webhook signature
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: `Webhook signature verification failed: ${err.message}`,
      });
    }

    // Handle the webhook
    await subscriptionService.handleStripeWebhook(event);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription/check-feature/:feature
 * Check if user has access to a specific feature
 */
router.get('/check-feature/:feature', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const feature = req.params.feature;

    const hasAccess = await subscriptionService.hasFeatureAccess(userId, feature);

    res.json({
      success: true,
      data: {
        feature,
        hasAccess,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
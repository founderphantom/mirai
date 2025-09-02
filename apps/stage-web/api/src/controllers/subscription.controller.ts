import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getAdminClient } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

// Initialize Stripe if configured
const stripe = config.stripe.secretKey 
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-11-20.acacia' })
  : null;

/**
 * Get available subscription plans
 */
export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        features: [
          '50 messages per day',
          'GPT-3.5 & Claude Haiku',
          'Basic chat features',
          'Community support'
        ]
      },
      {
        id: 'plus',
        name: 'Plus',
        price: 19.99,
        interval: 'month',
        stripe_price_id: config.stripe.prices?.plus,
        features: [
          '500 messages per day',
          'GPT-4 & Claude Sonnet',
          'Voice chat (60 min/month)',
          'Custom avatars',
          'Priority response'
        ]
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 49.99,
        interval: 'month',
        stripe_price_id: config.stripe.prices?.pro,
        features: [
          'Unlimited messages',
          'All AI models',
          'Voice chat (300 min/month)',
          'API access',
          'Priority support'
        ]
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'custom',
        interval: 'month',
        stripe_price_id: config.stripe.prices?.enterprise,
        features: [
          'Everything in Pro',
          'Custom models',
          'Unlimited voice',
          'SLA guarantee',
          'Dedicated support',
          'Custom integrations'
        ]
      }
    ];
    
    res.json(plans);
  } catch (error) {
    logger.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
};

/**
 * Get current subscription
 */
export const getCurrentSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!profile) {
      throw new AppError('Profile not found', 404);
    }
    
    // Get Stripe subscription if exists
    let stripeSubscription = null;
    if (stripe && profile.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          profile.stripe_subscription_id
        );
      } catch (stripeError) {
        logger.error('Stripe subscription fetch error:', stripeError);
      }
    }
    
    res.json({
      tier: profile.subscription_tier,
      status: profile.subscription_status,
      current_period_start: profile.current_period_start,
      current_period_end: profile.current_period_end,
      cancel_at_period_end: profile.cancel_at_period_end,
      stripe_subscription: stripeSubscription
    });
  } catch (error) {
    logger.error('Get current subscription error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get subscription' });
    }
  }
};

/**
 * Create Stripe checkout session
 */
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      throw new AppError('Payment processing not configured', 503);
    }
    
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const { plan_id } = req.body;
    
    // Validate plan
    const priceId = config.stripe.prices?.[plan_id as keyof typeof config.stripe.prices];
    if (!priceId) {
      throw new AppError('Invalid plan', 400);
    }
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    
    // Create or get Stripe customer
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId }
      });
      customerId = customer.id;
      
      // Save customer ID
      await adminClient
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${config.server.frontendUrl}/settings/subscription?success=true`,
      cancel_url: `${config.server.frontendUrl}/settings/subscription?canceled=true`,
      metadata: {
        user_id: userId,
        plan_id
      }
    });
    
    res.json({ checkout_url: session.url });
  } catch (error) {
    logger.error('Create checkout session error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }
};

/**
 * Create Stripe customer portal session
 */
export const createPortalSession = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      throw new AppError('Payment processing not configured', 503);
    }
    
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    
    if (!profile?.stripe_customer_id) {
      throw new AppError('No subscription found', 404);
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${config.server.frontendUrl}/settings/subscription`
    });
    
    res.json({ portal_url: session.url });
  } catch (error) {
    logger.error('Create portal session error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();
    
    if (!profile?.stripe_subscription_id) {
      throw new AppError('No active subscription', 404);
    }
    
    // Cancel at period end
    if (stripe) {
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }
    
    // Update profile
    await adminClient
      .from('user_profiles')
      .update({ cancel_at_period_end: true })
      .eq('id', userId);
    
    res.json({ message: 'Subscription will be canceled at the end of the billing period' });
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
};

/**
 * Resume canceled subscription
 */
export const resumeSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();
    
    if (!profile?.stripe_subscription_id) {
      throw new AppError('No subscription found', 404);
    }
    
    // Resume subscription
    if (stripe) {
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: false
      });
    }
    
    // Update profile
    await adminClient
      .from('user_profiles')
      .update({ cancel_at_period_end: false })
      .eq('id', userId);
    
    res.json({ message: 'Subscription resumed successfully' });
  } catch (error) {
    logger.error('Resume subscription error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to resume subscription' });
    }
  }
};
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getAdminClient } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Initialize Stripe if configured
const stripe = config.stripe.secretKey 
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-11-20.acacia' })
  : null;

/**
 * Handle Stripe webhooks
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment processing not configured' });
    }
    
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = config.stripe.webhookSecret;
    
    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const adminClient = getAdminClient();
    
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        
        if (userId && planId) {
          // Update user subscription
          await adminClient
            .from('user_profiles')
            .update({
              subscription_tier: planId,
              subscription_status: 'active',
              stripe_subscription_id: session.subscription as string,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', userId);
          
          logger.info(`Subscription activated for user ${userId}: ${planId}`);
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get user by customer ID
        const { data: profile } = await adminClient
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (profile) {
          // Determine tier from price ID
          let tier = 'free';
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId === config.stripe.prices?.plus) tier = 'plus';
          else if (priceId === config.stripe.prices?.pro) tier = 'pro';
          else if (priceId === config.stripe.prices?.enterprise) tier = 'enterprise';
          
          await adminClient
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              subscription_status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end
            })
            .eq('id', profile.id);
          
          logger.info(`Subscription updated for user ${profile.id}`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get user by customer ID
        const { data: profile } = await adminClient
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (profile) {
          // Downgrade to free tier
          await adminClient
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
              stripe_subscription_id: null
            })
            .eq('id', profile.id);
          
          logger.info(`Subscription canceled for user ${profile.id}`);
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.info(`Payment succeeded for invoice ${invoice.id}`);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        // Get user by customer ID
        const { data: profile } = await adminClient
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (profile) {
          // Mark subscription as past due
          await adminClient
            .from('user_profiles')
            .update({
              subscription_status: 'past_due'
            })
            .eq('id', profile.id);
          
          logger.warn(`Payment failed for user ${profile.id}`);
        }
        break;
      }
      
      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle Supabase webhooks (for real-time events)
 */
export const handleSupabaseWebhook = async (req: Request, res: Response) => {
  try {
    const { type, table, record, old_record } = req.body;
    
    // Verify webhook signature if configured
    const signature = req.headers['x-supabase-signature'];
    // TODO: Implement signature verification
    
    logger.info(`Supabase webhook received: ${type} on ${table}`);
    
    switch (type) {
      case 'INSERT':
        if (table === 'auth.users') {
          // New user registered, create profile
          const adminClient = getAdminClient();
          await adminClient
            .from('user_profiles')
            .insert({
              id: record.id,
              subscription_tier: 'free',
              subscription_status: 'active',
              preferences: {},
              metadata: {}
            });
          logger.info(`Profile created for new user ${record.id}`);
        }
        break;
        
      case 'UPDATE':
        // Handle updates if needed
        break;
        
      case 'DELETE':
        // Handle deletions if needed
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Supabase webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle custom webhooks (for integrations)
 */
export const handleCustomWebhook = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const apiKey = req.headers['x-api-key'];
    
    // Verify API key
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    logger.info(`Custom webhook received from ${provider}`);
    
    // Handle different providers
    switch (provider) {
      case 'slack':
        // Handle Slack events
        break;
        
      case 'discord':
        // Handle Discord events
        break;
        
      case 'teams':
        // Handle Microsoft Teams events
        break;
        
      default:
        return res.status(404).json({ error: 'Unknown provider' });
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Custom webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
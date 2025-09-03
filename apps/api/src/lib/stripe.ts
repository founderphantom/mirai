import Stripe from 'stripe';
import { supabaseAdmin } from './supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Price IDs from environment
export const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_ID_BASIC!,
  pro: process.env.STRIPE_PRICE_ID_PRO!,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE!,
};

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      messagesPerMonth: 100,
      voiceMinutesPerMonth: 10,
      customPersonalities: 1,
      gamingIntegration: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  basic: {
    name: 'Basic',
    price: 9.99,
    priceId: PRICE_IDS.basic,
    features: {
      messagesPerMonth: 1000,
      voiceMinutesPerMonth: 60,
      customPersonalities: 3,
      gamingIntegration: true,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  pro: {
    name: 'Pro',
    price: 29.99,
    priceId: PRICE_IDS.pro,
    features: {
      messagesPerMonth: 10000,
      voiceMinutesPerMonth: 300,
      customPersonalities: 10,
      gamingIntegration: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 99.99,
    priceId: PRICE_IDS.enterprise,
    features: {
      messagesPerMonth: -1, // Unlimited
      voiceMinutesPerMonth: -1, // Unlimited
      customPersonalities: -1, // Unlimited
      gamingIntegration: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
};

export class StripeService {
  // Create or get customer
  async createOrGetCustomer(userId: string, email: string, name?: string) {
    try {
      // Check if customer already exists
      const { data: existingCustomer } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .single();

      if (existingCustomer?.stripe_customer_id) {
        return existingCustomer.stripe_customer_id;
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          user_id: userId,
        },
      });

      return customer.id;
    } catch (error: any) {
      console.error('Error creating/getting customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create checkout session
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    try {
      const customerId = await this.createOrGetCustomer(userId, email);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
        },
        subscription_data: {
          metadata: {
            user_id: userId,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      return session;
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Create billing portal session
  async createBillingPortalSession(userId: string, returnUrl: string) {
    try {
      // Get customer ID
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .single();

      if (!subscription?.stripe_customer_id) {
        throw new Error('No subscription found');
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: returnUrl,
      });

      return session;
    } catch (error: any) {
      console.error('Error creating billing portal session:', error);
      throw new Error('Failed to create billing portal session');
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: string, immediately = false) {
    try {
      // Get subscription
      const { data: subscriptionData } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!subscriptionData?.stripe_subscription_id) {
        throw new Error('No active subscription found');
      }

      // Cancel in Stripe
      const subscription = await stripe.subscriptions.update(
        subscriptionData.stripe_subscription_id,
        {
          cancel_at_period_end: !immediately,
        }
      );

      // If immediate cancellation, delete the subscription
      if (immediately) {
        await stripe.subscriptions.cancel(subscriptionData.stripe_subscription_id);
      }

      // Update database
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: immediately ? 'canceled' : 'active',
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          canceled_at: immediately ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return { success: true, subscription };
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Resume subscription
  async resumeSubscription(userId: string) {
    try {
      // Get subscription
      const { data: subscriptionData } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .single();

      if (!subscriptionData?.stripe_subscription_id) {
        throw new Error('No subscription found');
      }

      // Resume in Stripe
      const subscription = await stripe.subscriptions.update(
        subscriptionData.stripe_subscription_id,
        {
          cancel_at_period_end: false,
        }
      );

      // Update database
      await supabaseAdmin
        .from('subscriptions')
        .update({
          cancel_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return { success: true, subscription };
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      throw new Error('Failed to resume subscription');
    }
  }

  // Handle webhook events
  async handleWebhookEvent(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      throw error;
    }
  }

  // Handle checkout completed
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.user_id;
    if (!userId) return;

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    
    // Get plan from price ID
    let planId = 'basic';
    const priceId = subscription.items.data[0]?.price.id;
    
    if (priceId === PRICE_IDS.pro) planId = 'pro';
    else if (priceId === PRICE_IDS.enterprise) planId = 'enterprise';

    // Create or update subscription record
    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        plan_id: planId,
        status: subscription.status as any,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'subscription_created',
        title: 'Subscription Activated',
        message: `Your ${planId} subscription is now active!`,
        created_at: new Date().toISOString(),
      });
  }

  // Handle subscription update
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    // Get plan from price ID
    let planId = 'basic';
    const priceId = subscription.items.data[0]?.price.id;
    
    if (priceId === PRICE_IDS.pro) planId = 'pro';
    else if (priceId === PRICE_IDS.enterprise) planId = 'enterprise';

    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_id: planId,
        status: subscription.status as any,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  // Handle subscription deleted
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'subscription_canceled',
        title: 'Subscription Canceled',
        message: 'Your subscription has been canceled.',
        created_at: new Date().toISOString(),
      });
  }

  // Handle invoice payment succeeded
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    
    // Get user from customer ID
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!subscription) return;

    // Log payment
    await supabaseAdmin
      .from('payments')
      .insert({
        user_id: subscription.user_id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status: 'succeeded',
        created_at: new Date().toISOString(),
      });
  }

  // Handle invoice payment failed
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    
    // Get user from customer ID
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!subscription) return;

    // Update subscription status
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', subscription.user_id);

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: subscription.user_id,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: 'Your payment failed. Please update your payment method.',
        created_at: new Date().toISOString(),
      });
  }
}

export const stripeService = new StripeService();
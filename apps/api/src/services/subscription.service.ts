import { supabase } from '../lib/supabase';
import { stripe } from '../lib/stripe';
import {
  UserProfile,
  UserProfileUpdate,
  SubscriptionHistory,
  PaymentHistory,
  Json
} from '../types/database';
import Stripe from 'stripe';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';

interface SubscriptionLimits {
  dailyMessages: number;
  maxTokensPerMessage: number;
  maxConversations: number;
  maxFileSize: number; // in MB
  features: string[];
}

const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    dailyMessages: 20,
    maxTokensPerMessage: 2000,
    maxConversations: 5,
    maxFileSize: 5,
    features: ['basic_chat', 'gpt3.5']
  },
  pro: {
    dailyMessages: 200,
    maxTokensPerMessage: 8000,
    maxConversations: 100,
    maxFileSize: 20,
    features: ['basic_chat', 'gpt3.5', 'gpt4', 'image_generation', 'voice_chat', 'file_uploads']
  },
  enterprise: {
    dailyMessages: -1, // unlimited
    maxTokensPerMessage: 32000,
    maxConversations: -1, // unlimited
    maxFileSize: 100,
    features: [
      'basic_chat', 'gpt3.5', 'gpt4', 'gpt4_turbo', 'claude', 
      'image_generation', 'voice_chat', 'file_uploads', 'custom_models',
      'api_access', 'priority_support', 'team_collaboration'
    ]
  }
};

export class SubscriptionService {
  /**
   * Get user profile with subscription info
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Create or update user profile
   */
  async upsertUserProfile(data: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  }): Promise<UserProfile> {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: data.id,
        email: data.email,
        full_name: data.full_name || null,
        avatar_url: data.avatar_url || null,
        subscription_tier: 'free',
        subscription_status: 'active',
        daily_message_count: 0,
        total_message_count: 0,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert user profile: ${error.message}`);
    }

    return profile;
  }

  /**
   * Get subscription limits for a user
   */
  async getUserLimits(userId: string): Promise<SubscriptionLimits> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return SUBSCRIPTION_LIMITS.free;
    }

    return SUBSCRIPTION_LIMITS[profile.subscription_tier];
  }

  /**
   * Check if user can send a message
   */
  async canSendMessage(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingMessages?: number;
  }> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return { allowed: false, reason: 'User profile not found' };
    }

    const limits = SUBSCRIPTION_LIMITS[profile.subscription_tier];
    
    // Check if subscription is active
    if (profile.subscription_status !== 'active' && profile.subscription_status !== 'trialing') {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Enterprise has unlimited messages
    if (profile.subscription_tier === 'enterprise') {
      return { allowed: true };
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const lastMessageDate = profile.last_message_at 
      ? new Date(profile.last_message_at).toISOString().split('T')[0]
      : null;

    // Reset daily count if it's a new day
    if (lastMessageDate !== today) {
      await this.resetDailyMessageCount(userId);
      return { 
        allowed: true, 
        remainingMessages: limits.dailyMessages - 1 
      };
    }

    // Check if under daily limit
    if (profile.daily_message_count >= limits.dailyMessages) {
      return { 
        allowed: false, 
        reason: `Daily message limit (${limits.dailyMessages}) reached`,
        remainingMessages: 0
      };
    }

    return { 
      allowed: true,
      remainingMessages: limits.dailyMessages - profile.daily_message_count
    };
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(userId: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const lastMessageDate = profile.last_message_at 
      ? new Date(profile.last_message_at).toISOString().split('T')[0]
      : null;

    const updates: UserProfileUpdate = {
      total_message_count: profile.total_message_count + 1,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Reset daily count if it's a new day
    if (lastMessageDate !== today) {
      updates.daily_message_count = 1;
    } else {
      updates.daily_message_count = profile.daily_message_count + 1;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to increment message count: ${error.message}`);
    }
  }

  /**
   * Reset daily message count
   */
  async resetDailyMessageCount(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        daily_message_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to reset daily message count: ${error.message}`);
    }
  }

  /**
   * Create Stripe customer for user
   */
  async createStripeCustomer(userId: string, email: string): Promise<string> {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        user_id: userId
      }
    });

    // Update user profile with Stripe customer ID
    const { error } = await supabase
      .from('user_profiles')
      .update({
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update Stripe customer ID: ${error.message}`);
    }

    return customer.id;
  }

  /**
   * Create subscription for user
   */
  async createSubscription(
    userId: string,
    priceId: string,
    tier: SubscriptionTier
  ): Promise<Stripe.Subscription> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      customerId = await this.createStripeCustomer(userId, profile.email);
    }

    // Create subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        user_id: userId,
        tier
      }
    });

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_tier: tier,
        subscription_status: subscription.status as SubscriptionStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Failed to update subscription info: ${profileError.message}`);
    }

    // Create subscription history record
    const { error: historyError } = await supabase
      .from('subscription_history')
      .insert({
        user_id: userId,
        stripe_subscription_id: subscription.id,
        plan_id: priceId,
        tier,
        status: subscription.status as SubscriptionStatus,
        amount: subscription.items.data[0].price.unit_amount || 0,
        currency: subscription.items.data[0].price.currency,
        interval: subscription.items.data[0].price.recurring?.interval as 'month' | 'year',
        started_at: new Date(subscription.created * 1000).toISOString(),
        metadata: { stripe_response: subscription } as Json
      });

    if (historyError) {
      console.error('Failed to create subscription history:', historyError);
    }

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile || !profile.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    // Cancel in Stripe
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Failed to update subscription status: ${profileError.message}`);
    }

    // Update subscription history
    const { error: historyError } = await supabase
      .from('subscription_history')
      .update({
        status: 'canceled',
        ended_at: new Date(subscription.cancel_at! * 1000).toISOString()
      })
      .eq('stripe_subscription_id', profile.stripe_subscription_id)
      .is('ended_at', null);

    if (historyError) {
      console.error('Failed to update subscription history:', historyError);
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(
    userId: string,
    newPriceId: string,
    newTier: SubscriptionTier
  ): Promise<Stripe.Subscription> {
    const profile = await this.getUserProfile(userId);
    if (!profile || !profile.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    
    // Update subscription item with new price
    const updatedSubscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId
        }],
        metadata: {
          user_id: userId,
          tier: newTier
        }
      }
    );

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: newTier,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      throw new Error(`Failed to update subscription tier: ${profileError.message}`);
    }

    // End current history record and create new one
    await supabase
      .from('subscription_history')
      .update({ ended_at: new Date().toISOString() })
      .eq('stripe_subscription_id', profile.stripe_subscription_id)
      .is('ended_at', null);

    await supabase
      .from('subscription_history')
      .insert({
        user_id: userId,
        stripe_subscription_id: updatedSubscription.id,
        plan_id: newPriceId,
        tier: newTier,
        status: updatedSubscription.status as SubscriptionStatus,
        amount: updatedSubscription.items.data[0].price.unit_amount || 0,
        currency: updatedSubscription.items.data[0].price.currency,
        interval: updatedSubscription.items.data[0].price.recurring?.interval as 'month' | 'year',
        started_at: new Date().toISOString()
      });

    return updatedSubscription;
  }

  /**
   * Handle webhook from Stripe
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.user_id;
        
        if (!userId) {
          console.error('No user_id in subscription metadata');
          return;
        }

        // Update user profile
        await supabase
          .from('user_profiles')
          .update({
            subscription_status: subscription.status as SubscriptionStatus,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        // Update subscription history
        await supabase
          .from('subscription_history')
          .update({
            status: subscription.status as SubscriptionStatus,
            ended_at: subscription.status === 'canceled' 
              ? new Date().toISOString() 
              : null
          })
          .eq('stripe_subscription_id', subscription.id)
          .is('ended_at', null);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        
        if (!invoice.subscription || !invoice.customer) {
          return;
        }

        // Get user ID from customer
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single();

        if (profile) {
          // Create payment history record
          await supabase
            .from('payment_history')
            .insert({
              user_id: profile.id,
              stripe_payment_intent_id: invoice.payment_intent as string,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
              description: `Subscription payment for ${invoice.period_start} - ${invoice.period_end}`,
              metadata: { invoice } as Json
            });
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        
        if (!failedInvoice.subscription) {
          return;
        }

        // Update subscription status to past_due
        await supabase
          .from('user_profiles')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', failedInvoice.subscription);
        break;
    }
  }

  /**
   * Get subscription history for a user
   */
  async getSubscriptionHistory(userId: string): Promise<SubscriptionHistory[]> {
    const { data, error } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch subscription history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payment history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check feature access
   */
  async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const limits = await this.getUserLimits(userId);
    return limits.features.includes(feature);
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
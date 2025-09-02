import { api } from '@/lib/api-client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'plus' | 'pro' | 'enterprise';
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: {
    messages_per_day: number;
    tokens_per_month: number;
    models: string[];
    voice_enabled: boolean;
    file_uploads: boolean;
    custom_avatars: boolean;
    priority_support: boolean;
    api_access: boolean;
    team_collaboration: boolean;
  };
  limits: {
    max_conversations: number;
    max_message_length: number;
    max_file_size: number;
    conversation_history_days: number;
  };
  description: string;
  popular?: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  tier: 'free' | 'plus' | 'pro' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  payment_method?: {
    type: string;
    last4?: string;
    brand?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateCheckoutSessionData {
  plan_id: string;
  billing_period: 'monthly' | 'yearly';
  success_url?: string;
  cancel_url?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  description: string;
  period_start: string;
  period_end: string;
  due_date?: string;
  paid_at?: string;
  invoice_pdf?: string;
  created_at: string;
}

class SubscriptionService {
  /**
   * Get available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data } = await api.get<SubscriptionPlan[]>('/subscriptions/plans');
    return data;
  }

  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<Subscription | null> {
    try {
      const { data } = await api.get<Subscription>('/subscriptions/current');
      return data;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(sessionData: CreateCheckoutSessionData): Promise<{
    checkout_url: string;
    session_id: string;
  }> {
    const { data } = await api.post('/subscriptions/checkout', sessionData);
    return data;
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(planId: string, billingPeriod: 'monthly' | 'yearly'): Promise<Subscription> {
    const { data } = await api.patch<Subscription>('/subscriptions/current', {
      plan_id: planId,
      billing_period: billingPeriod,
    });
    return data;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    const { data } = await api.post<Subscription>('/subscriptions/cancel', {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    return data;
  }

  /**
   * Resume canceled subscription
   */
  async resumeSubscription(): Promise<Subscription> {
    const { data } = await api.post<Subscription>('/subscriptions/resume');
    return data;
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data } = await api.get<PaymentMethod[]>('/subscriptions/payment-methods');
    return data;
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    const { data } = await api.post<PaymentMethod>('/subscriptions/payment-methods', {
      payment_method_id: paymentMethodId,
    });
    return data;
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await api.delete(`/subscriptions/payment-methods/${paymentMethodId}`);
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    await api.patch(`/subscriptions/payment-methods/${paymentMethodId}/default`);
  }

  /**
   * Get invoices
   */
  async getInvoices(limit?: number): Promise<Invoice[]> {
    const { data } = await api.get<Invoice[]>('/subscriptions/invoices', {
      params: { limit },
    });
    return data;
  }

  /**
   * Download invoice
   */
  async downloadInvoice(invoiceId: string): Promise<Blob> {
    const { data } = await api.get(`/subscriptions/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });
    return data;
  }

  /**
   * Get subscription usage
   */
  async getUsage(): Promise<{
    messages_used: number;
    messages_limit: number;
    tokens_used: number;
    tokens_limit: number;
    storage_used: number;
    storage_limit: number;
    reset_date: string;
  }> {
    const { data } = await api.get('/subscriptions/usage');
    return data;
  }

  /**
   * Apply promo code
   */
  async applyPromoCode(code: string): Promise<{
    discount: number;
    description: string;
    valid_until?: string;
  }> {
    const { data } = await api.post('/subscriptions/promo', { code });
    return data;
  }

  /**
   * Get Stripe customer portal URL
   */
  async getCustomerPortalUrl(): Promise<{ url: string }> {
    const { data } = await api.get('/subscriptions/portal');
    return data;
  }
}

export const subscriptionService = new SubscriptionService();
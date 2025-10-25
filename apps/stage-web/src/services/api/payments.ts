/**
 * Payment API Service
 *
 * Frontend utilities for Polar payment integration
 */

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin

export interface CheckoutRequest {
  tier: 'pro' | 'max'
  billingCycle?: 'monthly' | 'yearly'
}

export interface CheckoutResponse {
  checkoutUrl: string
  checkoutId: string
}

export interface SubscriptionResponse {
  subscription: {
    id: string
    userId: string
    polarCustomerId: string
    productId: string
    priceId: string
    status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing'
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    trialStart?: string
    trialEnd?: string
  } | null
  tier: 'free' | 'pro' | 'max'
  status?: string
  polarCustomerId?: string
  usage: {
    voiceMinutes: number
    voiceMinutesLimit: number
    voiceMinutesRemaining: number
  }
  limits: {
    voiceMinutes: number
    characters: number
    features: string[]
  }
}

export interface PortalResponse {
  portalUrl: string
}

export interface UsageRequest {
  eventType: 'voice_minutes' | 'character_creation' | 'message_sent'
  quantity: number
  metadata?: Record<string, any>
}

export interface UsageResponse {
  success: boolean
  usageEventId: string
}

/**
 * Create checkout session
 * Redirects user to Polar checkout
 */
export async function createCheckout(
  request: CheckoutRequest,
): Promise<CheckoutResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to create checkout: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating checkout:', error)
    throw error
  }
}

/**
 * Get customer portal URL
 * Redirects user to Polar customer portal
 */
export async function getCustomerPortal(): Promise<PortalResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/portal`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to get customer portal: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting customer portal:', error)
    throw error
  }
}

/**
 * Get subscription status
 */
export async function getSubscription(): Promise<SubscriptionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/subscription`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to get subscription: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting subscription:', error)
    throw error
  }
}

/**
 * Report usage event
 * Internal use only - called from voice session
 */
export async function trackUsage(request: UsageRequest): Promise<UsageResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Failed to track usage: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error tracking usage:', error)
    throw error
  }
}

/**
 * Helper: Redirect to checkout
 */
export async function redirectToCheckout(
  tier: 'pro' | 'max',
  billingCycle: 'monthly' | 'yearly' = 'monthly',
) {
  const checkout = await createCheckout({ tier, billingCycle })
  window.location.href = checkout.checkoutUrl
}

/**
 * Helper: Open customer portal in new tab
 */
export async function openCustomerPortal() {
  const portal = await getCustomerPortal()
  window.open(portal.portalUrl, '_blank')
}

/**
 * Helper: Check if user has active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    const subscription = await getSubscription()
    return subscription.subscription !== null &&
           ['active', 'trialing'].includes(subscription.subscription.status)
  } catch (error) {
    console.error('Failed to check subscription status:', error)
    return false
  }
}

/**
 * Helper: Get tier display info
 * @param tier - The subscription tier
 * @param billingCycle - The billing cycle (monthly or yearly)
 */
export function getTierDisplayInfo(
  tier: 'free' | 'pro' | 'max',
  billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
  const tierInfo = {
    free: {
      name: 'Free',
      color: 'gray',
      icon: '🆓',
      voiceMinutes: 20,
      characters: -1, // All preset characters
      price: '$0',
      priceMonthly: '$0/month',
      priceYearly: '$0/year',
      features: ['Basic features', 'Limited voice', 'All preset characters'],
    },
    pro: {
      name: 'Pro',
      color: 'purple',
      icon: '⭐',
      voiceMinutes: 500,
      characters: -1, // All preset characters + marketplace
      price: billingCycle === 'yearly' ? '$89/year' : '$9/month',
      priceMonthly: '$9/month',
      priceYearly: '$89/year',
      savings: '$19/year',
      features: ['Full features', 'Priority support', 'Preset characters', 'Marketplace access'],
    },
    max: {
      name: 'Max',
      color: 'gradient',
      icon: '🚀',
      voiceMinutes: -1, // Unlimited
      characters: -1, // Unlimited (preset + marketplace + custom)
      price: billingCycle === 'yearly' ? '$229/year' : '$24/month',
      priceMonthly: '$24/month',
      priceYearly: '$229/year',
      savings: '$59/year',
      features: ['Unlimited voice', 'Unlimited characters', 'Custom integration', 'Voice cloning', 'SLA'],
    },
  }

  return tierInfo[tier] || tierInfo.free
}

/**
 * Helper: Format voice minutes remaining
 */
export function formatVoiceMinutes(minutes: number): string {
  if (minutes === -1) {
    return 'Unlimited'
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }

  return `${mins}m`
}

/**
 * Helper: Get usage percentage
 */
export function getUsagePercentage(used: number, limit: number): number {
  if (limit === -1) {
    return 0 // Unlimited
  }

  if (limit === 0) {
    return 100 // No access
  }

  return Math.round((used / limit) * 100)
}

/**
 * Helper: Get usage color based on percentage
 */
export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'red'
  if (percentage >= 75) return 'orange'
  if (percentage >= 50) return 'yellow'
  return 'green'
}

/**
 * Payment API Service
 *
 * Frontend utilities for Polar payment integration
 */

import { api } from './index'

export interface CheckoutRequest {
  tier: 'pro' | 'enterprise'
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
  tier: 'free' | 'pro' | 'enterprise'
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
  const response = await api.post<CheckoutResponse>('/api/payments/checkout', request)
  return response
}

/**
 * Get customer portal URL
 * Redirects user to Polar customer portal
 */
export async function getCustomerPortal(): Promise<PortalResponse> {
  const response = await api.get<PortalResponse>('/api/payments/portal')
  return response
}

/**
 * Get subscription status
 */
export async function getSubscription(): Promise<SubscriptionResponse> {
  const response = await api.get<SubscriptionResponse>('/api/payments/subscription')
  return response
}

/**
 * Report usage event
 * Internal use only - called from voice session
 */
export async function trackUsage(request: UsageRequest): Promise<UsageResponse> {
  const response = await api.post<UsageResponse>('/api/payments/usage', request)
  return response
}

/**
 * Helper: Redirect to checkout
 */
export async function redirectToCheckout(
  tier: 'pro' | 'enterprise',
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
 */
export function getTierDisplayInfo(tier: 'free' | 'pro' | 'enterprise') {
  const tierInfo = {
    free: {
      name: 'Free',
      color: 'gray',
      icon: '🆓',
      voiceMinutes: 0,
      characters: 1,
      price: '$0',
    },
    pro: {
      name: 'Pro',
      color: 'purple',
      icon: '⭐',
      voiceMinutes: 500,
      characters: 10,
      price: '$19/mo',
    },
    enterprise: {
      name: 'Enterprise',
      color: 'gradient',
      icon: '🚀',
      voiceMinutes: -1, // Unlimited
      characters: -1, // Unlimited
      price: 'Custom',
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

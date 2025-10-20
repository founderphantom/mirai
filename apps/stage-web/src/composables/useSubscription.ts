/**
 * Composable for subscription management
 *
 * Provides reactive subscription state and actions
 */

import { ref, computed, onMounted } from 'vue'
import type { SubscriptionResponse } from '../services/api/payments'
import {
  getSubscription,
  redirectToCheckout,
  openCustomerPortal,
  getTierDisplayInfo,
  formatVoiceMinutes,
  getUsagePercentage,
  getUsageColor,
} from '../services/api/payments'

export function useSubscription() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const subscription = ref<SubscriptionResponse | null>(null)

  // Computed properties
  const tier = computed(() => subscription.value?.tier || 'free')
  const isActive = computed(() => {
    if (!subscription.value?.subscription) return false
    return ['active', 'trialing'].includes(subscription.value.subscription.status)
  })
  const isTrial = computed(() => {
    return subscription.value?.subscription?.status === 'trialing'
  })
  const isProOrHigher = computed(() => {
    return ['pro', 'enterprise'].includes(tier.value)
  })
  const hasVoiceAccess = computed(() => {
    const limits = subscription.value?.limits
    return limits ? limits.voiceMinutes !== 0 : false
  })

  const tierInfo = computed(() => getTierDisplayInfo(tier.value))

  const voiceMinutesUsed = computed(() => subscription.value?.usage.voiceMinutes || 0)
  const voiceMinutesLimit = computed(() => subscription.value?.usage.voiceMinutesLimit || 0)
  const voiceMinutesRemaining = computed(() => subscription.value?.usage.voiceMinutesRemaining || 0)

  const voiceUsagePercentage = computed(() =>
    getUsagePercentage(voiceMinutesUsed.value, voiceMinutesLimit.value),
  )
  const voiceUsageColor = computed(() => getUsageColor(voiceUsagePercentage.value))

  const formattedVoiceRemaining = computed(() =>
    formatVoiceMinutes(voiceMinutesRemaining.value),
  )

  // Actions
  async function fetchSubscription() {
    loading.value = true
    error.value = null

    try {
      subscription.value = await getSubscription()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load subscription'
      console.error('Failed to fetch subscription:', err)
    } finally {
      loading.value = false
    }
  }

  async function upgradeToTier(
    targetTier: 'pro' | 'max',
    billingCycle: 'monthly' | 'yearly' = 'monthly',
  ) {
    try {
      await redirectToCheckout(targetTier as 'pro' | 'max', billingCycle)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create checkout'
      console.error('Failed to create checkout:', err)
    }
  }

  async function manageSubscription() {
    try {
      await openCustomerPortal()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to open customer portal'
      console.error('Failed to open portal:', err)
    }
  }

  // Auto-fetch on mount
  onMounted(() => {
    fetchSubscription()
  })

  return {
    // State
    loading,
    error,
    subscription,

    // Computed
    tier,
    tierInfo,
    isActive,
    isTrial,
    isProOrHigher,
    hasVoiceAccess,

    // Voice usage
    voiceMinutesUsed,
    voiceMinutesLimit,
    voiceMinutesRemaining,
    voiceUsagePercentage,
    voiceUsageColor,
    formattedVoiceRemaining,

    // Actions
    fetchSubscription,
    upgradeToTier,
    manageSubscription,
  }
}

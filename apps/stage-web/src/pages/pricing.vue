<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { redirectToCheckout, getTierDisplayInfo, formatVoiceMinutes } from '../services/api/payments'
import { useSession } from '../lib/auth'
import PricingCard from '../components/pricing/PricingCard.vue'
import PricingComparisonTable from '../components/pricing/PricingComparisonTable.vue'

const router = useRouter()
const sessionData = useSession()
const session = computed(() => sessionData.value?.data)
const isPending = computed(() => sessionData.value?.isPending)

// Billing cycle toggle
const billingCycle = ref<'monthly' | 'yearly'>('monthly')

// Pricing data
const pricingTiers = computed(() => [
  {
    id: 'free' as const,
    name: 'Free',
    tagline: 'Get started with Mirai',
    icon: '🎭',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      { text: '20 voice minutes', included: true, highlight: true },
      { text: 'All preset characters', included: true },
      { text: 'Basic voice chat', included: true },
      { text: 'Community support', included: true },
      { text: 'Marketplace access', included: false },
      { text: 'Custom characters', included: false },
      { text: 'Voice cloning', included: false },
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    tagline: 'For creators and enthusiasts',
    icon: '⭐',
    price: {
      monthly: 9,
      yearly: 89,
    },
    features: [
      { text: '500 voice minutes/month', included: true, highlight: true },
      { text: 'All preset characters', included: true },
      { text: 'Marketplace character access', included: true, highlight: true },
      { text: 'Advanced character customization', included: true },
      { text: 'Priority support', included: true },
      { text: 'Early feature access', included: true },
      { text: 'Custom characters', included: false },
      { text: 'Voice cloning', included: false },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'max' as const,
    name: 'Max',
    tagline: 'For professionals and teams',
    icon: '🚀',
    price: {
      monthly: 24,
      yearly: 229,
    },
    features: [
      { text: 'Unlimited voice minutes', included: true, highlight: true },
      { text: 'Unlimited custom characters', included: true, highlight: true },
      { text: 'Voice cloning capabilities', included: true, highlight: true },
      { text: 'Custom integrations & API', included: true },
      { text: 'Dedicated support with SLA', included: true },
      { text: 'Priority feature requests', included: true },
      { text: 'Advanced analytics', included: true },
    ],
    cta: 'Upgrade to Max',
    popular: false,
  },
])

// Calculate savings
const savings = computed(() => ({
  pro: ((9 * 12) - 89),
  max: ((24 * 12) - 229),
}))

// Handle tier selection
const isLoading = ref(false)
async function selectTier(tier: 'free' | 'pro' | 'max') {
  if (tier === 'free') {
    // Free tier - redirect to sign up if not logged in, otherwise to dashboard
    if (session.value?.user) {
      router.push('/dashboard')
    } else {
      router.push('/auth/sign-up')
    }
    return
  }

  // Paid tiers - redirect to checkout
  if (!session.value?.user) {
    // Not logged in - redirect to sign up with pricing info
    router.push({
      path: '/auth/sign-up',
      query: { tier, billingCycle: billingCycle.value }
    })
    return
  }

  // Logged in - redirect to checkout
  try {
    isLoading.value = true
    await redirectToCheckout(tier, billingCycle.value)
  } catch (error) {
    console.error('Checkout error:', error)
    alert('Failed to start checkout. Please try again.')
  } finally {
    isLoading.value = false
  }
}

// FAQ Data
const faqs = [
  {
    question: 'Can I switch between monthly and yearly billing?',
    answer: 'Yes! You can switch your billing cycle anytime from the customer portal. When switching from monthly to yearly, you\'ll receive a prorated credit.'
  },
  {
    question: 'What happens when I run out of voice minutes?',
    answer: 'Once you reach your limit, voice sessions will be paused. You can upgrade to a higher tier or wait until your minutes reset at the start of your next billing cycle.'
  },
  {
    question: 'Do unused voice minutes roll over?',
    answer: 'Currently, voice minutes reset at the start of each billing cycle. We\'re exploring rollover options for future updates.'
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes! You can cancel anytime from the customer portal. You\'ll continue to have access until the end of your current billing period.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Polar.'
  },
  {
    question: 'Is there a free trial for paid tiers?',
    answer: 'All new users start with a free tier that includes 20 voice minutes to try Mirai. You can upgrade anytime to unlock more features.'
  },
]

const activeFaq = ref<number | null>(null)
function toggleFaq(index: number) {
  activeFaq.value = activeFaq.value === index ? null : index
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <!-- Hero Section -->
    <div class="container mx-auto px-4 py-16 text-center">
      <div class="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 mb-6">
        <span class="animate-pulse">✨</span>
        <span>Simple, transparent pricing</span>
      </div>

      <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-blue-400">
        Choose Your Plan
      </h1>

      <p class="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12">
        Start for free, upgrade when you're ready. All plans include access to our AI voice chat platform.
      </p>

      <!-- Billing Cycle Toggle -->
      <div class="flex items-center justify-center gap-4 mb-12">
        <span
          class="text-sm font-medium transition-colors"
          :class="billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
        >
          Monthly
        </span>

        <button
          type="button"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          :class="billingCycle === 'yearly' ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'"
          @click="billingCycle = billingCycle === 'monthly' ? 'yearly' : 'monthly'"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>

        <div class="flex items-center gap-2">
          <span
            class="text-sm font-medium transition-colors"
            :class="billingCycle === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
          >
            Yearly
          </span>
          <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Save up to $59
          </span>
        </div>
      </div>

      <!-- Pricing Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
        <PricingCard
          v-for="tier in pricingTiers"
          :key="tier.id"
          :tier="tier"
          :billing-cycle="billingCycle"
          :savings="tier.id === 'pro' ? savings.pro : tier.id === 'max' ? savings.max : 0"
          :is-loading="isLoading"
          @select="selectTier"
        />
      </div>

      <!-- Feature Comparison Table -->
      <div class="max-w-6xl mx-auto mb-20">
        <h2 class="text-3xl font-bold text-center mb-4">
          Compare Plans
        </h2>
        <p class="text-gray-600 dark:text-gray-400 text-center mb-12">
          See what's included in each tier
        </p>

        <PricingComparisonTable :billing-cycle="billingCycle" />
      </div>

      <!-- FAQ Section -->
      <div class="max-w-3xl mx-auto mb-20">
        <h2 class="text-3xl font-bold text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p class="text-gray-600 dark:text-gray-400 text-center mb-12">
          Everything you need to know about Mirai pricing
        </p>

        <div class="space-y-4">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              @click="toggleFaq(index)"
            >
              <span class="font-semibold text-gray-900 dark:text-white">
                {{ faq.question }}
              </span>
              <svg
                class="w-5 h-5 text-gray-500 transition-transform"
                :class="activeFaq === index ? 'rotate-180' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-show="activeFaq === index"
              class="px-6 pb-6 text-gray-600 dark:text-gray-400"
            >
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white text-center">
        <h2 class="text-3xl font-bold mb-4">
          Ready to get started?
        </h2>
        <p class="text-lg mb-8 opacity-90">
          Join thousands of users creating amazing AI voice experiences with Mirai
        </p>
        <div class="flex items-center justify-center gap-4">
          <button
            type="button"
            class="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            @click="router.push('/auth/sign-up')"
          >
            Start Free
          </button>
          <button
            type="button"
            class="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            @click="router.push('/dashboard')"
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom animations or transitions here */
</style>

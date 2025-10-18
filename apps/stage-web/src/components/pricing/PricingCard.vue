<script setup lang="ts">
import { computed } from 'vue'

interface PricingFeature {
  text: string
  included: boolean
  highlight?: boolean
}

interface PricingTier {
  id: 'free' | 'pro' | 'max'
  name: string
  tagline: string
  icon: string
  price: {
    monthly: number
    yearly: number
  }
  features: PricingFeature[]
  cta: string
  popular: boolean
}

const props = defineProps<{
  tier: PricingTier
  billingCycle: 'monthly' | 'yearly'
  savings: number
  isLoading: boolean
}>()

const emit = defineEmits<{
  select: [tier: 'free' | 'pro' | 'max']
}>()

const displayPrice = computed(() => {
  const price = props.billingCycle === 'yearly' ? props.tier.price.yearly : props.tier.price.monthly
  return price === 0 ? 'Free' : `$${price}`
})

const priceDescription = computed(() => {
  if (props.tier.price.monthly === 0) return 'Forever free'
  if (props.billingCycle === 'yearly') return 'per year'
  return 'per month'
})

const savingsText = computed(() => {
  if (props.savings <= 0 || props.billingCycle === 'monthly') return null
  return `Save $${props.savings}/year`
})
</script>

<template>
  <div
    class="relative flex flex-col rounded-2xl border-2 transition-all duration-300 hover:scale-105"
    :class="[
      tier.popular
        ? 'border-purple-500 shadow-2xl shadow-purple-500/20 dark:shadow-purple-500/30'
        : 'border-gray-200 dark:border-gray-700 shadow-lg hover:border-purple-300 dark:hover:border-purple-700',
      'bg-white dark:bg-gray-800'
    ]"
  >
    <!-- Popular Badge -->
    <div
      v-if="tier.popular"
      class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-1 text-sm font-semibold text-white"
    >
      ⭐ Most Popular
    </div>

    <div class="flex flex-col flex-1 p-8">
      <!-- Header -->
      <div class="mb-6 text-center">
        <div class="text-4xl mb-2">{{ tier.icon }}</div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {{ tier.name }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ tier.tagline }}
        </p>
      </div>

      <!-- Pricing -->
      <div class="mb-6 text-center">
        <div class="flex items-baseline justify-center gap-1">
          <span class="text-5xl font-bold text-gray-900 dark:text-white">
            {{ displayPrice }}
          </span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ priceDescription }}
        </p>
        <div v-if="savingsText" class="mt-2">
          <span class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {{ savingsText }}
          </span>
        </div>
      </div>

      <!-- CTA Button -->
      <button
        type="button"
        class="w-full mb-6 px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
          tier.popular
            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
            : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
        ]"
        :disabled="isLoading"
        @click="emit('select', tier.id)"
      >
        <span v-if="isLoading" class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
        <span v-else>{{ tier.cta }}</span>
      </button>

      <!-- Features List -->
      <div class="space-y-3 flex-1">
        <div
          v-for="(feature, index) in tier.features"
          :key="index"
          class="flex items-start gap-3"
        >
          <div
            class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
            :class="feature.included
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-gray-100 dark:bg-gray-700'
            "
          >
            <svg
              v-if="feature.included"
              class="w-3 h-3 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <svg
              v-else
              class="w-3 h-3 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <span
            class="text-sm"
            :class="[
              feature.included
                ? feature.highlight
                  ? 'text-gray-900 dark:text-white font-semibold'
                  : 'text-gray-700 dark:text-gray-300'
                : 'text-gray-400 dark:text-gray-500 line-through'
            ]"
          >
            {{ feature.text }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

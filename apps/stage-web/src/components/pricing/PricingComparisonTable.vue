<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  billingCycle: 'monthly' | 'yearly'
}>()

interface ComparisonFeature {
  category: string
  features: {
    name: string
    description?: string
    free: boolean | string
    pro: boolean | string
    max: boolean | string
  }[]
}

const comparisonData = computed<ComparisonFeature[]>(() => [
  {
    category: 'Voice Chat',
    features: [
      {
        name: 'Voice minutes',
        description: 'Monthly voice conversation time',
        free: '20 minutes',
        pro: '500 minutes',
        max: 'Unlimited',
      },
      {
        name: 'Voice quality',
        free: 'Standard',
        pro: 'High quality',
        max: 'Ultra HD',
      },
      {
        name: 'Voice cloning',
        description: 'Create custom voice models',
        free: false,
        pro: false,
        max: true,
      },
    ],
  },
  {
    category: 'Characters',
    features: [
      {
        name: 'Preset characters',
        description: 'Access to all built-in characters',
        free: true,
        pro: true,
        max: true,
      },
      {
        name: 'Marketplace access',
        description: 'Browse and use community characters',
        free: false,
        pro: true,
        max: true,
      },
      {
        name: 'Custom characters',
        description: 'Create your own AI characters',
        free: false,
        pro: 'Limited',
        max: 'Unlimited',
      },
      {
        name: 'Character customization',
        free: 'Basic',
        pro: 'Advanced',
        max: 'Full control',
      },
    ],
  },
  {
    category: 'Features',
    features: [
      {
        name: 'Message history',
        free: '7 days',
        pro: '90 days',
        max: 'Unlimited',
      },
      {
        name: 'Concurrent sessions',
        free: '1',
        pro: '3',
        max: 'Unlimited',
      },
      {
        name: 'API access',
        description: 'Programmatic access to Mirai',
        free: false,
        pro: false,
        max: true,
      },
      {
        name: 'Custom integrations',
        description: 'Webhook and third-party integrations',
        free: false,
        pro: false,
        max: true,
      },
      {
        name: 'Advanced analytics',
        free: false,
        pro: 'Basic',
        max: 'Full suite',
      },
    ],
  },
  {
    category: 'Support',
    features: [
      {
        name: 'Community support',
        free: true,
        pro: true,
        max: true,
      },
      {
        name: 'Priority support',
        description: 'Faster response times',
        free: false,
        pro: true,
        max: true,
      },
      {
        name: 'Dedicated support',
        description: 'Dedicated support team',
        free: false,
        pro: false,
        max: true,
      },
      {
        name: 'SLA guarantee',
        description: '99.9% uptime guarantee',
        free: false,
        pro: false,
        max: true,
      },
      {
        name: 'Feature requests',
        free: false,
        pro: 'Vote on features',
        max: 'Priority requests',
      },
    ],
  },
])

const tiers = [
  { id: 'free', name: 'Free', price: '$0', color: 'gray' },
  {
    id: 'pro',
    name: 'Pro',
    price: props.billingCycle === 'yearly' ? '$89/year' : '$9/month',
    color: 'purple'
  },
  {
    id: 'max',
    name: 'Max',
    price: props.billingCycle === 'yearly' ? '$229/year' : '$24/month',
    color: 'blue'
  },
]

function renderFeatureValue(value: boolean | string): { display: string; type: 'check' | 'cross' | 'text' } {
  if (value === true) {
    return { display: '✓', type: 'check' }
  }
  if (value === false) {
    return { display: '✗', type: 'cross' }
  }
  return { display: value, type: 'text' }
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
    <!-- Desktop Table View -->
    <table class="hidden md:table w-full">
      <thead>
        <tr class="border-b-2 border-gray-200 dark:border-gray-700">
          <th class="text-left p-6 text-gray-900 dark:text-white font-semibold w-1/4">
            Features
          </th>
          <th
            v-for="tier in tiers"
            :key="tier.id"
            class="text-center p-6"
          >
            <div class="flex flex-col items-center gap-2">
              <span class="text-xl font-bold text-gray-900 dark:text-white">
                {{ tier.name }}
              </span>
              <span
                class="text-sm font-semibold"
                :class="tier.id === 'pro' ? 'text-purple-600 dark:text-purple-400' : tier.id === 'max' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'"
              >
                {{ tier.price }}
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(category, categoryIndex) in comparisonData" :key="categoryIndex">
          <!-- Category Header Row -->
          <tr class="bg-gray-50 dark:bg-gray-900/50">
            <td colspan="4" class="p-4 font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
              {{ category.category }}
            </td>
          </tr>
          <!-- Feature Rows -->
          <tr
            v-for="(feature, featureIndex) in category.features"
            :key="featureIndex"
            class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
          >
            <td class="p-4">
              <div>
                <div class="font-medium text-gray-900 dark:text-white text-sm">
                  {{ feature.name }}
                </div>
                <div v-if="feature.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ feature.description }}
                </div>
              </div>
            </td>
            <td
              v-for="tier in tiers"
              :key="tier.id"
              class="p-4 text-center"
            >
              <span
                v-if="renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).type === 'check'"
                class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <span class="text-green-600 dark:text-green-400 font-bold">✓</span>
              </span>
              <span
                v-else-if="renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).type === 'cross'"
                class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700"
              >
                <span class="text-gray-400 dark:text-gray-500">✗</span>
              </span>
              <span
                v-else
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {{ renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).display }}
              </span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- Mobile Accordion View -->
    <div class="md:hidden">
      <div
        v-for="(category, categoryIndex) in comparisonData"
        :key="categoryIndex"
        class="border-b border-gray-200 dark:border-gray-700"
      >
        <!-- Category Header -->
        <div class="bg-gray-50 dark:bg-gray-900/50 p-4 font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
          {{ category.category }}
        </div>

        <!-- Features in Category -->
        <div
          v-for="(feature, featureIndex) in category.features"
          :key="featureIndex"
          class="p-4 border-b border-gray-100 dark:border-gray-700"
        >
          <div class="font-medium text-gray-900 dark:text-white text-sm mb-2">
            {{ feature.name }}
          </div>
          <div v-if="feature.description" class="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {{ feature.description }}
          </div>

          <!-- Tier Values -->
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="tier in tiers"
              :key="tier.id"
              class="text-center"
            >
              <div class="text-xs font-semibold mb-1"
                :class="tier.id === 'pro' ? 'text-purple-600 dark:text-purple-400' : tier.id === 'max' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'"
              >
                {{ tier.name }}
              </div>
              <div>
                <span
                  v-if="renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).type === 'check'"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30"
                >
                  <span class="text-green-600 dark:text-green-400 text-sm font-bold">✓</span>
                </span>
                <span
                  v-else-if="renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).type === 'cross'"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700"
                >
                  <span class="text-gray-400 dark:text-gray-500 text-sm">✗</span>
                </span>
                <span
                  v-else
                  class="text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ renderFeatureValue(feature[tier.id as keyof typeof feature] as boolean | string).display }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

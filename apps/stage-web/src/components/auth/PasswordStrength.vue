<template>
  <div v-if="password" class="space-y-2">
    <!-- Strength Bar -->
    <div class="flex items-center space-x-2">
      <div class="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div 
          class="h-full transition-all duration-300 ease-out rounded-full"
          :style="{ width: `${strength.score}%` }"
          :class="strengthBarClass"
        ></div>
      </div>
      <span 
        class="text-xs font-medium min-w-[60px] text-right"
        :class="strengthTextClass"
      >
        {{ strengthLabel }}
      </span>
    </div>
    
    <!-- Requirements List -->
    <div v-if="showRequirements" class="space-y-1">
      <div 
        v-for="requirement in requirements" 
        :key="requirement.text"
        class="flex items-center space-x-2 text-xs"
      >
        <svg 
          class="w-4 h-4 flex-shrink-0"
          :class="requirement.met ? 'text-success-500' : 'text-neutral-400'"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            v-if="requirement.met"
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
          <path 
            v-else
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span 
          :class="requirement.met 
            ? 'text-neutral-700 dark:text-neutral-300' 
            : 'text-neutral-500 dark:text-neutral-400'"
        >
          {{ requirement.text }}
        </span>
      </div>
    </div>
    
    <!-- Feedback Messages -->
    <div v-if="showFeedback && strength.feedback.length > 0" class="space-y-1">
      <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Suggestions to improve:
      </p>
      <ul class="space-y-1">
        <li 
          v-for="(tip, index) in strength.feedback.slice(0, 3)" 
          :key="index"
          class="text-xs text-neutral-500 dark:text-neutral-400 flex items-start space-x-1"
        >
          <span class="text-primary-500">•</span>
          <span>{{ tip }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { calculatePasswordStrength } from '@/lib/validation'

// Props
interface Props {
  password: string
  showRequirements?: boolean
  showFeedback?: boolean
  minScore?: number
}

const props = withDefaults(defineProps<Props>(), {
  showRequirements: true,
  showFeedback: true,
  minScore: 60,
})

// Emits
const emit = defineEmits<{
  'strength-change': [score: number, level: string]
  'valid-change': [isValid: boolean]
}>()

// Computed strength
const strength = computed(() => {
  if (!props.password) {
    return { score: 0, level: 'weak' as const, feedback: [] }
  }
  return calculatePasswordStrength(props.password)
})

// Requirements checklist
const requirements = computed(() => [
  {
    text: 'At least 8 characters',
    met: props.password.length >= 8
  },
  {
    text: 'Contains uppercase letter',
    met: /[A-Z]/.test(props.password)
  },
  {
    text: 'Contains lowercase letter',
    met: /[a-z]/.test(props.password)
  },
  {
    text: 'Contains number',
    met: /[0-9]/.test(props.password)
  },
  {
    text: 'Contains special character',
    met: /[^a-zA-Z0-9]/.test(props.password)
  }
])

// Strength label
const strengthLabel = computed(() => {
  switch (strength.value.level) {
    case 'weak': return 'Weak'
    case 'fair': return 'Fair'
    case 'good': return 'Good'
    case 'strong': return 'Strong'
    default: return ''
  }
})

// Strength bar color class
const strengthBarClass = computed(() => {
  switch (strength.value.level) {
    case 'weak': return 'bg-error-500'
    case 'fair': return 'bg-warning-500'
    case 'good': return 'bg-primary-500'
    case 'strong': return 'bg-success-500'
    default: return 'bg-neutral-300'
  }
})

// Strength text color class
const strengthTextClass = computed(() => {
  switch (strength.value.level) {
    case 'weak': return 'text-error-600 dark:text-error-400'
    case 'fair': return 'text-warning-600 dark:text-warning-400'
    case 'good': return 'text-primary-600 dark:text-primary-400'
    case 'strong': return 'text-success-600 dark:text-success-400'
    default: return 'text-neutral-500'
  }
})

// Is password valid
const isValid = computed(() => strength.value.score >= props.minScore)

// Watch for changes
watch(strength, (newStrength) => {
  emit('strength-change', newStrength.score, newStrength.level)
})

watch(isValid, (newIsValid) => {
  emit('valid-change', newIsValid)
})
</script>
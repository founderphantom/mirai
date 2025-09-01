<template>
  <div class="space-y-1">
    <!-- Label -->
    <label 
      v-if="label"
      :for="inputId"
      class="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
    >
      {{ label }}
      <span v-if="required" class="text-error-500 ml-1" aria-label="required">*</span>
    </label>
    
    <!-- Input Container -->
    <div class="relative">
      <input
        :id="inputId"
        ref="inputRef"
        v-model="modelValue"
        :type="computedType"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        class="w-full px-4 py-2.5 border rounded-lg transition-all duration-200
               text-neutral-900 dark:text-white 
               placeholder-neutral-400 dark:placeholder-neutral-500
               bg-white dark:bg-neutral-800
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
               disabled:opacity-50 disabled:cursor-not-allowed"
        :class="inputClasses"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
      />
      
      <!-- Password Toggle Button -->
      <button
        v-if="showPasswordToggle && type === 'password'"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 
               text-neutral-400 hover:text-neutral-600 
               dark:text-neutral-500 dark:hover:text-neutral-300
               transition-colors"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
        @click="togglePassword"
      >
        <svg v-if="showPassword" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      
      <!-- Validation Icon -->
      <div 
        v-if="showValidation && !showPasswordToggle && modelValue"
        class="absolute right-3 top-1/2 -translate-y-1/2"
      >
        <svg v-if="isValid" class="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      
      <!-- Loading Spinner -->
      <div 
        v-if="loading"
        class="absolute right-3 top-1/2 -translate-y-1/2"
      >
        <svg class="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
    
    <!-- Helper Text -->
    <p 
      v-if="helperText && !error"
      class="text-sm text-neutral-500 dark:text-neutral-400 mt-1"
    >
      {{ helperText }}
    </p>
    
    <!-- Error Message -->
    <p 
      v-if="error"
      :id="`${inputId}-error`"
      class="text-sm text-error-600 dark:text-error-400 mt-1"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'

// Props
interface Props {
  modelValue?: string
  label?: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
  placeholder?: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  autocomplete?: string
  showPasswordToggle?: boolean
  showValidation?: boolean
  isValid?: boolean
  focusOnMount?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  modelValue: '',
  required: false,
  disabled: false,
  loading: false,
  showPasswordToggle: false,
  showValidation: false,
  isValid: false,
  focusOnMount: false,
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'focus': []
  'blur': []
  'input': [value: string]
}>()

// State
const inputRef = ref<HTMLInputElement>()
const inputId = ref(`auth-input-${nanoid(6)}`)
const isFocused = ref(false)
const showPassword = ref(false)

// Model value
const modelValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Computed type (for password visibility toggle)
const computedType = computed(() => {
  if (props.type === 'password' && showPassword.value) {
    return 'text'
  }
  return props.type
})

// Input classes
const inputClasses = computed(() => {
  const classes = []
  
  // Border color based on state
  if (props.error) {
    classes.push('border-error-500 dark:border-error-400')
  } else if (isFocused.value) {
    classes.push('border-primary-500 dark:border-primary-400')
  } else {
    classes.push('border-neutral-300 dark:border-neutral-600')
  }
  
  // Padding adjustment for icons
  if (props.showPasswordToggle || props.showValidation || props.loading) {
    classes.push('pr-12')
  }
  
  return classes.join(' ')
})

// Methods
const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('input', target.value)
}

// Focus on mount
watch(() => props.focusOnMount, (value) => {
  if (value && inputRef.value) {
    inputRef.value.focus()
  }
}, { immediate: true })

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>
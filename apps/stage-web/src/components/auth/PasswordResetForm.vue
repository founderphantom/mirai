<template>
  <div class="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-8 transition-colors">
    <!-- Header -->
    <div class="mb-8">
      <button
        type="button"
        @click="$router.push('/auth/login')"
        class="mb-4 flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 
               hover:text-neutral-900 dark:hover:text-white transition-colors"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span class="text-sm">Back to login</span>
      </button>
      
      <h1 class="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
        Reset your password
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        Enter your email address and we'll send you a link to reset your password.
      </p>
    </div>
    
    <!-- Success Message -->
    <Transition name="slide-fade">
      <div 
        v-if="successMessage"
        class="mb-6 p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg"
      >
        <div class="flex items-start space-x-3">
          <svg class="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-success-800 dark:text-success-200">
              Password reset email sent!
            </p>
            <p class="text-sm text-success-700 dark:text-success-300 mt-1">
              Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
            </p>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Error Alert -->
    <Transition name="slide-fade">
      <div 
        v-if="error"
        class="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg"
      >
        <div class="flex items-start space-x-3">
          <svg class="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm text-error-800 dark:text-error-200">{{ error }}</p>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Reset Form -->
    <form v-if="!successMessage" @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Email Input -->
      <AuthInput
        v-model="formData.email"
        label="Email address"
        type="email"
        placeholder="you@example.com"
        :error="errors.email"
        autocomplete="email"
        :disabled="isLoading"
        :show-validation="true"
        :is-valid="!errors.email && formData.email.length > 0"
        required
        focus-on-mount
        @blur="validateEmail"
      />
      
      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="isLoading || !isFormValid"
        class="w-full h-12 px-4 py-2 bg-primary-600 hover:bg-primary-700 
               text-white font-medium rounded-lg transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
               dark:focus:ring-offset-neutral-800"
      >
        <span v-if="!isLoading" class="flex items-center justify-center">
          Send Reset Email
        </span>
        <span v-else class="flex items-center justify-center space-x-2">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Sending...</span>
        </span>
      </button>
    </form>
    
    <!-- Additional Options -->
    <div v-if="successMessage" class="space-y-4">
      <button
        @click="handleResend"
        :disabled="isLoading || resendCooldown > 0"
        class="w-full h-12 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 
               hover:bg-neutral-200 dark:hover:bg-neutral-600
               text-neutral-700 dark:text-neutral-300 font-medium rounded-lg 
               transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
               dark:focus:ring-offset-neutral-800"
      >
        <span v-if="resendCooldown > 0">
          Resend available in {{ resendCooldown }}s
        </span>
        <span v-else>
          Resend Email
        </span>
      </button>
      
      <button
        @click="resetForm"
        class="w-full h-12 px-4 py-2 border border-neutral-300 dark:border-neutral-600
               hover:bg-neutral-50 dark:hover:bg-neutral-700
               text-neutral-700 dark:text-neutral-300 font-medium rounded-lg 
               transition-all duration-200
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
               dark:focus:ring-offset-neutral-800"
      >
        Try Different Email
      </button>
    </div>
    
    <!-- Help Text -->
    <div class="mt-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
      <p class="text-sm text-neutral-600 dark:text-neutral-400">
        <strong>Need help?</strong> If you're having trouble resetting your password, 
        <a href="/support" class="text-primary-600 dark:text-primary-400 hover:underline">
          contact our support team
        </a>.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { isValidEmail } from '@/lib/validation'
import AuthInput from './AuthInput.vue'
import { toast } from 'vue-sonner'

// Composables
const { resetPassword } = useAuth()

// Form state
const formData = reactive({
  email: '',
})

const errors = reactive({
  email: '',
})

const isLoading = ref(false)
const error = ref('')
const successMessage = ref('')
const resendCooldown = ref(0)
let cooldownInterval: NodeJS.Timeout | null = null

// Form validation
const isFormValid = computed(() => {
  return formData.email && !errors.email
})

// Validation methods
const validateEmail = () => {
  errors.email = ''
  if (!formData.email) {
    errors.email = 'Email is required'
  } else if (!isValidEmail(formData.email)) {
    errors.email = 'Please enter a valid email address'
  }
}

// Start cooldown timer
const startCooldown = () => {
  resendCooldown.value = 60 // 60 seconds cooldown
  cooldownInterval = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && cooldownInterval) {
      clearInterval(cooldownInterval)
      cooldownInterval = null
    }
  }, 1000)
}

// Form submission
const handleSubmit = async () => {
  // Clear previous messages
  error.value = ''
  successMessage.value = ''
  
  // Validate email
  validateEmail()
  
  if (!isFormValid.value) return
  
  isLoading.value = true
  
  try {
    const { error: resetError } = await resetPassword(formData.email)
    
    if (resetError) {
      // Handle specific error cases
      if (resetError.includes('User not found')) {
        error.value = 'No account found with this email address.'
      } else if (resetError.includes('rate limit')) {
        error.value = 'Too many reset attempts. Please try again later.'
      } else {
        error.value = resetError
      }
      return
    }
    
    // Success
    successMessage.value = 'Password reset email sent!'
    toast.success('Check your email for the reset link')
    startCooldown()
    
  } catch (err) {
    console.error('Password reset error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Resend email
const handleResend = async () => {
  if (resendCooldown.value > 0) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const { error: resetError } = await resetPassword(formData.email)
    
    if (resetError) {
      error.value = 'Failed to resend email. Please try again.'
      return
    }
    
    toast.success('Reset email resent successfully')
    startCooldown()
    
  } catch (err) {
    console.error('Resend error:', err)
    error.value = 'Failed to resend email. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Reset form
const resetForm = () => {
  formData.email = ''
  errors.email = ''
  error.value = ''
  successMessage.value = ''
  resendCooldown.value = 0
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
    cooldownInterval = null
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
  }
})
</script>

<style scoped>
/* Slide fade transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
</style>
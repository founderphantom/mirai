<template>
  <div class="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-8 transition-colors">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
        Create your account
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        Join AIRI to start your AI companion journey
      </p>
    </div>
    
    <!-- OAuth Buttons -->
    <OAuthButtons 
      @auth-error="handleOAuthError"
    />
    
    <!-- Divider -->
    <div class="relative my-6">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-neutral-200 dark:border-neutral-700"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="px-4 bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
          or sign up with email
        </span>
      </div>
    </div>
    
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
              {{ successMessage }}
            </p>
            <p class="text-sm text-success-700 dark:text-success-300 mt-1">
              Please check your email to verify your account.
            </p>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Signup Form -->
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
      
      <!-- Password Input -->
      <div>
        <AuthInput
          v-model="formData.password"
          label="Password"
          type="password"
          placeholder="Create a strong password"
          :error="errors.password"
          autocomplete="new-password"
          :disabled="isLoading"
          :show-password-toggle="true"
          required
          @blur="validatePassword"
          @input="handlePasswordInput"
        />
        
        <!-- Password Strength Meter -->
        <div class="mt-2">
          <PasswordStrength
            :password="formData.password"
            :show-requirements="true"
            :show-feedback="formData.password.length > 0"
            @valid-change="passwordValid = $event"
          />
        </div>
      </div>
      
      <!-- Confirm Password Input -->
      <AuthInput
        v-model="formData.confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Re-enter your password"
        :error="errors.confirmPassword"
        autocomplete="new-password"
        :disabled="isLoading"
        :show-password-toggle="true"
        required
        @blur="validateConfirmPassword"
      />
      
      <!-- Terms and Conditions -->
      <div class="space-y-2">
        <label class="flex items-start space-x-2 cursor-pointer">
          <input
            v-model="formData.agreeToTerms"
            type="checkbox"
            class="w-4 h-4 mt-0.5 text-primary-600 border-neutral-300 rounded 
                   focus:ring-primary-500 dark:border-neutral-600 
                   dark:bg-neutral-700 dark:focus:ring-primary-400"
            @change="validateTerms"
          />
          <span class="text-sm text-neutral-600 dark:text-neutral-400">
            I agree to the 
            <a 
              href="/terms" 
              target="_blank"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Terms of Service
            </a>
            and 
            <a 
              href="/privacy" 
              target="_blank"
              class="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Privacy Policy
            </a>
          </span>
        </label>
        <p v-if="errors.agreeToTerms" class="text-sm text-error-600 dark:text-error-400">
          {{ errors.agreeToTerms }}
        </p>
      </div>
      
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
          Create Account
        </span>
        <span v-else class="flex items-center justify-center space-x-2">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Creating account...</span>
        </span>
      </button>
    </form>
    
    <!-- Sign In Link -->
    <p class="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
      Already have an account?
      <RouterLink
        to="/auth/login"
        class="text-primary-600 dark:text-primary-400 
               hover:text-primary-700 dark:hover:text-primary-300 
               font-medium hover:underline transition-colors"
      >
        Sign in
      </RouterLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { isValidEmail, isValidPassword } from '@/lib/validation'
import AuthInput from './AuthInput.vue'
import OAuthButtons from './OAuthButtons.vue'
import PasswordStrength from './PasswordStrength.vue'
import { toast } from 'vue-sonner'

// Composables
const router = useRouter()
const { signUpWithEmail } = useAuth()

// Form state
const formData = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
})

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: '',
})

const isLoading = ref(false)
const error = ref('')
const successMessage = ref('')
const passwordValid = ref(false)

// Form validation
const isFormValid = computed(() => {
  return (
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    formData.agreeToTerms &&
    passwordValid.value &&
    !errors.email &&
    !errors.password &&
    !errors.confirmPassword &&
    !errors.agreeToTerms
  )
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

const validatePassword = () => {
  errors.password = ''
  if (!formData.password) {
    errors.password = 'Password is required'
  } else if (!isValidPassword(formData.password)) {
    errors.password = 'Password does not meet requirements'
  }
  
  // Also validate confirm password if it has a value
  if (formData.confirmPassword) {
    validateConfirmPassword()
  }
}

const validateConfirmPassword = () => {
  errors.confirmPassword = ''
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }
}

const validateTerms = () => {
  errors.agreeToTerms = ''
  if (!formData.agreeToTerms) {
    errors.agreeToTerms = 'You must agree to the terms and conditions'
  }
}

// Handle password input for real-time validation
const handlePasswordInput = () => {
  // Clear error if password is being typed
  if (errors.password) {
    errors.password = ''
  }
}

// Handle OAuth errors
const handleOAuthError = (provider: string, errorMessage: string) => {
  error.value = errorMessage
  // Clear error after 5 seconds
  setTimeout(() => {
    error.value = ''
  }, 5000)
}

// Form submission
const handleSubmit = async () => {
  // Clear previous messages
  error.value = ''
  successMessage.value = ''
  
  // Validate all fields
  validateEmail()
  validatePassword()
  validateConfirmPassword()
  validateTerms()
  
  if (!isFormValid.value) return
  
  isLoading.value = true
  
  try {
    const { data, error: authError } = await signUpWithEmail(
      formData.email,
      formData.password
    )
    
    if (authError) {
      // Handle specific error cases
      if (authError.includes('already registered')) {
        error.value = 'This email is already registered. Please sign in instead.'
      } else if (authError.includes('rate limit')) {
        error.value = 'Too many signup attempts. Please try again later.'
      } else if (authError.includes('invalid email')) {
        error.value = 'Please enter a valid email address.'
      } else {
        error.value = authError
      }
      return
    }
    
    // Success
    successMessage.value = 'Account created successfully!'
    toast.success('Welcome to AIRI! Please check your email to verify your account.')
    
    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push({
        path: '/auth/login',
        query: { registered: 'true' }
      })
    }, 3000)
    
  } catch (err) {
    console.error('Signup error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}
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
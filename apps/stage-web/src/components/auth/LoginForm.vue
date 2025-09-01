<template>
  <div class="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-8 transition-colors">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
        Welcome back
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        Sign in to continue to AIRI
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
          or continue with email
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
            <p class="text-sm text-success-800 dark:text-success-200">{{ successMessage }}</p>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Login Form -->
    <form @submit.prevent="handleSubmit" class="space-y-5">
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
      <AuthInput
        v-model="formData.password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        :error="errors.password"
        autocomplete="current-password"
        :disabled="isLoading"
        :show-password-toggle="true"
        required
        @blur="validatePassword"
      />
      
      <!-- Remember Me & Forgot Password -->
      <div class="flex items-center justify-between">
        <label class="flex items-center space-x-2 cursor-pointer">
          <input
            v-model="formData.rememberMe"
            type="checkbox"
            class="w-4 h-4 text-primary-600 border-neutral-300 rounded 
                   focus:ring-primary-500 dark:border-neutral-600 
                   dark:bg-neutral-700 dark:focus:ring-primary-400"
          />
          <span class="text-sm text-neutral-600 dark:text-neutral-400">
            Remember me
          </span>
        </label>
        
        <RouterLink
          to="/auth/reset"
          class="text-sm text-primary-600 dark:text-primary-400 
                 hover:text-primary-700 dark:hover:text-primary-300 
                 hover:underline transition-colors"
        >
          Forgot password?
        </RouterLink>
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
          Sign In
        </span>
        <span v-else class="flex items-center justify-center space-x-2">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Signing in...</span>
        </span>
      </button>
    </form>
    
    <!-- Sign Up Link -->
    <p class="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
      Don't have an account?
      <RouterLink
        to="/auth/signup"
        class="text-primary-600 dark:text-primary-400 
               hover:text-primary-700 dark:hover:text-primary-300 
               font-medium hover:underline transition-colors"
      >
        Sign up
      </RouterLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { loginSchema, isValidEmail } from '@/lib/validation'
import AuthInput from './AuthInput.vue'
import OAuthButtons from './OAuthButtons.vue'
import { toast } from 'vue-sonner'

// Composables
const router = useRouter()
const route = useRoute()
const { signInWithEmail } = useAuth()

// Form state
const formData = reactive({
  email: '',
  password: '',
  rememberMe: false,
})

const errors = reactive({
  email: '',
  password: '',
})

const isLoading = ref(false)
const error = ref('')
const successMessage = ref('')

// Check for redirect query parameter
const redirectTo = computed(() => {
  const redirect = route.query.redirect as string
  return redirect || '/dashboard'
})

// Form validation
const isFormValid = computed(() => {
  return formData.email && formData.password && !errors.email && !errors.password
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
  } else if (formData.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
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
  
  if (!isFormValid.value) return
  
  isLoading.value = true
  
  try {
    const { data, error: authError } = await signInWithEmail(
      formData.email,
      formData.password,
      formData.rememberMe
    )
    
    if (authError) {
      // Handle specific error cases
      if (authError.includes('Invalid login credentials')) {
        error.value = 'Invalid email or password. Please try again.'
      } else if (authError.includes('Email not confirmed')) {
        error.value = 'Please verify your email address before signing in.'
      } else if (authError.includes('rate limit')) {
        error.value = 'Too many login attempts. Please try again later.'
      } else {
        error.value = authError
      }
      return
    }
    
    // Success
    successMessage.value = 'Sign in successful! Redirecting...'
    toast.success('Welcome back!')
    
    // Redirect after a short delay
    setTimeout(() => {
      router.push(redirectTo.value)
    }, 1000)
    
  } catch (err) {
    console.error('Login error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Check for success message from signup
onMounted(() => {
  if (route.query.verified === 'true') {
    successMessage.value = 'Email verified successfully! You can now sign in.'
  } else if (route.query.registered === 'true') {
    successMessage.value = 'Registration successful! Please check your email to verify your account.'
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
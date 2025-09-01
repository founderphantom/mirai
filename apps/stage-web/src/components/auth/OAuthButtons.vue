<template>
  <div class="space-y-3">
    <!-- Google OAuth Button -->
    <button
      type="button"
      class="w-full h-12 px-4 py-2 border border-neutral-300 dark:border-neutral-600 
             rounded-lg flex items-center justify-center space-x-2
             bg-white dark:bg-neutral-800 
             hover:bg-neutral-50 dark:hover:bg-neutral-700
             transition-all duration-200 group relative overflow-hidden
             disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="loadingProvider !== null"
      @click="handleOAuthLogin('google')"
    >
      <!-- Loading State -->
      <div v-if="loadingProvider === 'google'" class="flex items-center space-x-2">
        <svg class="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-neutral-700 dark:text-neutral-300 font-medium">Connecting...</span>
      </div>
      
      <!-- Default State -->
      <div v-else class="flex items-center space-x-2">
        <!-- Google Icon -->
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span class="text-neutral-700 dark:text-neutral-300 font-medium">Continue with Google</span>
      </div>
      
      <!-- Hover Effect -->
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                  -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
    </button>
    
    <!-- Discord OAuth Button -->
    <button
      type="button"
      class="w-full h-12 px-4 py-2 border border-neutral-300 dark:border-neutral-600 
             rounded-lg flex items-center justify-center space-x-2
             bg-white dark:bg-neutral-800 
             hover:bg-neutral-50 dark:hover:bg-neutral-700
             transition-all duration-200 group relative overflow-hidden
             disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="loadingProvider !== null"
      @click="handleOAuthLogin('discord')"
    >
      <!-- Loading State -->
      <div v-if="loadingProvider === 'discord'" class="flex items-center space-x-2">
        <svg class="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-neutral-700 dark:text-neutral-300 font-medium">Connecting...</span>
      </div>
      
      <!-- Default State -->
      <div v-else class="flex items-center space-x-2">
        <!-- Discord Icon -->
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        <span class="text-neutral-700 dark:text-neutral-300 font-medium">Continue with Discord</span>
      </div>
      
      <!-- Hover Effect -->
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                  -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

type Provider = 'google' | 'discord'

// Props
interface Props {
  redirectTo?: string
}

const props = withDefaults(defineProps<Props>(), {
  redirectTo: '/dashboard'
})

// Emits
const emit = defineEmits<{
  'auth-start': [provider: Provider]
  'auth-success': [provider: Provider]
  'auth-error': [provider: Provider, error: string]
}>()

// Composables
const { signInWithOAuth } = useAuth()
const router = useRouter()

// State
const loadingProvider = ref<Provider | null>(null)

// Methods
const handleOAuthLogin = async (provider: Provider) => {
  loadingProvider.value = provider
  emit('auth-start', provider)
  
  try {
    const { error } = await signInWithOAuth(provider)
    
    if (error) {
      // Handle specific OAuth errors
      let errorMessage = 'Authentication failed. Please try again.'
      
      if (error.includes('User cancelled')) {
        errorMessage = 'Authentication cancelled'
      } else if (error.includes('Invalid credentials')) {
        errorMessage = 'Invalid credentials. Please check your account.'
      } else if (error.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please try again later.'
      }
      
      toast.error(errorMessage)
      emit('auth-error', provider, errorMessage)
      loadingProvider.value = null
      return
    }
    
    // Success - the redirect will be handled by Supabase OAuth flow
    emit('auth-success', provider)
    toast.success(`Signing in with ${provider}...`)
    
  } catch (err) {
    console.error(`OAuth error with ${provider}:`, err)
    const errorMessage = 'An unexpected error occurred. Please try again.'
    toast.error(errorMessage)
    emit('auth-error', provider, errorMessage)
    loadingProvider.value = null
  }
}
</script>
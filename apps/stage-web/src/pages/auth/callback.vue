<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
    <div class="text-center">
      <!-- Loading Spinner -->
      <div class="mb-8">
        <svg class="animate-spin h-12 w-12 mx-auto text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <!-- Status Message -->
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
        {{ statusMessage }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        {{ subMessage }}
      </p>
      
      <!-- Error Message -->
      <div v-if="error" class="mt-6 max-w-md mx-auto">
        <div class="p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <p class="text-sm text-error-800 dark:text-error-200">{{ error }}</p>
        </div>
        
        <RouterLink
          to="/auth/login"
          class="inline-block mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 
                 text-white font-medium rounded-lg transition-colors"
        >
          Back to Login
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()

// State
const statusMessage = ref('Completing authentication...')
const subMessage = ref('Please wait while we sign you in.')
const error = ref('')

onMounted(async () => {
  try {
    // Get the error from URL if present
    const urlError = route.query.error as string
    const errorDescription = route.query.error_description as string
    
    if (urlError) {
      console.error('OAuth error:', urlError, errorDescription)
      
      // Handle specific OAuth errors
      if (urlError === 'access_denied') {
        error.value = 'Authentication was cancelled. Please try again.'
      } else if (errorDescription) {
        error.value = errorDescription
      } else {
        error.value = 'Authentication failed. Please try again.'
      }
      
      statusMessage.value = 'Authentication Failed'
      subMessage.value = ''
      return
    }
    
    // Check for session from OAuth callback
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      error.value = 'Failed to complete authentication. Please try again.'
      statusMessage.value = 'Authentication Failed'
      subMessage.value = ''
      return
    }
    
    if (!session) {
      // Try to exchange code for session (for OAuth flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      
      if (!accessToken) {
        error.value = 'No authentication session found. Please try again.'
        statusMessage.value = 'Authentication Failed'
        subMessage.value = ''
        return
      }
    }
    
    // Success - redirect to home or intended destination
    statusMessage.value = 'Authentication successful!'
    subMessage.value = 'Redirecting...'
    
    toast.success('Welcome to AIRI!')
    
    // Get redirect URL from query or default to home
    const redirectTo = route.query.redirect as string || '/'
    
    setTimeout(() => {
      router.push(redirectTo)
    }, 1000)
    
  } catch (err) {
    console.error('Callback error:', err)
    error.value = 'An unexpected error occurred during authentication.'
    statusMessage.value = 'Authentication Failed'
    subMessage.value = ''
  }
})
</script>

<route lang="yaml">
meta:
  layout: false
  requiresAuth: false
  title: Authenticating - AIRI
</route>
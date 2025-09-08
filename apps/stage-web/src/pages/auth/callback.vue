<template>
  <AuthLayout>
    <div class="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-8 text-center">
      <div v-if="loading" class="space-y-4">
        <div class="flex justify-center">
          <svg class="animate-spin h-10 w-10 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-neutral-900 dark:text-white">
          Completing sign in...
        </h2>
        <p class="text-neutral-600 dark:text-neutral-400">
          Please wait while we verify your authentication.
        </p>
      </div>
      
      <div v-else-if="error" class="space-y-4">
        <div class="flex justify-center">
          <div class="w-12 h-12 rounded-full bg-error-100 dark:bg-error-900/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-error-600 dark:text-error-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h2 class="text-xl font-semibold text-neutral-900 dark:text-white">
          Authentication Failed
        </h2>
        <p class="text-neutral-600 dark:text-neutral-400">
          {{ error }}
        </p>
        <div class="mt-6">
          <RouterLink 
            to="/auth/login"
            class="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 
                   text-white font-medium rounded-lg transition-colors"
          >
            Back to Sign In
          </RouterLink>
        </div>
      </div>
      
      <div v-else class="space-y-4">
        <div class="flex justify-center">
          <div class="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center">
            <svg class="w-6 h-6 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 class="text-xl font-semibold text-neutral-900 dark:text-white">
          Sign in successful!
        </h2>
        <p class="text-neutral-600 dark:text-neutral-400">
          Redirecting you to the application...
        </p>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    // Get the hash from the URL (contains the auth code)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const errorParam = hashParams.get('error')
    const errorDescription = hashParams.get('error_description')
    
    // Check for errors first
    if (errorParam) {
      error.value = errorDescription || getAuthErrorMessage(errorParam)
      loading.value = false
      return
    }
    
    // Exchange the code for a session
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(
      route.query.code as string
    )
    
    if (authError) {
      error.value = getAuthErrorMessage(authError)
      loading.value = false
      return
    }
    
    if (!data.session) {
      error.value = 'Failed to establish session. Please try again.'
      loading.value = false
      return
    }
    
    // Success - auth state will be handled by onAuthStateChange
    toast.success('Welcome back!')
    loading.value = false
    
    // Redirect to the intended destination or home
    const redirectTo = route.query.redirect as string || '/'
    setTimeout(() => {
      router.push(redirectTo)
    }, 1000)
    
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Auth] Callback error:', err)
    }
    error.value = 'An unexpected error occurred during authentication.'
    loading.value = false
  }
})
</script>

<route lang="yaml">
meta:
  layout: false
  requiresAuth: false
  title: Completing Sign In - AIRI
</route>
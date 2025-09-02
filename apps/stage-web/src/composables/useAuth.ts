import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, authHelpers } from '@/lib/supabase'

// Global auth state
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const initialized = ref(false)

// Initialize auth state
async function initializeAuth() {
  if (initialized.value) return
  
  try {
    // Get initial session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    session.value = currentSession
    user.value = currentSession?.user ?? null
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      
      // Handle sign out event - redirect to login
      if (event === 'SIGNED_OUT' && window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login'
      }
    })
    
    initialized.value = true
  } catch (error) {
    console.error('Failed to initialize auth:', error)
  } finally {
    loading.value = false
  }
}

export function useAuth() {
  const router = useRouter()
  
  // Computed properties
  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email ?? '')
  const userName = computed(() => user.value?.user_metadata?.full_name ?? userEmail.value)
  const userAvatar = computed(() => user.value?.user_metadata?.avatar_url ?? null)
  
  // Auth methods
  const signInWithEmail = async (email: string, password: string, rememberMe = false) => {
    loading.value = true
    try {
      const data = await authHelpers.signInWithEmail(email, password)
      
      // Handle remember me by setting session expiry
      if (!rememberMe && data.session) {
        // Set session to expire in 24 hours if not remembering
        await supabase.auth.updateUser({
          data: { session_duration: 86400 }
        })
      }
      
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to sign in' }
    } finally {
      loading.value = false
    }
  }
  
  const signUpWithEmail = async (email: string, password: string) => {
    loading.value = true
    try {
      const data = await authHelpers.signUpWithEmail(email, password)
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to sign up' }
    } finally {
      loading.value = false
    }
  }
  
  const signInWithOAuth = async (provider: 'google' | 'discord') => {
    loading.value = true
    try {
      const data = await authHelpers.signInWithOAuth(provider)
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to sign in with ' + provider }
    } finally {
      loading.value = false
    }
  }
  
  const signOut = async () => {
    loading.value = true
    try {
      await authHelpers.signOut()
      await router.push('/auth/login')
      return { error: null }
    } catch (error: any) {
      return { error: error.message || 'Failed to sign out' }
    } finally {
      loading.value = false
    }
  }
  
  const resetPassword = async (email: string) => {
    loading.value = true
    try {
      const data = await authHelpers.resetPassword(email)
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to send reset email' }
    } finally {
      loading.value = false
    }
  }
  
  const updatePassword = async (newPassword: string) => {
    loading.value = true
    try {
      const data = await authHelpers.updatePassword(newPassword)
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to update password' }
    } finally {
      loading.value = false
    }
  }
  
  // Initialize on first use
  if (!initialized.value) {
    initializeAuth()
  }
  
  return {
    // State
    user: computed(() => user.value),
    session: computed(() => session.value),
    loading: computed(() => loading.value),
    isAuthenticated,
    userEmail,
    userName,
    userAvatar,
    
    // Methods
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    initializeAuth,
  }
}

// Route guard composable
export function useAuthGuard() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()
  
  const requireAuth = async (redirectTo = '/auth/login') => {
    // Wait for auth to initialize
    while (loading.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    if (!isAuthenticated.value) {
      await router.push({
        path: redirectTo,
        query: { redirect: router.currentRoute.value.fullPath }
      })
      return false
    }
    
    return true
  }
  
  const requireGuest = async (redirectTo = '/dashboard') => {
    // Wait for auth to initialize
    while (loading.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    if (isAuthenticated.value) {
      await router.push(redirectTo)
      return false
    }
    
    return true
  }
  
  return {
    requireAuth,
    requireGuest,
  }
}
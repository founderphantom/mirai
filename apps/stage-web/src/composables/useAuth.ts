import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, authHelpers } from '@/lib/supabase'
import { userAPI, type UserProfile } from '@/lib/api'

// Global auth state
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const userProfile = ref<UserProfile | null>(null)
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
    
    // Fetch user profile if authenticated
    if (currentSession?.user) {
      userProfile.value = await userAPI.getProfile()
      
      // Create profile if it doesn't exist (first time login)
      if (!userProfile.value) {
        userProfile.value = await userAPI.upsertProfile({
          email: currentSession.user.email!,
          display_name: currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0],
          avatar_url: currentSession.user.user_metadata?.avatar_url,
        })
      }
      
      // Update last seen
      await userAPI.updateLastSeen()
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        // Fetch or create user profile on sign in
        userProfile.value = await userAPI.getProfile()
        
        if (!userProfile.value) {
          userProfile.value = await userAPI.upsertProfile({
            email: newSession.user.email!,
            display_name: newSession.user.user_metadata?.full_name || newSession.user.email?.split('@')[0],
            avatar_url: newSession.user.user_metadata?.avatar_url,
          })
        }
        
        // Update last seen
        await userAPI.updateLastSeen()
      } else if (event === 'SIGNED_OUT') {
        userProfile.value = null
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login'
        }
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        // Refresh user profile when user is updated
        userProfile.value = await userAPI.getProfile()
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
  const userEmail = computed(() => userProfile.value?.email ?? user.value?.email ?? '')
  const userName = computed(() => userProfile.value?.display_name ?? userProfile.value?.username ?? user.value?.user_metadata?.full_name ?? userEmail.value)
  const userAvatar = computed(() => userProfile.value?.avatar_url ?? user.value?.user_metadata?.avatar_url ?? null)
  const subscriptionTier = computed(() => userProfile.value?.subscription_tier ?? 'free')
  
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
  
  const signUpWithEmail = async (email: string, password: string, metadata?: { display_name?: string }) => {
    loading.value = true
    try {
      const data = await authHelpers.signUpWithEmail(email, password)
      
      // Create user profile after successful signup
      if (data.user && !data.user.identities?.length) {
        // User already exists
        return { data, error: 'User already exists' }
      }
      
      if (data.user) {
        await userAPI.upsertProfile({
          email: data.user.email!,
          display_name: metadata?.display_name || email.split('@')[0],
        })
      }
      
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
  
  // Profile management methods
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user.value) {
      return { data: null, error: 'User not authenticated' }
    }
    
    loading.value = true
    try {
      const updatedProfile = await userAPI.updateProfile(updates)
      if (updatedProfile) {
        userProfile.value = updatedProfile
        return { data: updatedProfile, error: null }
      }
      return { data: null, error: 'Failed to update profile' }
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to update profile' }
    } finally {
      loading.value = false
    }
  }
  
  const refreshProfile = async () => {
    if (!user.value) return null
    
    const profile = await userAPI.getProfile()
    if (profile) {
      userProfile.value = profile
    }
    return profile
  }
  
  const checkUsernameAvailability = async (username: string) => {
    return await userAPI.checkUsernameAvailability(username)
  }
  
  // Initialize on first use
  if (!initialized.value) {
    initializeAuth()
  }
  
  return {
    // State
    user: computed(() => user.value),
    session: computed(() => session.value),
    userProfile: computed(() => userProfile.value),
    loading: computed(() => loading.value),
    isAuthenticated,
    userEmail,
    userName,
    userAvatar,
    subscriptionTier,
    
    // Auth Methods
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    
    // Profile Methods
    updateProfile,
    refreshProfile,
    checkUsernameAvailability,
    
    // Utility
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
  
  const requireGuest = async (redirectTo = '/') => {
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
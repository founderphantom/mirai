import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
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
  
  loading.value = true
  
  try {
    // Get initial session
    const { data: { session: currentSession }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
    }
    
    // Update state immediately
    session.value = currentSession
    user.value = currentSession?.user ?? null
    
    // Fetch user profile if authenticated
    if (currentSession?.user) {
      try {
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
      } catch (profileError) {
        console.error('Error fetching/creating user profile:', profileError)
      }
    }
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession?.user?.email)
      
      // Update state immediately
      session.value = newSession
      user.value = newSession?.user ?? null
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        // Fetch or create user profile on sign in
        try {
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
        } catch (profileError) {
          console.error('Error handling sign in:', profileError)
        }
      } else if (event === 'SIGNED_OUT') {
        userProfile.value = null
        // Don't redirect here, let the route guards handle it
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        // Refresh user profile when user is updated
        try {
          userProfile.value = await userAPI.getProfile()
        } catch (profileError) {
          console.error('Error updating user profile:', profileError)
        }
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      }
    })
    
    // Store subscription for cleanup if needed
    if (subscription) {
      // Store subscription reference if needed for cleanup
    }
    
    initialized.value = true
  } catch (error) {
    console.error('Failed to initialize auth:', error)
  } finally {
    loading.value = false
  }
}

export function useAuth() {
  
  // Computed properties
  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => userProfile.value?.email ?? user.value?.email ?? '')
  const userName = computed(() => userProfile.value?.display_name ?? userProfile.value?.username ?? user.value?.user_metadata?.full_name ?? userEmail.value)
  const userAvatar = computed(() => userProfile.value?.avatar_url ?? user.value?.user_metadata?.avatar_url ?? null)
  const subscriptionTier = computed(() => userProfile.value?.subscription_tier ?? 'free')
  
  // Auth methods
  const signInWithEmail = async (email: string, password: string, rememberMe = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Sign in error:', error)
        return { data: null, error: error.message }
      }
      
      // The session will be handled by onAuthStateChange
      // No need to manually update state here
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Unexpected sign in error:', error)
      return { data: null, error: error.message || 'Failed to sign in' }
    }
  }
  
  const signUpWithEmail = async (email: string, password: string, metadata?: { display_name?: string }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
      
      if (error) {
        console.error('Sign up error:', error)
        return { data: null, error: error.message }
      }
      
      // Check if user already exists
      if (data.user && !data.user.identities?.length) {
        return { data, error: 'User already exists' }
      }
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Unexpected sign up error:', error)
      return { data: null, error: error.message || 'Failed to sign up' }
    }
  }
  
  const signInWithOAuth = async (provider: 'google' | 'discord') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        console.error('OAuth sign in error:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Unexpected OAuth sign in error:', error)
      return { data: null, error: error.message || 'Failed to sign in with ' + provider }
    }
  }
  
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Sign out error:', error)
        return { error: error.message }
      }
      
      // Clear local state
      user.value = null
      session.value = null
      userProfile.value = null
      
      // Let the route guards handle navigation
      return { error: null }
    } catch (error: any) {
      console.error('Unexpected sign out error:', error)
      return { error: error.message || 'Failed to sign out' }
    }
  }
  
  const resetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      
      if (error) {
        console.error('Reset password error:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Unexpected reset password error:', error)
      return { data: null, error: error.message || 'Failed to send reset email' }
    }
  }
  
  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (error) {
        console.error('Update password error:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Unexpected update password error:', error)
      return { data: null, error: error.message || 'Failed to update password' }
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
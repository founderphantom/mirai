import { ref, computed, readonly, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import type { User, Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { userAPI, type UserProfile } from '@/lib/api'
import { SessionManager } from '@/lib/session-manager'
import { getAuthErrorMessage, logAuthError } from '@/lib/auth-errors'

// Global auth state - using shallowRef for better performance with large objects
const user = shallowRef<User | null>(null)
const session = shallowRef<Session | null>(null)
const userProfile = shallowRef<UserProfile | null>(null)
const loading = ref(true)
const initialized = ref(false)
let authSubscription: { unsubscribe: () => void } | null = null

// Initialize auth state
async function initializeAuth() {
  if (initialized.value) return
  
  loading.value = true
  
  try {
    // Get initial session
    const { data: { session: currentSession }, error } = await supabase.auth.getSession()
    
    if (error && import.meta.env.DEV) {
      console.error('[Auth] Error getting session:', error)
    }
    
    // Update state immediately
    session.value = currentSession
    user.value = currentSession?.user ?? null
    
    // Start auto-refresh if we have a session
    if (currentSession) {
      SessionManager.startAutoRefresh(currentSession)
    }
    
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
        if (import.meta.env.DEV) {
          console.error('[Auth] Error fetching/creating user profile:', profileError)
        }
      }
    }
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, newSession: Session | null) => {
      if (import.meta.env.DEV) {
        console.info('[Auth] State changed:', event)
      }
      
      // Update state immediately
      session.value = newSession
      user.value = newSession?.user ?? null
      
      // Manage session refresh
      if (newSession) {
        SessionManager.startAutoRefresh(newSession)
      } else {
        SessionManager.stopAutoRefresh()
      }
      
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
          if (import.meta.env.DEV) {
            console.error('[Auth] Error handling sign in:', profileError)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        userProfile.value = null
        SessionManager.stopAutoRefresh()
        SessionManager.clearAuthStorage()
        // Don't redirect here, let the route guards handle it
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        // Refresh user profile when user is updated
        try {
          userProfile.value = await userAPI.getProfile()
        } catch (profileError) {
          if (import.meta.env.DEV) {
            console.error('[Auth] Error updating user profile:', profileError)
          }
        }
      } else if (event === 'TOKEN_REFRESHED' && import.meta.env.DEV) {
        console.info('[Auth] Token refreshed successfully')
      }
    })
    
    // Store subscription for cleanup
    authSubscription = subscription
    
    initialized.value = true
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Auth] Failed to initialize:', error)
    }
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
        logAuthError('signInWithEmail', error)
        return { data: null, error: getAuthErrorMessage(error) }
      }
      
      // The session will be handled by onAuthStateChange
      // No need to manually update state here
      
      return { data, error: null }
    } catch (error: any) {
      logAuthError('signInWithEmail', error)
      return { data: null, error: getAuthErrorMessage(error) }
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
        logAuthError('signUpWithEmail', error)
        return { data: null, error: getAuthErrorMessage(error) }
      }
      
      // Check if user already exists
      if (data.user && !data.user.identities?.length) {
        return { data, error: 'User already exists' }
      }
      
      return { data, error: null }
    } catch (error: any) {
      logAuthError('signUpWithEmail', error)
      return { data: null, error: getAuthErrorMessage(error) }
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
        logAuthError('signInWithOAuth', error)
        return { data: null, error: getAuthErrorMessage(error) }
      }
      
      return { data, error: null }
    } catch (error: any) {
      logAuthError('signInWithOAuth', error)
      return { data: null, error: getAuthErrorMessage(error) }
    }
  }
  
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        logAuthError('signOut', error)
        return { error: getAuthErrorMessage(error) }
      }
      
      // Clear local state
      user.value = null
      session.value = null
      userProfile.value = null
      
      // Let the route guards handle navigation
      return { error: null }
    } catch (error: any) {
      logAuthError('signOut', error)
      return { error: getAuthErrorMessage(error) }
    }
  }
  
  const resetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      
      if (error) {
        logAuthError('resetPassword', error)
        return { data: null, error: getAuthErrorMessage(error) }
      }
      
      return { data, error: null }
    } catch (error: any) {
      logAuthError('resetPassword', error)
      return { data: null, error: getAuthErrorMessage(error) }
    }
  }
  
  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (error) {
        logAuthError('updatePassword', error)
        return { data: null, error: getAuthErrorMessage(error) }
      }
      
      return { data, error: null }
    } catch (error: any) {
      logAuthError('updatePassword', error)
      return { data: null, error: getAuthErrorMessage(error) }
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
  
  // Cleanup function for auth subscription and session management
  const cleanup = () => {
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
    SessionManager.stopAutoRefresh()
  }
  
  // Initialize on first use
  if (!initialized.value) {
    initializeAuth()
  }
  
  return {
    // State - using readonly to prevent external mutations
    user: readonly(user),
    session: readonly(session),
    userProfile: readonly(userProfile),
    loading: readonly(loading),
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
    cleanup,
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
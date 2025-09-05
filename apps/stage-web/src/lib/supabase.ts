import { createClient } from '@supabase/supabase-js'
import { getOAuthCallbackUrl, getPasswordResetUrl } from './utils/url'

// Supabase configuration
const supabaseUrl = 'https://sgupizcxhxohouklbntm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNndXBpemN4aHhvaG91a2xibnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2ODE5MDksImV4cCI6MjA3MjI1NzkwOX0.3Lyk_oUG9Rm-IpEvRkhxpSvNenISkpNQsg2WAjI6Nk8'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'airi-auth',
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Auth helper types
export interface AuthUser {
  id: string
  email: string
  created_at: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    preferred_language?: string
  }
}

// Auth helper functions
export const authHelpers = {
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    return data
  },

  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getOAuthCallbackUrl(),
      },
    })
    
    if (error) throw error
    return data
  },

  async signInWithOAuth(provider: 'google' | 'discord') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getOAuthCallbackUrl(),
        scopes: provider === 'google' ? 'email profile' : 'identify email',
      },
    })
    
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetUrl(),
    })
    
    if (error) throw error
    return data
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    
    if (error) throw error
    return data
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  }
}
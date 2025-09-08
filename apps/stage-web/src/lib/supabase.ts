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
import { ofetch } from 'ofetch'
import { supabase } from './supabase'

// Get API URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Create API client with Supabase Auth integration
export const apiClient = ofetch.create({
  baseURL: API_BASE_URL,
  async onRequest({ options }) {
    // Get the current Supabase session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      // Add the Supabase access token to the Authorization header
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      }
    }
  },
  async onResponseError({ response, error }) {
    // Handle 401 errors by refreshing the session
    if (response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) {
        // No valid session, redirect to login
        window.location.href = '/auth/login'
      }
    }
    
    // Log other errors
    console.error('API Error:', error)
  },
})

// User profile type matching the database schema
export interface UserProfile {
  id: string
  email: string
  username?: string
  display_name?: string
  subscription_tier: 'free' | 'pro' | 'premium'
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
  last_seen_at?: string
  preferences?: Record<string, any>
}

// API methods for user profile management
export const userAPI = {
  // Get current user's profile from the database
  async getProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
    
    return data as UserProfile
  },
  
  // Update user profile
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating user profile:', error)
      return null
    }
    
    return data as UserProfile
  },
  
  // Create or update user profile (for initial setup)
  async upsertProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        ...profile,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error upserting user profile:', error)
      return null
    }
    
    return data as UserProfile
  },
  
  // Check if username is available
  async checkUsernameAvailability(username: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    
    if (error) {
      console.error('Error checking username:', error)
      return false
    }
    
    return !data // Available if no data found
  },
  
  // Update last seen timestamp
  async updateLastSeen(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    await supabase
      .from('user_profiles')
      .update({
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  },
}

// Example API methods for other backend endpoints
export const api = {
  // Health check
  async healthCheck() {
    return apiClient('/health')
  },
  
  // Example: Get user's chat history (if backend provides this)
  async getChatHistory() {
    return apiClient('/api/chats')
  },
  
  // Example: Save chat message (if backend provides this)
  async saveChatMessage(message: any) {
    return apiClient('/api/chats', {
      method: 'POST',
      body: message,
    })
  },
  
  // Add more API methods as needed based on your backend endpoints
}
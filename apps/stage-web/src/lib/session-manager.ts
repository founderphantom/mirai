import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Session manager for handling auth sessions with best practices
 */
export class SessionManager {
  private static refreshTimer: NodeJS.Timeout | null = null
  private static readonly TOKEN_REFRESH_MARGIN = 60000 // Refresh 1 minute before expiry
  private static readonly MIN_REFRESH_INTERVAL = 30000 // Minimum 30 seconds between refreshes
  private static lastRefreshTime = 0

  /**
   * Starts automatic session refresh
   */
  static startAutoRefresh(session: Session | null): void {
    this.stopAutoRefresh()
    
    if (!session?.expires_at) return
    
    const expiresAt = session.expires_at * 1000 // Convert to milliseconds
    const now = Date.now()
    const timeUntilExpiry = expiresAt - now
    const refreshTime = Math.max(
      timeUntilExpiry - this.TOKEN_REFRESH_MARGIN,
      this.MIN_REFRESH_INTERVAL
    )
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshSession()
      }, refreshTime)
    }
  }

  /**
   * Stops automatic session refresh
   */
  static stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * Manually refreshes the session
   */
  static async refreshSession(): Promise<Session | null> {
    const now = Date.now()
    
    // Prevent rapid refresh attempts
    if (now - this.lastRefreshTime < this.MIN_REFRESH_INTERVAL) {
      if (import.meta.env.DEV) {
        console.info('[Session] Skipping refresh - too soon since last refresh')
      }
      return null
    }
    
    this.lastRefreshTime = now
    
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Session] Refresh failed:', error)
        }
        return null
      }
      
      if (session) {
        this.startAutoRefresh(session)
        if (import.meta.env.DEV) {
          console.info('[Session] Refreshed successfully')
        }
      }
      
      return session
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Session] Unexpected refresh error:', error)
      }
      return null
    }
  }

  /**
   * Validates if a session is still valid
   */
  static isSessionValid(session: Session | null): boolean {
    if (!session?.expires_at) return false
    
    const now = Date.now()
    const expiresAt = session.expires_at * 1000
    
    // Consider session invalid if it expires in less than 30 seconds
    return (expiresAt - now) > 30000
  }

  /**
   * Gets the time until session expiry in milliseconds
   */
  static getTimeUntilExpiry(session: Session | null): number {
    if (!session?.expires_at) return 0
    
    const now = Date.now()
    const expiresAt = session.expires_at * 1000
    
    return Math.max(0, expiresAt - now)
  }

  /**
   * Formats session expiry time for display
   */
  static formatExpiryTime(session: Session | null): string {
    const timeUntilExpiry = this.getTimeUntilExpiry(session)
    
    if (timeUntilExpiry <= 0) return 'Expired'
    
    const minutes = Math.floor(timeUntilExpiry / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
    
    return 'Less than a minute'
  }

  /**
   * Clears all auth-related storage
   */
  static clearAuthStorage(): void {
    try {
      // Clear localStorage items related to auth
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('airi-auth') || key.includes('supabase'))) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Clear sessionStorage as well
      sessionStorage.clear()
      
      if (import.meta.env.DEV) {
        console.info('[Session] Auth storage cleared')
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Session] Error clearing storage:', error)
      }
    }
  }

  /**
   * Handles session errors with retry logic
   */
  static async handleSessionError(
    operation: () => Promise<any>,
    maxRetries = 3,
    backoffMs = 1000
  ): Promise<any> {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        if (import.meta.env.DEV) {
          console.warn(`[Session] Attempt ${attempt}/${maxRetries} failed:`, error)
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, backoffMs * attempt)
          )
        }
      }
    }
    
    throw lastError
  }
}
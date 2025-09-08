import type { AuthError } from '@supabase/supabase-js'

/**
 * Auth error codes and their user-friendly messages
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Sign in errors
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email address before signing in.',
  'user_not_found': 'No account found with this email address.',
  
  // Sign up errors
  'user_already_exists': 'An account with this email already exists.',
  'weak_password': 'Password is too weak. Please use a stronger password.',
  'over_email_send_rate_limit': 'Too many emails sent. Please try again later.',
  
  // OAuth errors
  'provider_email_needs_verification': 'Please verify your email with the provider.',
  'oauth_error': 'Authentication failed. Please try again.',
  
  // Session errors
  'session_not_found': 'Session expired. Please sign in again.',
  'refresh_token_not_found': 'Session expired. Please sign in again.',
  
  // Rate limiting
  'over_request_rate_limit': 'Too many attempts. Please try again later.',
  'email_rate_limit_exceeded': 'Too many email requests. Please try again later.',
  
  // Network errors
  'network_error': 'Network error. Please check your connection.',
  'server_error': 'Server error. Please try again later.',
  
  // Generic
  'unexpected_error': 'An unexpected error occurred. Please try again.',
}

/**
 * Maps Supabase auth errors to user-friendly messages
 */
export function getAuthErrorMessage(error: AuthError | string | null): string {
  if (!error) return 'An unexpected error occurred'
  
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Check for specific error patterns
  if (errorMessage.includes('Invalid login credentials')) {
    return AUTH_ERROR_MESSAGES.invalid_credentials
  }
  
  if (errorMessage.includes('Email not confirmed')) {
    return AUTH_ERROR_MESSAGES.email_not_confirmed
  }
  
  if (errorMessage.includes('User already registered')) {
    return AUTH_ERROR_MESSAGES.user_already_exists
  }
  
  if (errorMessage.includes('rate limit')) {
    return AUTH_ERROR_MESSAGES.over_request_rate_limit
  }
  
  if (errorMessage.includes('Network')) {
    return AUTH_ERROR_MESSAGES.network_error
  }
  
  // Check error code if available
  if (typeof error === 'object' && 'code' in error) {
    const code = error.code as string
    if (AUTH_ERROR_MESSAGES[code]) {
      return AUTH_ERROR_MESSAGES[code]
    }
  }
  
  // Return the original message if no mapping found
  return errorMessage || AUTH_ERROR_MESSAGES.unexpected_error
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: AuthError | string | null): boolean {
  if (!error) return false
  
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Network and server errors are typically retryable
  return errorMessage.includes('Network') || 
         errorMessage.includes('server') ||
         errorMessage.includes('timeout')
}

/**
 * Gets the appropriate HTTP status code for an auth error
 */
export function getAuthErrorStatusCode(error: AuthError | string | null): number {
  if (!error) return 500
  
  const errorMessage = typeof error === 'string' ? error : error.message
  
  if (errorMessage.includes('Invalid login credentials') || 
      errorMessage.includes('user_not_found')) {
    return 401
  }
  
  if (errorMessage.includes('rate limit')) {
    return 429
  }
  
  if (errorMessage.includes('User already registered')) {
    return 409
  }
  
  if (errorMessage.includes('Network')) {
    return 503
  }
  
  return 500
}

/**
 * Logs auth errors appropriately based on environment
 */
export function logAuthError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) return
  
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error
  }
  
  console.error(`[Auth:${context}]`, errorInfo)
}
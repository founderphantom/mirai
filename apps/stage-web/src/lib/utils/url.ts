/**
 * Get the application URL based on the environment
 * This handles local development, Vercel preview deployments, and production
 */
export function getAppUrl(): string {
  // Check if we have a configured app URL from environment variables
  if (import.meta.env.VITE_APP_URL) {
    // Ensure the URL has the correct protocol
    const url = import.meta.env.VITE_APP_URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // In production, always use https
      const protocol = import.meta.env.PROD ? 'https://' : 'http://'
      return `${protocol}${url}`
    }
    return url
  }

  // For production deployments without VITE_APP_URL set
  if (import.meta.env.PROD) {
    // Check if we're on the production domain
    if (typeof window !== 'undefined') {
      const { protocol, host } = window.location
      // Use the current domain in production
      return `${protocol}//${host}`
    }
    // Fallback to production URL if window is not available
    return 'https://miraichat.app'
  }

  // For local development
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // Default fallback for local development
  return 'http://localhost:5173'
}

/**
 * Get the OAuth callback URL
 */
export function getOAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`
}

/**
 * Get the password reset callback URL
 */
export function getPasswordResetUrl(): string {
  return `${getAppUrl()}/auth/reset-password`
}
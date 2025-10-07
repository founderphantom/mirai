/**
 * Error handling utilities
 */

/**
 * Handle authentication errors
 */
export function handleAuthError(error: any): void {
  if (error.status === 401) {
    // Session expired - redirect to login
    window.location.href = '/auth/sign-in'
    return
  }

  if (error.status === 403) {
    // Insufficient permissions
    alert('You do not have permission to perform this action')
    return
  }

  // Generic auth error
  alert('Authentication error. Please sign in again.')
  window.location.href = '/auth/sign-in'
}

/**
 * Handle WebSocket connection errors
 */
export function handleWebSocketError(error: any, retryCallback?: () => void): void {
  console.error('WebSocket error:', error)

  // Check for common errors
  if (error.message?.includes('session expired')) {
    alert('Your session has expired. Please start a new conversation.')
    return
  }

  if (error.message?.includes('microphone')) {
    alert('Microphone access denied. Please enable microphone permissions.')
    return
  }

  // Generic WebSocket error with retry option
  if (retryCallback) {
    const shouldRetry = confirm(
      'Connection error. Would you like to try reconnecting?'
    )
    if (shouldRetry) {
      retryCallback()
    }
  } else {
    alert('Connection error. Please try again.')
  }
}

/**
 * Handle API request errors
 */
export function handleApiError(error: any): void {
  if (error.status === 404) {
    alert('Resource not found')
    return
  }

  if (error.status === 429) {
    alert('Too many requests. Please wait a moment and try again.')
    return
  }

  if (error.status >= 500) {
    alert('Server error. Please try again later.')
    return
  }

  // Generic error
  alert(error.message || 'An unexpected error occurred')
}

/**
 * Error handling utilities for Mirai MVP
 *
 * Provides consistent error handling across the application
 * with user-friendly messages and proper error categorization.
 */

import { toast } from 'vue-sonner'

export interface ErrorContext {
  statusCode?: number
  message?: string
  operation?: string
  retry?: () => void | Promise<void>
}

export enum ErrorType {
  AUTH = 'auth',
  WEBSOCKET = 'websocket',
  API = 'api',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * Parse error object into standardized format
 */
export function parseError(error: any): ErrorContext {
  if (error instanceof Response) {
    return {
      statusCode: error.status,
      message: error.statusText,
    }
  }

  if (error?.response) {
    return {
      statusCode: error.response.status,
      message: error.response.data?.message || error.message,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  return {
    message: 'An unexpected error occurred',
  }
}

/**
 * Determine error type from error context
 */
export function getErrorType(context: ErrorContext): ErrorType {
  if (!context.statusCode) {
    if (context.message?.includes('websocket') || context.message?.includes('WebSocket')) {
      return ErrorType.WEBSOCKET
    }
    if (context.message?.includes('network') || context.message?.includes('fetch')) {
      return ErrorType.NETWORK
    }
    return ErrorType.UNKNOWN
  }

  if (context.statusCode === 401 || context.statusCode === 403) {
    return ErrorType.AUTH
  }

  if (context.statusCode >= 400 && context.statusCode < 500) {
    return ErrorType.VALIDATION
  }

  if (context.statusCode >= 500) {
    return ErrorType.API
  }

  return ErrorType.UNKNOWN
}

/**
 * Handle authentication errors (401, 403)
 * Redirects to sign-in page for expired sessions
 */
export function handleAuthError(error: any): string {
  const context = parseError(error)

  if (context.statusCode === 401) {
    // Session expired - redirect to login
    toast.error('Session Expired', {
      description: 'Your session has expired. Please sign in again.',
    })

    setTimeout(() => {
      window.location.href = '/auth/sign-in'
    }, 1500)

    return 'Session expired. Redirecting to sign-in...'
  }

  if (context.statusCode === 403) {
    // Insufficient permissions
    toast.error('Permission Denied', {
      description: 'You do not have permission to perform this action.',
    })
    return 'Permission denied'
  }

  // Generic auth error
  toast.error('Authentication Error', {
    description: 'Please sign in again to continue.',
  })

  setTimeout(() => {
    window.location.href = '/auth/sign-in'
  }, 1500)

  return 'Authentication error. Redirecting...'
}

/**
 * Handle WebSocket connection errors
 * Provides retry option for recoverable errors
 */
export function handleWebSocketError(
  error: any,
  retryCallback?: () => void | Promise<void>
): string {
  console.error('WebSocket error:', error)
  const context = parseError(error)

  // Session expired
  if (context.message?.includes('session expired')) {
    toast.error('Session Expired', {
      description: 'Please start a new conversation.',
    })
    return 'Session expired'
  }

  // Microphone permission denied
  if (context.message?.includes('microphone') || context.message?.includes('getUserMedia')) {
    toast.error('Microphone Access Denied', {
      description: 'Please enable microphone permissions in your browser settings.',
      duration: 5000,
    })
    return 'Microphone access denied'
  }

  // Connection closed unexpectedly
  if (context.message?.includes('closed') || context.message?.includes('disconnect')) {
    if (retryCallback) {
      toast.error('Connection Lost', {
        description: 'The connection was interrupted.',
        action: {
          label: 'Retry',
          onClick: () => {
            void retryCallback()
          },
        },
        duration: 10000,
      })
      return 'Connection lost. Click to retry.'
    }

    toast.error('Connection Lost', {
      description: 'Please try reconnecting.',
    })
    return 'Connection lost'
  }

  // Generic WebSocket error
  if (retryCallback) {
    toast.error('Connection Error', {
      description: context.message || 'Unable to establish connection.',
      action: {
        label: 'Retry',
        onClick: () => {
          void retryCallback()
        },
      },
      duration: 10000,
    })
  } else {
    toast.error('Connection Error', {
      description: context.message || 'Please try again.',
    })
  }

  return context.message || 'Connection error'
}

/**
 * Handle API request errors
 * Categorizes and displays appropriate error messages
 */
export function handleApiError(error: any, operation?: string): string {
  const context = parseError(error)
  const operationText = operation ? ` ${operation}` : ''

  // 404 - Not Found
  if (context.statusCode === 404) {
    toast.error('Not Found', {
      description: `The requested resource${operationText} could not be found.`,
    })
    return 'Resource not found'
  }

  // 429 - Rate Limited
  if (context.statusCode === 429) {
    toast.error('Too Many Requests', {
      description: 'Please wait a moment and try again.',
      duration: 5000,
    })
    return 'Rate limited'
  }

  // 400 - Bad Request / Validation Error
  if (context.statusCode === 400) {
    toast.error('Invalid Request', {
      description: context.message || 'Please check your input and try again.',
    })
    return context.message || 'Invalid request'
  }

  // 500+ - Server Error
  if (context.statusCode && context.statusCode >= 500) {
    toast.error('Server Error', {
      description: 'Our servers are experiencing issues. Please try again later.',
      duration: 5000,
    })
    return 'Server error'
  }

  // Network error (no status code)
  if (!context.statusCode) {
    toast.error('Network Error', {
      description: 'Unable to connect. Please check your internet connection.',
    })
    return 'Network error'
  }

  // Generic error
  toast.error('Error', {
    description: context.message || 'An unexpected error occurred.',
  })

  return context.message || 'Unknown error'
}

/**
 * General error handler that routes to appropriate handler
 */
export function handleError(
  error: any,
  type?: ErrorType,
  retryCallback?: () => void | Promise<void>
): string {
  const context = parseError(error)
  const errorType = type || getErrorType(context)

  switch (errorType) {
    case ErrorType.AUTH:
      return handleAuthError(error)
    case ErrorType.WEBSOCKET:
      return handleWebSocketError(error, retryCallback)
    case ErrorType.API:
      return handleApiError(error)
    default:
      return handleApiError(error)
  }
}

/**
 * Show success notification
 */
export function showSuccess(title: string, description?: string): void {
  toast.success(title, {
    description,
  })
}

/**
 * Show info notification
 */
export function showInfo(title: string, description?: string): void {
  toast.info(title, {
    description,
  })
}

/**
 * Show warning notification
 */
export function showWarning(title: string, description?: string): void {
  toast.warning(title, {
    description,
  })
}

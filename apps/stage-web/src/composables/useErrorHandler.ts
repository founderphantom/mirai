/**
 * Error handling composable for Vue components
 *
 * Provides reactive error state management with automatic toast notifications
 * and integration with the error handler utilities.
 */

import { computed, ref } from 'vue'
import { ErrorType, handleError as handleGlobalError } from '../utils/errorHandler'

export interface ErrorState {
  message: string
  type: ErrorType
  timestamp: number
  context?: string
}

export function useErrorHandler() {
  const currentError = ref<ErrorState | null>(null)
  const errorHistory = ref<ErrorState[]>([])
  const maxHistorySize = 10

  const hasError = computed(() => currentError.value !== null)
  const errorMessage = computed(() => currentError.value?.message || null)

  /**
   * Set an error with context
   */
  function setError(message: string, type: ErrorType = ErrorType.UNKNOWN, context?: string) {
    const error: ErrorState = {
      message,
      type,
      timestamp: Date.now(),
      context,
    }

    currentError.value = error

    // Add to history
    errorHistory.value.unshift(error)
    if (errorHistory.value.length > maxHistorySize) {
      errorHistory.value.pop()
    }
  }

  /**
   * Clear the current error
   */
  function clearError() {
    currentError.value = null
  }

  /**
   * Handle an error and show toast notification
   */
  function handleError(
    err: any,
    type?: ErrorType,
    retryCallback?: () => void | Promise<void>,
    context?: string
  ): void {
    // Use global error handler which shows toast notifications
    const message = handleGlobalError(err, type, retryCallback)

    // Store error state locally
    setError(message, type || ErrorType.UNKNOWN, context)
  }

  /**
   * Handle auth errors specifically
   */
  function handleAuthError(err: any): void {
    handleError(err, ErrorType.AUTH, undefined, 'Authentication')
  }

  /**
   * Handle WebSocket errors specifically
   */
  function handleWebSocketError(err: any, retryCallback?: () => void | Promise<void>): void {
    handleError(err, ErrorType.WEBSOCKET, retryCallback, 'WebSocket Connection')
  }

  /**
   * Handle API errors specifically
   */
  function handleApiError(err: any, operation?: string): void {
    handleError(err, ErrorType.API, undefined, operation || 'API Request')
  }

  /**
   * Get error history
   */
  function getErrorHistory(): ErrorState[] {
    return [...errorHistory.value]
  }

  /**
   * Clear error history
   */
  function clearErrorHistory(): void {
    errorHistory.value = []
  }

  /**
   * Get last error of specific type
   */
  function getLastErrorOfType(type: ErrorType): ErrorState | null {
    return errorHistory.value.find(e => e.type === type) || null
  }

  return {
    // State
    currentError,
    hasError,
    errorMessage,
    errorHistory,

    // Methods
    setError,
    clearError,
    handleError,
    handleAuthError,
    handleWebSocketError,
    handleApiError,
    getErrorHistory,
    clearErrorHistory,
    getLastErrorOfType,
  }
}

/**
 * Error handling composable for Vue components
 */

import { ref } from 'vue'

export function useErrorHandler() {
  const error = ref<string | null>(null)
  const isError = ref(false)

  function setError(message: string) {
    error.value = message
    isError.value = true
  }

  function clearError() {
    error.value = null
    isError.value = false
  }

  function handleError(err: any) {
    const message = err instanceof Error ? err.message : 'An error occurred'
    setError(message)
    console.error('Error:', err)
  }

  return {
    error,
    isError,
    setError,
    clearError,
    handleError,
  }
}

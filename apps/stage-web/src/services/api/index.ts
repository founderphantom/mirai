/**
 * API Service Module Exports
 */

export * from './characters'

/**
 * Common API utilities
 */
export function getApiUrl(path: string): string {
  return `${import.meta.env.VITE_API_URL}${path}`
}

/**
 * Generic API request helper
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Always include cookies
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(error.message || 'API request failed')
  }

  return response.json()
}

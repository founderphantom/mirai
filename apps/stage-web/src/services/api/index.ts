/**
 * API Service Module Exports
 */

export * from './characters'
export * from './payments'

/**
 * Common API utilities
 *
 * Note: All API requests now use relative paths (e.g., '/api/characters')
 * The static asset worker proxies these to the API Gateway via service binding
 */
export function getApiUrl(path: string): string {
  // Use relative path for service binding
  // Worker will proxy /api/* requests to API Gateway internally
  return path.startsWith('/api/') ? path : `/api${path}`
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
    })) as { message?: string }
    throw new Error(error.message || 'API request failed')
  }

  return response.json()
}

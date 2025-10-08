/**
 * Better-Auth client for Vue application
 * Handles authentication with the API Gateway via service binding
 *
 * Note: Uses relative path - the static asset worker proxies /api/auth/* to API Gateway
 */

import { createAuthClient } from 'better-auth/vue'
import type { Session } from 'better-auth/types'

// Create the auth client with relative base URL
// Worker proxies /api/* requests to API Gateway via service binding
const client = createAuthClient({
  baseURL: window.location.origin, // Use same origin, worker will proxy
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
})

// Export the client and its composables
export const authClient = client
export const useSession = client.useSession

// Re-export types
export type { Session }

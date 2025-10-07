/**
 * Better-Auth client for Vue application
 * Handles authentication with the API Gateway
 */

import { createAuthClient } from 'better-auth/vue'
import type { Session } from 'better-auth/types'

// Create the auth client
const client = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787',
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
})

// Export the client and its composables
export const authClient = client
export const useSession = client.useSession

// Re-export types
export type { Session }

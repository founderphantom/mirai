/**
 * Better-Auth client for Vue application
 * Handles authentication with the API Gateway
 *
 * Uses VITE_API_URL from environment to determine the API endpoint:
 * - Production: https://api.miraichat.app (direct connection, no proxy)
 * - Development: http://localhost:4337 (direct to api-gateway)
 */

import { createAuthClient } from 'better-auth/vue'
import type { Session } from 'better-auth/types'

// Use VITE_API_URL from environment for API endpoint
// In production: Points to api.miraichat.app for direct connection
// In development: Points to localhost:4337 for local api-gateway
const client = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
})

// Export the client and its composables
export const authClient = client
export const useSession = client.useSession

// Re-export types
export type { Session }

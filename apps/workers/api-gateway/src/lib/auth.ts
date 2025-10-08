/**
 * Better-Auth Configuration
 *
 * This sets up authentication with Better-Auth, including:
 * - Email/password authentication
 * - Social OAuth providers (Google, Discord)
 * - Drizzle ORM adapter for D1 database
 * - Polar payment integration
 * - Session management
 * - Rate limiting
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/d1'
import { polar, checkout, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import type { Env } from '../types/env'

export function createAuth(env: Env) {
  const db = drizzle(env.DB)

  // Initialize Polar client
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
  })

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite', // Cloudflare D1 uses SQLite
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    // Email & Password Authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url, token }) => {
        // TODO: Implement email sending (SendGrid, Resend, etc.)
        console.log(`[AUTH] Password reset for ${user.email}:`, url)
      },
    },

    // Email Verification
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        // TODO: Implement email sending
        console.log(`[AUTH] Verification email for ${user.email}:`, url)
      },
    },

    // Social OAuth Providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ['email', 'profile'],
      },
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ['identify', 'email'],
      },
    },

    // Session Configuration
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days
      updateAge: 24 * 60 * 60, // Update every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    // Rate Limiting
    rateLimit: {
      enabled: env.ENVIRONMENT === 'production',
      window: 60, // 60 seconds
      max: 100, // 100 requests per window
      storage: 'database',
      customRules: {
        '/sign-in/email': {
          window: 10,
          max: 5,
        },
        '/sign-up/email': {
          window: 10,
          max: 3,
        },
      },
    },

    // User Additional Fields
    user: {
      additionalFields: {
        displayName: {
          type: 'string',
          required: false,
        },
        avatarUrl: {
          type: 'string',
          required: false,
        },
        polarCustomerId: {
          type: 'string',
          required: false,
        },
        subscriptionTier: {
          type: 'string',
          required: false,
          defaultValue: 'free',
        },
        subscriptionStatus: {
          type: 'string',
          required: false,
        },
      },
    },

    // Polar Plugin for Payment Integration
    plugins: [
      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            organizationId: env.POLAR_ORGANIZATION_ID,
          }),
          portal(),
          usage(),
          webhooks({
            secret: env.POLAR_WEBHOOK_SECRET,
          }),
        ],
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

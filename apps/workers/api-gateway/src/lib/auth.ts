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
import * as schema from '@proj-airi/database-schema'

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema })

  // Initialize Polar client
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
  })

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite', // Cloudflare D1 uses SQLite
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      'https://mirai-stage-web.founder-968.workers.dev',
      'https://mirai-api-gateway.founder-968.workers.dev',
      'https://miraichat.app',
      'https://www.miraichat.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ],

    // Email & Password Authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url, token }) => {
        // Replace API gateway URL with frontend URL
        const apiUrl = new URL(env.BETTER_AUTH_URL)
        const frontendUrl = url.replace(apiUrl.origin, env.FRONTEND_URL)

        // Send password reset email using Resend
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Mirai <noreply@miraichat.app>',
              to: [user.email],
              subject: 'Reset your password - Mirai',
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                      .header h1 { color: white; margin: 0; font-size: 24px; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                      .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                      .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>Reset Your Password</h1>
                      </div>
                      <div class="content">
                        <p>Hi ${user.name},</p>
                        <p>We received a request to reset your password for your Mirai account. Click the button below to create a new password.</p>
                        <div style="text-align: center;">
                          <a href="${frontendUrl}" class="button">Reset Password</a>
                        </div>
                        <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                          Or copy and paste this link into your browser:<br>
                          <a href="${frontendUrl}" style="color: #667eea; word-break: break-all;">${frontendUrl}</a>
                        </p>
                        <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                        </p>
                      </div>
                      <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Mirai. All rights reserved.</p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            }),
          })

          if (!response.ok) {
            const error = await response.text()
            console.error('[AUTH] Failed to send password reset email:', error)
            throw new Error('Failed to send password reset email')
          }

          console.log(`[AUTH] Password reset email sent to ${user.email}`)
        } catch (error) {
          console.error('[AUTH] Error sending password reset email:', error)
        }
      },
    },

    // Email Verification
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        // Replace API gateway URL with frontend URL
        const apiUrl = new URL(env.BETTER_AUTH_URL)
        const frontendUrl = url.replace(apiUrl.origin, env.FRONTEND_URL)

        // Send verification email using Resend
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Mirai <noreply@miraichat.app>',
              to: [user.email],
              subject: 'Verify your email - Mirai',
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                      .header h1 { color: white; margin: 0; font-size: 24px; }
                      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                      .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                      .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>Welcome to Mirai!</h1>
                      </div>
                      <div class="content">
                        <p>Hi ${user.name},</p>
                        <p>Thanks for signing up! Please verify your email address to complete your registration and start using Mirai.</p>
                        <div style="text-align: center;">
                          <a href="${frontendUrl}" class="button">Verify Email Address</a>
                        </div>
                        <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                          Or copy and paste this link into your browser:<br>
                          <a href="${frontendUrl}" style="color: #667eea; word-break: break-all;">${frontendUrl}</a>
                        </p>
                        <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                          This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                        </p>
                      </div>
                      <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Mirai. All rights reserved.</p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            }),
          })

          if (!response.ok) {
            const error = await response.text()
            console.error('[AUTH] Failed to send verification email:', error)
            throw new Error('Failed to send verification email')
          }

          console.log(`[AUTH] Verification email sent to ${user.email}`)
        } catch (error) {
          console.error('[AUTH] Error sending verification email:', error)
          // Don't throw - we don't want to block signup if email fails
          // User can request a new verification email later
        }
      },
    },

    // Social OAuth Providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ['email', 'profile'],
        redirectURI: 'https://mirai-stage-web.founder-968.workers.dev/api/auth/callback/google',
      },
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ['identify', 'email'],
        redirectURI: 'https://mirai-stage-web.founder-968.workers.dev/api/auth/callback/discord',
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
            // Note: Products and successUrl will be provided when calling checkout from client
            // organizationId is passed as referenceId during client-side checkout call
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

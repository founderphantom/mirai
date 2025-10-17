/**
 * Middleware for API Gateway
 */

import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/env'
import type { Auth } from './auth'

/**
 * Authentication middleware
 * Verifies user session and adds user to context
 */
export function authMiddleware(auth: Auth) {
  return async (c: Context<HonoEnv>, next: Next) => {
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      })

      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // Add user and session to context
      c.set('user', session.user)
      c.set('session', session.session)

      await next()
    } catch (error) {
      console.error('[AUTH] Middleware error:', error)
      return c.json({ error: 'Authentication failed' }, 401)
    }
  }
}

/**
 * Error handler middleware
 */
export async function errorHandler(
  err: Error,
  c: Context<HonoEnv>,
) {
  console.error('[ERROR]', err)

  if (err.name === 'APIError') {
    return c.json(
      {
        error: err.message,
        status: (err as any).status || 500,
      },
      (err as any).status || 500,
    )
  }

  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500,
  )
}

/**
 * Logger middleware
 */
export async function logger(c: Context<HonoEnv>, next: Next) {
  const start = Date.now()
  await next()
  const ms = Date.now() - start

  console.log(
    `[${c.req.method}] ${c.req.url} - ${c.res.status} (${ms}ms)`,
  )
}

/**
 * Subscription tier check middleware
 * Verifies user has required subscription tier
 */
export function requireSubscription(...allowedTiers: string[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userTier = (user as any).subscriptionTier || 'free'

    if (!allowedTiers.includes(userTier)) {
      return c.json(
        {
          error: 'Subscription required',
          message: `This feature requires ${allowedTiers.join(' or ')} subscription`,
          currentTier: userTier,
        },
        403,
      )
    }

    await next()
  }
}

/**
 * Enhanced tier middleware with hierarchy support
 * Allows higher tiers to access lower tier features
 *
 * Usage:
 *   app.get('/api/premium-feature', requireTier('pro'), handler)
 *   app.get('/api/enterprise-feature', requireTier('enterprise'), handler)
 */
export function requireTier(
  requiredTier: 'pro' | 'enterprise',
) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const currentUser = c.get('user')

    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userTier = (currentUser as any).subscriptionTier || 'free'

    // Define tier hierarchy: enterprise > pro > free
    const tierHierarchy: Record<string, number> = {
      free: 0,
      pro: 1,
      enterprise: 2,
    }

    const userTierLevel = tierHierarchy[userTier]
    const requiredTierLevel = tierHierarchy[requiredTier]

    if (userTierLevel < requiredTierLevel) {
      return c.json(
        {
          error: 'Subscription required',
          message: `This feature requires a ${requiredTier} or higher subscription`,
          requiredTier,
          currentTier: userTier,
        },
        403,
      )
    }

    await next()
  }
}

/**
 * Usage limit middleware
 * Checks if user has exceeded their usage limits for voice minutes
 *
 * Usage:
 *   app.post('/api/voice/start', checkVoiceMinutes(1), handler)
 */
export function checkVoiceMinutes(requiredMinutes: number = 1) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const currentUser = c.get('user')

    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userTier = (currentUser as any).subscriptionTier || 'free'

    // Get tier limits
    const limits = getTierLimits(userTier)

    // Free tier has no voice access
    if (limits.voiceMinutes === 0) {
      return c.json(
        {
          error: 'Voice features not available',
          message: 'Upgrade to Pro or Enterprise to access voice features',
          requiredTier: ['pro', 'enterprise'],
        },
        403,
      )
    }

    // Enterprise has unlimited
    if (limits.voiceMinutes === -1) {
      await next()
      return
    }

    // Check current usage for Pro tier
    // Note: This is simplified - in production you'd query the database
    // to get actual usage from the current billing period
    // The voice session handler will track actual usage

    await next()
  }
}

/**
 * Helper: Get tier limits
 */
function getTierLimits(tier: string) {
  const limits = {
    free: {
      voiceMinutes: 0,
      characters: 1,
      features: ['basic'],
    },
    pro: {
      voiceMinutes: 500,
      characters: 10,
      features: ['basic', 'advanced', 'priority_support'],
    },
    enterprise: {
      voiceMinutes: -1, // Unlimited
      characters: -1, // Unlimited
      features: ['basic', 'advanced', 'priority_support', 'custom_integration', 'sla'],
    },
  }

  return limits[tier as keyof typeof limits] || limits.free
}

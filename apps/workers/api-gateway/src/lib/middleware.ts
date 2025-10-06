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

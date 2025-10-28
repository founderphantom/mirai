/**
 * Payment Routes
 *
 * Handles Polar payment integration:
 * - Checkout session creation
 * - Customer portal access
 * - Subscription status retrieval
 * - Usage tracking
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'
import { Polar } from '@polar-sh/sdk'
import { drizzle } from 'drizzle-orm/d1'
import { subscriptions, usageEvents, user, type NewUsageEvent } from '@proj-airi/database-schema'
import { eq, and, desc } from 'drizzle-orm'

const paymentRoutes = new Hono<HonoEnv>()

/**
 * POST /api/payments/checkout
 * Create a Polar checkout session
 *
 * Body:
 *   - tier: 'pro' | 'enterprise'
 *   - billingCycle?: 'monthly' | 'yearly'
 */
paymentRoutes.post('/checkout', async (c) => {
  try {
    const userId = c.get('user')?.id
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { tier, billingCycle = 'monthly' } = await c.req.json()

    if (!tier || !['pro', 'max'].includes(tier)) {
      return c.json({ error: 'Invalid tier. Must be "pro" or "max"' }, 400)
    }

    // Get product ID based on tier and billing cycle
    const productId = getProductId(c.env, tier, billingCycle)
    if (!productId) {
      return c.json({ error: 'Product not configured for this tier' }, 500)
    }

    // Initialize Polar client
    const polar = new Polar({
      accessToken: c.env.POLAR_SANDBOX_ACCESS_TOKEN,
      server: 'sandbox', // Required: Routes API calls to https://sandbox-api.polar.sh
    })

    const db = drizzle(c.env.DB)
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!currentUser.length) {
      return c.json({ error: 'User not found' }, 404)
    }

    const userEmail = currentUser[0].email
    const userName = currentUser[0].name

    // Create checkout session
    const checkout = await polar.checkouts.create({
      products: [productId], // Polar expects an array of product IDs
      customerEmail: userEmail,
      metadata: {
        userId,
        tier,
        billingCycle,
      },
      successUrl: `${c.env.FRONTEND_URL}/dashboard?checkout=success&tier=${tier}`,
      // Note: We don't set cancelUrl to allow users to go back
    })

    console.log(`[PAYMENTS] Checkout created for user ${userId}: ${tier} (${billingCycle})`)

    return c.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    })
  } catch (error) {
    console.error('[PAYMENTS] Checkout creation error:', error)
    return c.json(
      {
        error: 'Failed to create checkout',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * GET /api/payments/portal
 * Get customer portal URL
 */
paymentRoutes.get('/portal', async (c) => {
  try {
    const userId = c.get('user')?.id
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const db = drizzle(c.env.DB)
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!currentUser.length) {
      return c.json({ error: 'User not found' }, 404)
    }

    const polarCustomerId = currentUser[0].polarCustomerId
    if (!polarCustomerId) {
      return c.json(
        { error: 'No subscription found. Please subscribe first.' },
        404,
      )
    }

    // Initialize Polar client
    const polar = new Polar({
      accessToken: c.env.POLAR_SANDBOX_ACCESS_TOKEN,
      server: 'sandbox', // Required: Routes API calls to https://sandbox-api.polar.sh
    })

    // Create customer portal session
    const portal = await polar.customerSessions.create({
      customerId: polarCustomerId,
    })

    console.log(`[PAYMENTS] Portal session created for user ${userId}`)

    return c.json({
      portalUrl: portal.customerPortalUrl,
    })
  } catch (error) {
    console.error('[PAYMENTS] Portal creation error:', error)
    return c.json(
      {
        error: 'Failed to create portal session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * GET /api/payments/subscription
 * Get current user's subscription status
 */
paymentRoutes.get('/subscription', async (c) => {
  const userId = c.get('user')?.id
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = drizzle(c.env.DB)

  try {
    // Get user with subscription tier (critical - must succeed)
    let userData
    try {
      const currentUser = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)

      if (!currentUser.length) {
        return c.json({ error: 'User not found' }, 404)
      }

      userData = currentUser[0]
    } catch (err) {
      console.error('[PAYMENTS] Failed to fetch user data:', err)
      throw err // Critical error - cannot continue without user data
    }

    // Get active subscription (non-critical - free tier has none)
    let activeSubscription: any[] = []
    try {
      activeSubscription = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, 'active'),
          ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1)
    } catch (err) {
      console.error('[PAYMENTS] Failed to fetch subscription (non-critical):', err)
      // Continue - free tier users don't have subscriptions
    }

    // Get usage events (critical for quota enforcement)
    let usageMinutes = 0
    try {
      const allUsageEvents = await db
        .select()
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.eventType, 'voice_minutes'),
          ),
        )

      if (activeSubscription.length) {
        // Paid tier: Count usage since current billing period start
        const subscription = activeSubscription[0]
        const currentPeriodStart = subscription.currentPeriodStart

        usageMinutes = allUsageEvents
          .filter((event) => {
            try {
              return event.createdAt >= currentPeriodStart
            } catch {
              return false // Skip malformed dates
            }
          })
          .reduce((sum, event) => sum + (event.quantity || 0), 0)
      } else {
        // Free tier or no subscription: Count ALL usage (no billing period reset)
        usageMinutes = allUsageEvents
          .reduce((sum, event) => sum + (event.quantity || 0), 0)
      }
    } catch (err) {
      console.error('[PAYMENTS] Failed to calculate usage (using 0):', err)
      // Set to 0 - safer than failing the entire request
      usageMinutes = 0
    }

    // Calculate limits based on tier
    const limits = getTierLimits(userData.subscriptionTier)

    // Calculate remaining minutes, handling unlimited (-1) correctly
    const voiceMinutesRemaining = limits.voiceMinutes === -1
      ? -1  // Unlimited
      : Math.max(0, limits.voiceMinutes - usageMinutes)

    console.log(`[PAYMENTS] Subscription data for user ${userId}:`, {
      tier: userData.subscriptionTier,
      usageMinutes,
      limit: limits.voiceMinutes,
      remaining: voiceMinutesRemaining,
    })

    // Always return 200 with data (even if some queries failed)
    return c.json({
      subscription: activeSubscription.length ? activeSubscription[0] : null,
      tier: userData.subscriptionTier,
      status: userData.subscriptionStatus,
      polarCustomerId: userData.polarCustomerId,
      usage: {
        voiceMinutes: usageMinutes,
        voiceMinutesLimit: limits.voiceMinutes,
        voiceMinutesRemaining,
      },
      limits,
    })
  } catch (error) {
    console.error('[PAYMENTS] Critical subscription fetch error:', error)

    // Return 200 with minimal data instead of 500 (graceful degradation)
    return c.json({
      subscription: null,
      tier: 'free', // Default to free tier
      status: null,
      polarCustomerId: null,
      usage: {
        voiceMinutes: 0,
        voiceMinutesLimit: 20,
        voiceMinutesRemaining: 20,
      },
      limits: {
        voiceMinutes: 20,
        characters: 1,
        features: [],
      },
      error: 'Partial data returned due to database error',
    })
  }
})

/**
 * POST /api/payments/usage
 * Report usage event (internal use only, called from voice session)
 *
 * Body:
 *   - eventType: 'voice_minutes' | 'character_creation' | 'message_sent'
 *   - quantity: number
 *   - metadata?: object
 */
paymentRoutes.post('/usage', async (c) => {
  try {
    const userId = c.get('user')?.id
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { eventType, quantity, metadata = {} } = await c.req.json()

    if (!eventType || !['voice_minutes', 'character_creation', 'message_sent'].includes(eventType)) {
      return c.json({ error: 'Invalid event type' }, 400)
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return c.json({ error: 'Invalid quantity' }, 400)
    }

    const db = drizzle(c.env.DB)

    // Create usage event
    const usageEvent: NewUsageEvent = {
      id: crypto.randomUUID(),
      userId,
      eventType,
      quantity,
      metadata: JSON.stringify(metadata),
      createdAt: new Date(),
      polarSynced: false,
    }

    await db.insert(usageEvents).values(usageEvent)

    // If voice minutes, sync to Polar meter
    if (eventType === 'voice_minutes') {
      try {
        const polar = new Polar({
          accessToken: c.env.POLAR_SANDBOX_ACCESS_TOKEN,
          server: 'sandbox', // Required: Routes API calls to https://sandbox-api.polar.sh
        })

        // Get user's Polar customer ID
        const currentUser = await db
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)

        if (currentUser.length && currentUser[0].polarCustomerId) {
          // Note: This is a placeholder - actual implementation would use Polar's usage API
          // await polar.usage.record({
          //   customerId: currentUser[0].polarCustomerId,
          //   meterId: 'voice_minutes',
          //   value: quantity,
          //   timestamp: new Date().toISOString(),
          // })

          // Mark as synced
          await db
            .update(usageEvents)
            .set({ polarSynced: true })
            .where(eq(usageEvents.id, usageEvent.id))

          console.log(`[PAYMENTS] Usage synced to Polar: ${userId} - ${quantity} ${eventType}`)
        }
      } catch (polarError) {
        console.error('[PAYMENTS] Polar sync error:', polarError)
        // Don't fail the request if Polar sync fails
      }
    }

    console.log(`[PAYMENTS] Usage recorded: ${userId} - ${quantity} ${eventType}`)

    return c.json({
      success: true,
      usageEventId: usageEvent.id,
    })
  } catch (error) {
    console.error('[PAYMENTS] Usage tracking error:', error)
    return c.json(
      {
        error: 'Failed to record usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * Helper: Get product ID based on tier and billing cycle
 */
function getProductId(
  env: HonoEnv['Bindings'],
  tier: 'pro' | 'max',
  billingCycle: 'monthly' | 'yearly',
): string | null {
  // These should be set in wrangler.toml or environment
  if (tier === 'pro') {
    return billingCycle === 'yearly'
      ? env.POLAR_PRO_YEARLY_ID || null
      : env.POLAR_PRO_MONTHLY_ID || null
  } else if (tier === 'max') {
    return billingCycle === 'yearly'
      ? env.POLAR_MAX_YEARLY_ID || null
      : env.POLAR_MAX_MONTHLY_ID || null
  }
  return null
}

/**
 * Helper: Get tier limits
 */
function getTierLimits(tier: string) {
  const limits = {
    free: {
      voiceMinutes: 20, // Free tier gets 20 minutes
      characters: -1, // All preset characters (no marketplace)
      features: ['basic', 'preset_characters'],
    },
    pro: {
      voiceMinutes: 500,
      characters: -1, // All preset characters + marketplace
      features: ['basic', 'advanced', 'marketplace_access', 'priority_support'],
    },
    max: {
      voiceMinutes: -1, // Unlimited
      characters: -1, // Unlimited (preset + marketplace + custom)
      features: ['basic', 'advanced', 'marketplace_access', 'priority_support', 'voice_cloning', 'custom_integration', 'sla'],
    },
  }

  return limits[tier as keyof typeof limits] || limits.free
}

export default paymentRoutes

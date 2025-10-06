/**
 * Webhook Routes
 *
 * Handles webhooks from external services (Polar, etc.)
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'
import { drizzle } from 'drizzle-orm/d1'
import { subscriptions, user, type NewSubscription } from '@proj-airi/database-schema'
import { eq } from 'drizzle-orm'

const webhookRoutes = new Hono<HonoEnv>()

/**
 * POST /api/webhooks/polar
 * Handle Polar webhook events
 */
webhookRoutes.post('/polar', async (c) => {
  try {
    // Verify webhook signature
    const signature = c.req.header('x-polar-signature')
    if (!signature) {
      return c.json({ error: 'Missing signature' }, 401)
    }

    // TODO: Implement signature verification
    // For now, we'll just log and process

    const payload = await c.req.json()
    const { type, data } = payload

    console.log(`[WEBHOOK] Polar event: ${type}`, data)

    const db = drizzle(c.env.DB)

    switch (type) {
      case 'subscription.created':
        await handleSubscriptionCreated(db, data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(db, data)
        break

      case 'subscription.canceled':
        await handleSubscriptionCanceled(db, data)
        break

      case 'order.created':
        await handleOrderCreated(db, data)
        break

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${type}`)
    }

    return c.json({ received: true })
  } catch (error) {
    console.error('[WEBHOOK] Processing error:', error)
    return c.json(
      {
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    )
  }
})

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(db: any, data: any) {
  const {
    id,
    customer_id,
    user_id,
    product_id,
    price_id,
    status,
    current_period_start,
    current_period_end,
  } = data

  // Determine tier from product_id
  const tier = getTierFromProductId(product_id)

  // Insert subscription
  const newSubscription: NewSubscription = {
    id,
    userId: user_id,
    polarCustomerId: customer_id,
    productId: product_id,
    priceId: price_id,
    status,
    currentPeriodStart: new Date(current_period_start),
    currentPeriodEnd: new Date(current_period_end),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await db.insert(subscriptions).values(newSubscription)

  // Update user subscription tier
  await db
    .update(user)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: status,
      polarCustomerId: customer_id,
    })
    .where(eq(user.id, user_id))

  console.log(`[WEBHOOK] Subscription created for user ${user_id}: ${tier}`)
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(db: any, data: any) {
  const {
    id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
  } = data

  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart: new Date(current_period_start),
      currentPeriodEnd: new Date(current_period_end),
      cancelAtPeriodEnd: cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Update user status
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (subscription.length) {
    await db
      .update(user)
      .set({
        subscriptionStatus: status,
      })
      .where(eq(user.id, subscription[0].userId))
  }

  console.log(`[WEBHOOK] Subscription updated: ${id} - ${status}`)
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(db: any, data: any) {
  const { id, user_id } = data

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Downgrade user to free tier
  await db
    .update(user)
    .set({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    })
    .where(eq(user.id, user_id))

  console.log(`[WEBHOOK] Subscription canceled for user ${user_id}`)
}

/**
 * Handle order.created event
 */
async function handleOrderCreated(db: any, data: any) {
  console.log('[WEBHOOK] Order created:', data)
  // TODO: Handle one-time purchases
}

/**
 * Map Polar product ID to subscription tier
 */
function getTierFromProductId(productId: string): 'free' | 'pro' | 'enterprise' {
  // TODO: Replace with actual product IDs from Polar
  const productTierMap: Record<string, 'free' | 'pro' | 'enterprise'> = {
    'prod_free': 'free',
    'prod_pro': 'pro',
    'prod_enterprise': 'enterprise',
  }

  return productTierMap[productId] || 'free'
}

export default webhookRoutes
